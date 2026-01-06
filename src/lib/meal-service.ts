/**
 * Meal Service
 *
 * Handles CRUD operations for the normalized meals table.
 * Includes deduplication logic for meal plan generation.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  MealEntity,
  MealType,
  IngredientWithNutrition,
  MealSourceType,
} from '@/lib/types';

/**
 * Normalize meal name for comparison and deduplication.
 * Lowercase and trim whitespace.
 */
export function normalizeForMatching(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Generated meal from LLM (before saving to database)
 */
export interface GeneratedMeal {
  name: string;
  type: MealType;
  prep_time_minutes: number;
  ingredients: IngredientWithNutrition[];
  instructions: string[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Result of saving a meal with deduplication
 */
export interface MealDeduplicationResult {
  meal: MealEntity;
  isNew: boolean;
  matchedExistingId?: string;
}

/**
 * Save a meal with deduplication.
 * If a meal with the same normalized name exists for this user, reuse it.
 * Otherwise, create a new meal.
 */
export async function saveMealWithDeduplication(
  meal: GeneratedMeal,
  userId: string,
  options?: {
    themeId?: string;
    themeName?: string;
    sourceMealPlanId?: string;
  }
): Promise<MealDeduplicationResult> {
  const supabase = await createClient();
  const normalizedName = normalizeForMatching(meal.name);

  // Check for existing meal with identical normalized name for this user
  const { data: existing } = await supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', userId)
    .eq('name_normalized', normalizedName)
    .single();

  if (existing) {
    // Meal exists - increment usage count and return existing
    await supabase
      .from('meals')
      .update({ times_used: existing.times_used + 1 })
      .eq('id', existing.id);

    return {
      meal: existing as MealEntity,
      isNew: false,
      matchedExistingId: existing.id,
    };
  }

  // No match - create new meal
  const { data: newMeal, error } = await supabase
    .from('meals')
    .insert({
      name: meal.name,
      name_normalized: normalizedName,
      meal_type: meal.type,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      calories: meal.macros.calories,
      protein: meal.macros.protein,
      carbs: meal.macros.carbs,
      fat: meal.macros.fat,
      prep_time_minutes: meal.prep_time_minutes,
      source_type: 'ai_generated' as MealSourceType,
      source_user_id: userId,
      source_meal_plan_id: options?.sourceMealPlanId,
      is_user_created: false,
      is_nutrition_edited_by_user: false,
      theme_id: options?.themeId,
      theme_name: options?.themeName,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save meal: ${error.message}`);
  }

  return { meal: newMeal as MealEntity, isNew: true };
}

/**
 * Batch save meals with deduplication.
 * Used during meal plan generation.
 * Returns a map of meal key (type_normalizedName) to result.
 */
export async function saveMealsWithDeduplication(
  meals: GeneratedMeal[],
  userId: string,
  options?: {
    themeId?: string;
    themeName?: string;
    sourceMealPlanId?: string;
  }
): Promise<Map<string, MealDeduplicationResult>> {
  const results = new Map<string, MealDeduplicationResult>();

  for (const meal of meals) {
    const key = `${meal.type}_${normalizeForMatching(meal.name)}`;

    // Skip if we already processed this meal (same name + type in this batch)
    if (results.has(key)) {
      continue;
    }

    const result = await saveMealWithDeduplication(meal, userId, options);
    results.set(key, result);
  }

  return results;
}

/**
 * Get a meal by ID
 */
export async function getMealById(mealId: string): Promise<MealEntity | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('id', mealId)
    .single();

  if (error) {
    console.error('Error fetching meal:', error);
    return null;
  }

  return data as MealEntity;
}

/**
 * Get all meals for a user with optional filters
 */
export async function getUserMeals(
  userId: string,
  options?: {
    mealType?: MealType;
    isUserCreated?: boolean;
    isPublic?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<MealEntity[]> {
  const supabase = await createClient();

  let query = supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', userId);

  if (options?.mealType) {
    query = query.eq('meal_type', options.mealType);
  }

  if (options?.isUserCreated !== undefined) {
    query = query.eq('is_user_created', options.isUserCreated);
  }

  if (options?.isPublic !== undefined) {
    query = query.eq('is_public', options.isPublic);
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user meals:', error);
    return [];
  }

  return data as MealEntity[];
}

/**
 * Get public meals from community (excluding user's own)
 */
export async function getCommunityMeals(
  userId: string,
  options?: {
    mealType?: MealType;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<MealEntity[]> {
  const supabase = await createClient();

  let query = supabase
    .from('meals')
    .select('*')
    .eq('is_public', true)
    .neq('source_user_id', userId);

  if (options?.mealType) {
    query = query.eq('meal_type', options.mealType);
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  query = query.order('times_used', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching community meals:', error);
    return [];
  }

  return data as MealEntity[];
}

/**
 * Create a new custom meal (user-created)
 */
export async function createCustomMeal(
  userId: string,
  mealData: {
    name: string;
    mealType: MealType;
    ingredients: IngredientWithNutrition[];
    instructions: string[];
    prepTimeMinutes: number;
    prepInstructions?: string;
    isPublic?: boolean;
    imageUrl?: string;
  }
): Promise<MealEntity> {
  const supabase = await createClient();

  // Calculate macros from ingredients
  const macros = mealData.ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories || 0),
      protein: acc.protein + (ing.protein || 0),
      carbs: acc.carbs + (ing.carbs || 0),
      fat: acc.fat + (ing.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const { data, error } = await supabase
    .from('meals')
    .insert({
      name: mealData.name,
      name_normalized: normalizeForMatching(mealData.name),
      meal_type: mealData.mealType,
      ingredients: mealData.ingredients,
      instructions: mealData.instructions,
      calories: Math.round(macros.calories),
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fat: Math.round(macros.fat),
      prep_time_minutes: mealData.prepTimeMinutes,
      prep_instructions: mealData.prepInstructions,
      source_type: 'user_created' as MealSourceType,
      source_user_id: userId,
      is_user_created: true,
      is_nutrition_edited_by_user: false,
      is_public: mealData.isPublic || false,
      image_url: mealData.imageUrl,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create custom meal: ${error.message}`);
  }

  return data as MealEntity;
}

/**
 * Update a meal
 */
export async function updateMeal(
  mealId: string,
  userId: string,
  updates: Partial<{
    name: string;
    mealType: MealType;
    ingredients: IngredientWithNutrition[];
    instructions: string[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    prepTimeMinutes: number;
    prepInstructions: string;
    isPublic: boolean;
    imageUrl: string;
    isNutritionEditedByUser: boolean;
  }>
): Promise<MealEntity> {
  const supabase = await createClient();

  // Build update object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  if (updates.name !== undefined) {
    updateData.name = updates.name;
    updateData.name_normalized = normalizeForMatching(updates.name);
  }
  if (updates.mealType !== undefined) updateData.meal_type = updates.mealType;
  if (updates.ingredients !== undefined) updateData.ingredients = updates.ingredients;
  if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
  if (updates.calories !== undefined) updateData.calories = updates.calories;
  if (updates.protein !== undefined) updateData.protein = updates.protein;
  if (updates.carbs !== undefined) updateData.carbs = updates.carbs;
  if (updates.fat !== undefined) updateData.fat = updates.fat;
  if (updates.prepTimeMinutes !== undefined) updateData.prep_time_minutes = updates.prepTimeMinutes;
  if (updates.prepInstructions !== undefined) updateData.prep_instructions = updates.prepInstructions;
  if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
  if (updates.isNutritionEditedByUser !== undefined) {
    updateData.is_nutrition_edited_by_user = updates.isNutritionEditedByUser;
  }

  const { data, error } = await supabase
    .from('meals')
    .update(updateData)
    .eq('id', mealId)
    .eq('source_user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update meal: ${error.message}`);
  }

  return data as MealEntity;
}

/**
 * Delete a meal
 */
export async function deleteMeal(mealId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)
    .eq('source_user_id', userId);

  if (error) {
    throw new Error(`Failed to delete meal: ${error.message}`);
  }
}
