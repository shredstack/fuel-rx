/**
 * Cooking Tracker Service
 *
 * Handles operations for tracking meal cooking status.
 * Supports both meal plan meals and saved meals (quick cook, party plans).
 */

import { createClient } from '@/lib/supabase/server';
import type {
  CookingStatus,
  MealPlanMealCookingStatus,
  SavedMealCookingStatus,
} from '@/lib/types';

/**
 * Mark a meal in a meal plan as cooked.
 * Also updates global cooking stats on the meal itself.
 * Optionally shares to the community feed.
 */
export async function markMealPlanMealCooked(
  mealPlanMealId: string,
  userId: string,
  status: CookingStatus,
  options?: {
    modificationNotes?: string;
    updatedInstructions?: string[];
    cookedPhotoUrl?: string;
    shareWithCommunity?: boolean;
  }
): Promise<MealPlanMealCookingStatus> {
  const supabase = await createClient();

  // Verify user owns this meal plan meal and get the meal_id
  const { data: mealSlot, error: verifyError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      meal_id,
      meal_plans!inner(user_id)
    `)
    .eq('id', mealPlanMealId)
    .single();

  if (verifyError || !mealSlot) {
    throw new Error('Meal slot not found');
  }

  // Type assertion for the joined data
  const mealPlanData = mealSlot.meal_plans as unknown as { user_id: string };
  if (mealPlanData.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  const cookedAt = status !== 'not_cooked' ? new Date().toISOString() : null;
  const shareWithCommunity = options?.shareWithCommunity ?? true;

  // Upsert cooking status
  const { data: cookingStatus, error: upsertError } = await supabase
    .from('meal_plan_meal_cooking_status')
    .upsert(
      {
        meal_plan_meal_id: mealPlanMealId,
        cooking_status: status,
        cooked_at: cookedAt,
        modification_notes: options?.modificationNotes || null,
        cooked_photo_url: options?.cookedPhotoUrl || null,
        share_with_community: shareWithCommunity,
      },
      {
        onConflict: 'meal_plan_meal_id',
      }
    )
    .select()
    .single();

  if (upsertError) {
    throw new Error(`Failed to update cooking status: ${upsertError.message}`);
  }

  // Update global meal stats and optionally update instructions
  if (status === 'cooked_as_is' || status === 'cooked_with_modifications') {
    // Call the database function to increment stats
    const { error: rpcError } = await supabase.rpc('increment_meal_cooked_stats', {
      p_meal_id: mealSlot.meal_id,
      p_with_modifications: status === 'cooked_with_modifications',
    });

    if (rpcError) {
      console.error('Error updating meal stats:', rpcError);
      // Don't throw - the cooking status was saved successfully
    }

    // If modifications were made and user provided updated instructions, save them
    if (status === 'cooked_with_modifications' && options?.updatedInstructions) {
      const { error: updateError } = await supabase
        .from('meals')
        .update({ instructions: options.updatedInstructions })
        .eq('id', mealSlot.meal_id);

      if (updateError) {
        console.error('Error updating meal instructions:', updateError);
        // Don't throw - the cooking status was saved successfully
      }
    }

    // Share to community feed if enabled
    if (shareWithCommunity) {
      await shareToCommunityfeed(supabase, userId, mealSlot.meal_id, {
        cookedPhotoUrl: options?.cookedPhotoUrl,
        userNotes: options?.modificationNotes,
      });
    }
  }

  return cookingStatus as MealPlanMealCookingStatus;
}

/**
 * Mark a saved meal (quick cook/party plan) as cooked.
 * Also updates global cooking stats on the meal itself.
 * Optionally shares to the community feed.
 */
export async function markSavedMealCooked(
  mealId: string,
  userId: string,
  status: CookingStatus,
  options?: {
    modificationNotes?: string;
    updatedInstructions?: string[];
    cookedPhotoUrl?: string;
    shareWithCommunity?: boolean;
  }
): Promise<SavedMealCookingStatus> {
  const supabase = await createClient();

  // Verify user owns this meal
  const { data: meal, error: verifyError } = await supabase
    .from('meals')
    .select('id, source_user_id')
    .eq('id', mealId)
    .single();

  if (verifyError || !meal) {
    throw new Error('Meal not found');
  }

  if (meal.source_user_id !== userId) {
    throw new Error('Unauthorized');
  }

  const cookedAt = status !== 'not_cooked' ? new Date().toISOString() : null;
  const shareWithCommunity = options?.shareWithCommunity ?? true;

  // Upsert cooking status
  const { data: cookingStatus, error: upsertError } = await supabase
    .from('saved_meal_cooking_status')
    .upsert(
      {
        meal_id: mealId,
        user_id: userId,
        cooking_status: status,
        cooked_at: cookedAt,
        modification_notes: options?.modificationNotes || null,
        cooked_photo_url: options?.cookedPhotoUrl || null,
        share_with_community: shareWithCommunity,
      },
      {
        onConflict: 'user_id,meal_id',
      }
    )
    .select()
    .single();

  if (upsertError) {
    throw new Error(`Failed to update cooking status: ${upsertError.message}`);
  }

  // Update global meal stats and optionally update instructions
  if (status === 'cooked_as_is' || status === 'cooked_with_modifications') {
    // Call the database function to increment stats
    const { error: rpcError } = await supabase.rpc('increment_meal_cooked_stats', {
      p_meal_id: mealId,
      p_with_modifications: status === 'cooked_with_modifications',
    });

    if (rpcError) {
      console.error('Error updating meal stats:', rpcError);
    }

    // If modifications were made and user provided updated instructions, save them
    if (status === 'cooked_with_modifications' && options?.updatedInstructions) {
      const { error: updateError } = await supabase
        .from('meals')
        .update({ instructions: options.updatedInstructions })
        .eq('id', mealId);

      if (updateError) {
        console.error('Error updating meal instructions:', updateError);
      }
    }

    // Share to community feed if enabled
    if (shareWithCommunity) {
      await shareToCommunityfeed(supabase, userId, mealId, {
        cookedPhotoUrl: options?.cookedPhotoUrl,
        userNotes: options?.modificationNotes,
      });
    }
  }

  return cookingStatus as SavedMealCookingStatus;
}

/**
 * Get cooking status for a specific meal plan meal
 */
export async function getMealPlanMealCookingStatus(
  mealPlanMealId: string
): Promise<MealPlanMealCookingStatus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meal_plan_meal_cooking_status')
    .select('*')
    .eq('meal_plan_meal_id', mealPlanMealId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - that's okay, means not cooked yet
      return null;
    }
    console.error('Error fetching cooking status:', error);
    return null;
  }

  return data as MealPlanMealCookingStatus;
}

/**
 * Get cooking statuses for all meals in a meal plan
 */
export async function getMealPlanCookingStatuses(
  mealPlanId: string
): Promise<Map<string, MealPlanMealCookingStatus>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meal_plan_meal_cooking_status')
    .select(
      `
      *,
      meal_plan_meals!inner(meal_plan_id)
    `
    )
    .eq('meal_plan_meals.meal_plan_id', mealPlanId);

  if (error) {
    console.error('Error fetching cooking statuses:', error);
    return new Map();
  }

  const statusMap = new Map<string, MealPlanMealCookingStatus>();
  data?.forEach((status) => {
    statusMap.set(status.meal_plan_meal_id, {
      id: status.id,
      meal_plan_meal_id: status.meal_plan_meal_id,
      cooking_status: status.cooking_status,
      cooked_at: status.cooked_at,
      modification_notes: status.modification_notes,
      cooked_photo_url: status.cooked_photo_url,
      share_with_community: status.share_with_community,
      created_at: status.created_at,
      updated_at: status.updated_at,
    });
  });

  return statusMap;
}

/**
 * Get cooking status for a specific saved meal
 */
export async function getSavedMealCookingStatus(
  mealId: string,
  userId: string
): Promise<SavedMealCookingStatus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('saved_meal_cooking_status')
    .select('*')
    .eq('meal_id', mealId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - that's okay, means not cooked yet
      return null;
    }
    console.error('Error fetching saved meal cooking status:', error);
    return null;
  }

  return data as SavedMealCookingStatus;
}

/**
 * Get cooking statuses for multiple saved meals
 */
export async function getSavedMealsCookingStatuses(
  userId: string,
  mealIds: string[]
): Promise<Map<string, SavedMealCookingStatus>> {
  const supabase = await createClient();

  if (mealIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('saved_meal_cooking_status')
    .select('*')
    .eq('user_id', userId)
    .in('meal_id', mealIds);

  if (error) {
    console.error('Error fetching saved meal cooking statuses:', error);
    return new Map();
  }

  const statusMap = new Map<string, SavedMealCookingStatus>();
  data?.forEach((status) => {
    statusMap.set(status.meal_id, status as SavedMealCookingStatus);
  });

  return statusMap;
}

/**
 * Reset cooking status (mark as not cooked)
 */
export async function resetMealPlanMealCookingStatus(
  mealPlanMealId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // Verify user owns this meal plan meal
  const { data: mealSlot, error: verifyError } = await supabase
    .from('meal_plan_meals')
    .select(
      `
      id,
      meal_plans!inner(user_id)
    `
    )
    .eq('id', mealPlanMealId)
    .single();

  if (verifyError || !mealSlot) {
    throw new Error('Meal slot not found');
  }

  const mealPlanData = mealSlot.meal_plans as unknown as { user_id: string };
  if (mealPlanData.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Delete the cooking status record
  const { error } = await supabase
    .from('meal_plan_meal_cooking_status')
    .delete()
    .eq('meal_plan_meal_id', mealPlanMealId);

  if (error) {
    throw new Error(`Failed to reset cooking status: ${error.message}`);
  }
}

/**
 * Reset saved meal cooking status (mark as not cooked)
 */
export async function resetSavedMealCookingStatus(mealId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('saved_meal_cooking_status')
    .delete()
    .eq('meal_id', mealId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to reset cooking status: ${error.message}`);
  }
}

/**
 * Update modification notes for a meal plan meal.
 */
export async function updateMealPlanMealNotes(
  mealPlanMealId: string,
  userId: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  // Verify user owns this meal plan meal
  const { data: mealSlot, error: verifyError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      meal_id,
      meal_plans!inner(user_id)
    `)
    .eq('id', mealPlanMealId)
    .single();

  if (verifyError || !mealSlot) {
    throw new Error('Meal slot not found');
  }

  const mealPlanData = mealSlot.meal_plans as unknown as { user_id: string };
  if (mealPlanData.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Update cooking status notes
  const { error: updateError } = await supabase
    .from('meal_plan_meal_cooking_status')
    .update({ modification_notes: notes })
    .eq('meal_plan_meal_id', mealPlanMealId);

  if (updateError) {
    throw new Error(`Failed to update notes: ${updateError.message}`);
  }
}

/**
 * Update modification notes for a saved meal.
 */
export async function updateSavedMealNotes(
  mealId: string,
  userId: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  // Verify user owns this meal
  const { data: meal, error: verifyError } = await supabase
    .from('meals')
    .select('id, source_user_id')
    .eq('id', mealId)
    .single();

  if (verifyError || !meal) {
    throw new Error('Meal not found');
  }

  if (meal.source_user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Update cooking status notes
  const { error: updateError } = await supabase
    .from('saved_meal_cooking_status')
    .update({ modification_notes: notes })
    .eq('meal_id', mealId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to update notes: ${updateError.message}`);
  }
}

/**
 * Helper to convert minutes to prep time string
 */
function minutesToPrepTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes <= 15) return '15_or_less';
  if (minutes <= 30) return '15_to_30';
  if (minutes <= 45) return '30_to_45';
  if (minutes <= 60) return '45_to_60';
  return '60_plus';
}

/**
 * Share a cooked meal to the community feed.
 * Only creates a post if the user has social_feed_enabled.
 */
async function shareToCommunityfeed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mealId: string,
  options: {
    cookedPhotoUrl?: string;
    userNotes?: string;
  }
): Promise<void> {
  try {
    // Check if user has social feed enabled
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('social_feed_enabled')
      .eq('id', userId)
      .single();

    if (!profile?.social_feed_enabled) {
      return; // User hasn't enabled community sharing
    }

    // Get meal details
    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .select('*')
      .eq('id', mealId)
      .single();

    if (mealError || !meal) {
      console.error('Error fetching meal for community sharing:', mealError);
      return;
    }

    // Create social feed post
    const { error: postError } = await supabase.from('social_feed_posts').insert({
      user_id: userId,
      source_type: 'cooked_meal',
      source_meals_table_id: mealId,
      meal_name: meal.name,
      calories: Math.round(meal.calories || 0),
      protein: Math.round(meal.protein || 0),
      carbs: Math.round(meal.carbs || 0),
      fat: Math.round(meal.fat || 0),
      image_url: meal.image_url,
      prep_time: minutesToPrepTime(meal.prep_time_minutes),
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      meal_type: meal.meal_type,
      cooked_photo_url: options.cookedPhotoUrl || null,
      user_notes: options.userNotes || null,
    });

    // Ignore duplicate errors (23505) - meal already shared
    if (postError && postError.code !== '23505') {
      console.error('Error sharing cooked meal to community feed:', postError);
    }
  } catch (error) {
    console.error('Error in shareToCommunityfeed:', error);
    // Don't throw - sharing is optional
  }
}
