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
 */
export async function markMealPlanMealCooked(
  mealPlanMealId: string,
  userId: string,
  status: CookingStatus,
  options?: {
    modificationNotes?: string;
    updatedInstructions?: string[];
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

  // Upsert cooking status
  const { data: cookingStatus, error: upsertError } = await supabase
    .from('meal_plan_meal_cooking_status')
    .upsert(
      {
        meal_plan_meal_id: mealPlanMealId,
        cooking_status: status,
        cooked_at: cookedAt,
        modification_notes: options?.modificationNotes || null,
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
  }

  return cookingStatus as MealPlanMealCookingStatus;
}

/**
 * Mark a saved meal (quick cook/party plan) as cooked.
 * Also updates global cooking stats on the meal itself.
 */
export async function markSavedMealCooked(
  mealId: string,
  userId: string,
  status: CookingStatus,
  options?: {
    modificationNotes?: string;
    updatedInstructions?: string[];
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
