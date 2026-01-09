/**
 * Custom Meals API - Now uses the normalized `meals` table
 *
 * POST - Create a new custom meal
 * GET - List user's custom meals
 * PUT - Update a custom meal
 * DELETE - Delete a custom meal
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeForMatching } from '@/lib/meal-service';
import type { IngredientWithNutrition, MealType } from '@/lib/types';

interface CustomMealIngredient {
  name: string;
  amount: string;
  unit: string;
  category?: 'produce' | 'protein' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'other';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type CustomMealPrepTime = '5_or_less' | '15' | '30' | 'more_than_30';

function prepTimeToMinutes(prepTime: CustomMealPrepTime | number | null | undefined): number {
  if (prepTime === null || prepTime === undefined) return 15;
  if (typeof prepTime === 'number') return prepTime;
  switch (prepTime) {
    case '5_or_less': return 5;
    case '15': return 15;
    case '30': return 30;
    case 'more_than_30': return 45;
    default: return 15;
  }
}

function minutesToPrepTime(minutes: number): CustomMealPrepTime {
  if (minutes <= 5) return '5_or_less';
  if (minutes <= 15) return '15';
  if (minutes <= 30) return '30';
  return 'more_than_30';
}

interface CreateCustomMealRequest {
  meal_name: string;
  meal_type?: MealType;
  ingredients: CustomMealIngredient[];
  instructions?: string[];
  image_url?: string | null;
  share_with_community?: boolean;
  prep_time?: CustomMealPrepTime | number | null;
  meal_prep_instructions?: string | null;
}

interface UpdateCustomMealRequest extends CreateCustomMealRequest {
  id: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateCustomMealRequest = await request.json();

    // Validate request
    if (!body.meal_name || typeof body.meal_name !== 'string' || body.meal_name.trim() === '') {
      return NextResponse.json({ error: 'Meal name is required' }, { status: 400 });
    }

    if (!body.ingredients || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
    }

    // Validate each ingredient has required fields
    for (const ingredient of body.ingredients) {
      if (!ingredient.name || typeof ingredient.name !== 'string') {
        return NextResponse.json({ error: 'Each ingredient must have a name' }, { status: 400 });
      }
      if (typeof ingredient.calories !== 'number' || ingredient.calories < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid calories' }, { status: 400 });
      }
      if (typeof ingredient.protein !== 'number' || ingredient.protein < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid protein' }, { status: 400 });
      }
      if (typeof ingredient.carbs !== 'number' || ingredient.carbs < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid carbs' }, { status: 400 });
      }
      if (typeof ingredient.fat !== 'number' || ingredient.fat < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid fat' }, { status: 400 });
      }
    }

    // Check if user has community enabled - if so, auto-share by default
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('social_feed_enabled')
      .eq('id', user.id)
      .single();

    // Auto-share if user has community enabled, unless explicitly set to false
    const shouldShare = body.share_with_community ?? profile?.social_feed_enabled ?? false;

    // Calculate total macros from ingredients
    const totalCalories = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.calories, 0));
    const totalProtein = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.protein, 0) * 10) / 10;
    const totalCarbs = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.carbs, 0) * 10) / 10;
    const totalFat = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.fat, 0) * 10) / 10;

    // Convert ingredients to the normalized format
    const normalizedIngredients: IngredientWithNutrition[] = body.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount || '1',
      unit: ing.unit || 'serving',
      category: ing.category || 'other',
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
    }));

    // Save to meals table
    const { data: savedMeal, error: saveError } = await supabase
      .from('meals')
      .insert({
        name: body.meal_name.trim(),
        name_normalized: normalizeForMatching(body.meal_name),
        meal_type: body.meal_type || 'dinner', // Default to dinner if not specified
        ingredients: normalizedIngredients,
        instructions: body.instructions || [],
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        prep_time_minutes: prepTimeToMinutes(body.prep_time),
        prep_instructions: body.meal_prep_instructions || null,
        source_type: 'user_created',
        source_user_id: user.id,
        is_user_created: true,
        is_nutrition_edited_by_user: true,
        is_public: shouldShare,
        image_url: body.image_url || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving custom meal:', saveError);
      return NextResponse.json({ error: 'Failed to save custom meal' }, { status: 500 });
    }

    // If sharing and user has social feed enabled, post to social feed
    if (shouldShare && profile?.social_feed_enabled) {
      const { error: shareError } = await supabase.from('social_feed_posts').upsert({
        user_id: user.id,
        source_type: 'custom_meal',
        source_meal_id: savedMeal.id,
        meal_name: savedMeal.name,
        calories: Math.round(savedMeal.calories),
        protein: Math.round(savedMeal.protein),
        carbs: Math.round(savedMeal.carbs),
        fat: Math.round(savedMeal.fat),
        image_url: savedMeal.image_url,
        prep_time: minutesToPrepTime(savedMeal.prep_time_minutes),
        ingredients: savedMeal.ingredients,
        meal_prep_instructions: savedMeal.prep_instructions,
      }, {
        onConflict: 'user_id,source_type,source_meal_id',
        ignoreDuplicates: false,
      });
      if (shareError) {
        console.error('Error sharing to community feed:', shareError);
      }
    }

    // Return in a format compatible with the old API for the client
    return NextResponse.json({
      id: savedMeal.id,
      meal_name: savedMeal.name,
      calories: savedMeal.calories,
      protein: savedMeal.protein,
      carbs: savedMeal.carbs,
      fat: savedMeal.fat,
      ingredients: savedMeal.ingredients,
      is_user_created: savedMeal.is_user_created,
      image_url: savedMeal.image_url,
      share_with_community: savedMeal.is_public,
      prep_time: savedMeal.prep_time_minutes,
      meal_prep_instructions: savedMeal.prep_instructions,
      created_at: savedMeal.created_at,
    });
  } catch (error) {
    console.error('Error creating custom meal:', error);
    return NextResponse.json({ error: 'Failed to create custom meal' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user's custom meals from the new meals table
  const { data: customMeals, error } = await supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', user.id)
    .eq('is_user_created', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom meals:', error);
    return NextResponse.json({ error: 'Failed to fetch custom meals' }, { status: 500 });
  }

  // Transform to the format expected by the client
  const transformedMeals = customMeals.map(meal => ({
    id: meal.id,
    meal_name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    ingredients: meal.ingredients,
    is_user_created: meal.is_user_created,
    image_url: meal.image_url,
    share_with_community: meal.is_public,
    prep_time: meal.prep_time_minutes,
    meal_prep_instructions: meal.prep_instructions,
    created_at: meal.created_at,
  }));

  return NextResponse.json(transformedMeals);
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: UpdateCustomMealRequest = await request.json();

    // Validate request
    if (!body.id) {
      return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
    }

    if (!body.meal_name || typeof body.meal_name !== 'string' || body.meal_name.trim() === '') {
      return NextResponse.json({ error: 'Meal name is required' }, { status: 400 });
    }

    if (!body.ingredients || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
    }

    // Validate each ingredient has required fields
    for (const ingredient of body.ingredients) {
      if (!ingredient.name || typeof ingredient.name !== 'string') {
        return NextResponse.json({ error: 'Each ingredient must have a name' }, { status: 400 });
      }
      if (typeof ingredient.calories !== 'number' || ingredient.calories < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid calories' }, { status: 400 });
      }
      if (typeof ingredient.protein !== 'number' || ingredient.protein < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid protein' }, { status: 400 });
      }
      if (typeof ingredient.carbs !== 'number' || ingredient.carbs < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid carbs' }, { status: 400 });
      }
      if (typeof ingredient.fat !== 'number' || ingredient.fat < 0) {
        return NextResponse.json({ error: 'Each ingredient must have valid fat' }, { status: 400 });
      }
    }

    // Check if user has community enabled - if so, auto-share by default
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('social_feed_enabled')
      .eq('id', user.id)
      .single();

    // Auto-share if user has community enabled, unless explicitly set to false
    const shouldShare = body.share_with_community ?? profile?.social_feed_enabled ?? false;

    // Calculate total macros from ingredients
    const totalCalories = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.calories, 0));
    const totalProtein = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.protein, 0) * 10) / 10;
    const totalCarbs = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.carbs, 0) * 10) / 10;
    const totalFat = Math.round(body.ingredients.reduce((sum, ing) => sum + ing.fat, 0) * 10) / 10;

    // Convert ingredients to the normalized format
    const normalizedIngredients: IngredientWithNutrition[] = body.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount || '1',
      unit: ing.unit || 'serving',
      category: ing.category || 'other',
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
    }));

    // Update the meal
    const { data: updatedMeal, error: updateError } = await supabase
      .from('meals')
      .update({
        name: body.meal_name.trim(),
        name_normalized: normalizeForMatching(body.meal_name),
        meal_type: body.meal_type || 'dinner',
        ingredients: normalizedIngredients,
        instructions: body.instructions || [],
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        prep_time_minutes: prepTimeToMinutes(body.prep_time),
        prep_instructions: body.meal_prep_instructions || null,
        is_public: shouldShare,
        image_url: body.image_url || null,
        is_nutrition_edited_by_user: true,
      })
      .eq('id', body.id)
      .eq('source_user_id', user.id)
      .eq('is_user_created', true)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating custom meal:', updateError);
      return NextResponse.json({ error: 'Failed to update custom meal' }, { status: 500 });
    }

    // Handle social feed post based on sharing setting
    if (shouldShare && profile?.social_feed_enabled) {
      // Create or update feed post
      await supabase.from('social_feed_posts').upsert({
        user_id: user.id,
        source_type: 'custom_meal',
        source_meal_id: updatedMeal.id,
        meal_name: updatedMeal.name,
        calories: updatedMeal.calories,
        protein: updatedMeal.protein,
        carbs: updatedMeal.carbs,
        fat: updatedMeal.fat,
        image_url: updatedMeal.image_url,
        prep_time: updatedMeal.prep_time_minutes,
        ingredients: updatedMeal.ingredients,
        meal_prep_instructions: updatedMeal.prep_instructions,
      }, {
        onConflict: 'user_id,source_type,source_meal_id',
        ignoreDuplicates: false,
      });
    } else {
      // Remove from feed if sharing disabled
      await supabase
        .from('social_feed_posts')
        .delete()
        .eq('user_id', user.id)
        .eq('source_type', 'custom_meal')
        .eq('source_meal_id', updatedMeal.id);
    }

    // Return in a format compatible with the old API for the client
    return NextResponse.json({
      id: updatedMeal.id,
      meal_name: updatedMeal.name,
      calories: updatedMeal.calories,
      protein: updatedMeal.protein,
      carbs: updatedMeal.carbs,
      fat: updatedMeal.fat,
      ingredients: updatedMeal.ingredients,
      is_user_created: updatedMeal.is_user_created,
      image_url: updatedMeal.image_url,
      share_with_community: updatedMeal.is_public,
      prep_time: updatedMeal.prep_time_minutes,
      meal_prep_instructions: updatedMeal.prep_instructions,
      created_at: updatedMeal.created_at,
    });
  } catch (error) {
    console.error('Error updating custom meal:', error);
    return NextResponse.json({ error: 'Failed to update custom meal' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mealId = searchParams.get('id');

    if (!mealId) {
      return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
    }

    // Delete from social feed first (if exists)
    await supabase
      .from('social_feed_posts')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'custom_meal')
      .eq('source_meal_id', mealId);

    // Delete the meal
    const { error: deleteError } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)
      .eq('source_user_id', user.id)
      .eq('is_user_created', true);

    if (deleteError) {
      console.error('Error deleting custom meal:', deleteError);
      return NextResponse.json({ error: 'Failed to delete custom meal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom meal:', error);
    return NextResponse.json({ error: 'Failed to delete custom meal' }, { status: 500 });
  }
}
