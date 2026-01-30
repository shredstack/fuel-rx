/**
 * Meal Plan Service
 *
 * Handles operations for normalized meal plans.
 * Creates meal plans with linked meals and computes grocery lists.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  MealEntity,
  MealPlanMeal,
  MealPlanNormalized,
  DayPlanNormalized,
  MealSlot,
  Macros,
  Ingredient,
  DayOfWeek,
  MealType,
  CoreIngredients,
  MealPlanTheme,
  IngredientCategory,
  CoreIngredientItem,
  GroceryItemWithContext,
  ContextualGroceryList,
  HouseholdServingsPrefs,
} from '@/lib/types';
import { getCoreIngredientName, CHILD_PORTION_MULTIPLIER } from '@/lib/types';
import { saveMealsWithDeduplication, type GeneratedMeal } from './meal-service';

const DAYS_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

/**
 * Maps grocery list ingredient categories to core ingredient categories.
 * Returns null if the ingredient doesn't map to a core category.
 */
function mapIngredientToCoreCategory(
  ingredientCategory: string,
  ingredientName: string
): IngredientCategory | null {
  // Direct mappings
  switch (ingredientCategory) {
    case 'protein':
      return 'proteins';
    case 'dairy':
      return 'dairy';
    case 'grains':
      return 'grains';
    case 'produce':
      // Try to distinguish between vegetables and fruits
      // Common fruits (can expand this list)
      const fruitPatterns = [
        'apple', 'banana', 'orange', 'berry', 'berries', 'strawberry', 'blueberry',
        'raspberry', 'grape', 'mango', 'pineapple', 'melon', 'watermelon', 'peach',
        'pear', 'plum', 'cherry', 'kiwi', 'lemon', 'lime', 'grapefruit', 'avocado',
        'coconut', 'fig', 'date', 'pomegranate', 'papaya', 'passion fruit',
      ];
      const lowerName = ingredientName.toLowerCase();
      if (fruitPatterns.some(fruit => lowerName.includes(fruit))) {
        return 'fruits';
      }
      return 'vegetables';
    case 'pantry':
      // Pantry items that are fats
      const fatPatterns = [
        'oil', 'butter', 'ghee', 'lard', 'mayo', 'mayonnaise', 'nut butter',
        'almond butter', 'peanut butter', 'tahini', 'coconut oil', 'olive oil',
      ];
      const lowerPantryName = ingredientName.toLowerCase();
      if (fatPatterns.some(fat => lowerPantryName.includes(fat))) {
        return 'fats';
      }
      // Other pantry items don't map to core ingredients
      return null;
    default:
      return null;
  }
}

/**
 * Extracts potential core ingredients from a meal's ingredients.
 * Only includes ingredients that map to core categories (proteins, vegetables, fruits, grains, fats, dairy).
 */
export function extractCoreIngredientsFromMeal(meal: MealEntity): Partial<Record<IngredientCategory, string[]>> {
  const result: Partial<Record<IngredientCategory, string[]>> = {};

  for (const ingredient of meal.ingredients) {
    const coreCategory = mapIngredientToCoreCategory(ingredient.category, ingredient.name);
    if (coreCategory) {
      if (!result[coreCategory]) {
        result[coreCategory] = [];
      }
      // Normalize the name for comparison
      const normalizedName = ingredient.name.toLowerCase().trim();
      if (!result[coreCategory]!.includes(normalizedName)) {
        result[coreCategory]!.push(normalizedName);
      }
    }
  }

  return result;
}

/**
 * Merges new ingredients into existing core ingredients, marking new ones as swapped.
 * Returns the updated core ingredients and a flag indicating if any changes were made.
 */
export function mergeCoreIngredients(
  existing: CoreIngredients | null | undefined,
  newIngredients: Partial<Record<IngredientCategory, string[]>>
): { updated: CoreIngredients; hasChanges: boolean } {
  // Start with existing or empty structure
  const updated: CoreIngredients = existing
    ? {
        proteins: [...existing.proteins],
        vegetables: [...existing.vegetables],
        fruits: [...existing.fruits],
        grains: [...existing.grains],
        fats: [...existing.fats],
        dairy: [...existing.dairy],
      }
    : {
        proteins: [],
        vegetables: [],
        fruits: [],
        grains: [],
        fats: [],
        dairy: [],
      };

  let hasChanges = false;

  // Check each category for new ingredients
  const categories: IngredientCategory[] = ['proteins', 'vegetables', 'fruits', 'grains', 'fats', 'dairy'];

  for (const category of categories) {
    const newItems = newIngredients[category] || [];
    const existingItems = updated[category];

    // Get normalized names of existing items for comparison
    const existingNames = new Set(
      existingItems.map((item: CoreIngredientItem) => getCoreIngredientName(item).toLowerCase().trim())
    );

    for (const newItem of newItems) {
      const normalizedNew = newItem.toLowerCase().trim();
      if (!existingNames.has(normalizedNew)) {
        // This is a new ingredient - add it with swapped tag
        // Use the original casing from the ingredient name (capitalize first letter)
        const displayName = newItem.charAt(0).toUpperCase() + newItem.slice(1);
        updated[category].push({ name: displayName, swapped: true });
        hasChanges = true;
      }
    }
  }

  return { updated, hasChanges };
}

/**
 * Create a meal plan and link all meals via meal_plan_meals junction table.
 * This is the main function used during meal plan generation.
 */
export async function createMealPlanWithLinks(
  userId: string,
  mealsPerDay: Map<string, GeneratedMeal>, // key: "day_mealType_position", e.g., "monday_breakfast_0"
  options: {
    weekStartDate: string;
    themeId?: string;
    coreIngredients?: CoreIngredients;
    title?: string;
  }
): Promise<{ mealPlanId: string; mealPlanMeals: MealPlanMeal[] }> {
  const supabase = await createClient();

  // First, save all unique meals with deduplication
  const allMeals = Array.from(mealsPerDay.values());
  const savedMeals = await saveMealsWithDeduplication(allMeals, userId, {
    themeId: options.themeId,
  });

  // Create the meal plan
  const { data: mealPlan, error: planError } = await supabase
    .from('meal_plans')
    .insert({
      user_id: userId,
      week_start_date: options.weekStartDate,
      theme_id: options.themeId,
      core_ingredients: options.coreIngredients,
      title: options.title,
      is_favorite: false,
    })
    .select()
    .single();

  if (planError || !mealPlan) {
    throw new Error(`Failed to create meal plan: ${planError?.message}`);
  }

  // Create meal_plan_meals links
  const mealPlanMealsToInsert: Array<{
    meal_plan_id: string;
    meal_id: string;
    day: DayOfWeek;
    meal_type: MealType;
    snack_number: number | null;
    position: number;
    is_original: boolean;
  }> = [];

  for (const [key, meal] of mealsPerDay.entries()) {
    // Parse key: "monday_breakfast_0"
    const parts = key.split('_');
    const day = parts[0] as DayOfWeek;
    const mealType = parts[1] as MealType;
    const position = parseInt(parts[2], 10);

    // Find the saved meal
    const mealKey = `${meal.type}_${meal.name.toLowerCase().trim()}`;
    const savedMealResult = savedMeals.get(mealKey);

    if (!savedMealResult) {
      console.error(`Could not find saved meal for key: ${mealKey}`);
      continue;
    }

    mealPlanMealsToInsert.push({
      meal_plan_id: mealPlan.id,
      meal_id: savedMealResult.meal.id,
      day,
      meal_type: mealType,
      snack_number: mealType === 'snack' ? position + 1 : null,
      position,
      is_original: true,
    });
  }

  const { data: mealPlanMeals, error: linksError } = await supabase
    .from('meal_plan_meals')
    .insert(mealPlanMealsToInsert)
    .select();

  if (linksError) {
    throw new Error(`Failed to create meal plan meal links: ${linksError.message}`);
  }

  return {
    mealPlanId: mealPlan.id,
    mealPlanMeals: mealPlanMeals as MealPlanMeal[],
  };
}

/**
 * Get a normalized meal plan with all meals expanded.
 * This is the main function for fetching a meal plan for display.
 */
export async function getMealPlanNormalized(mealPlanId: string): Promise<MealPlanNormalized | null> {
  const supabase = await createClient();

  // Fetch meal plan
  const { data: mealPlan, error: planError } = await supabase
    .from('meal_plans')
    .select(`
      id,
      user_id,
      week_start_date,
      title,
      theme_id,
      core_ingredients,
      is_favorite,
      created_at,
      shared_from_user_id,
      shared_from_user_name,
      meal_plan_themes (
        id,
        name,
        display_name,
        description,
        emoji,
        ingredient_guidance,
        cooking_style_guidance,
        meal_name_style,
        compatible_diets,
        incompatible_diets,
        peak_seasons,
        is_system_theme,
        is_active,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('id', mealPlanId)
    .single();

  if (planError || !mealPlan) {
    console.error('Error fetching meal plan:', planError);
    return null;
  }

  // Fetch all meal_plan_meals with their linked meals
  // Note: We use meals!meal_plan_meals_meal_id_fkey to explicitly specify which FK to use
  // since meal_plan_meals has two FKs to meals (meal_id and swapped_from_meal_id)
  const { data: mealPlanMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      meal_plan_id,
      meal_id,
      day,
      meal_type,
      snack_number,
      position,
      is_original,
      swapped_from_meal_id,
      swapped_at,
      created_at,
      updated_at,
      meals!meal_plan_meals_meal_id_fkey (
        id,
        name,
        name_normalized,
        meal_type,
        ingredients,
        instructions,
        calories,
        protein,
        carbs,
        fat,
        prep_time_minutes,
        prep_instructions,
        is_user_created,
        is_nutrition_edited_by_user,
        source_type,
        source_user_id,
        source_meal_plan_id,
        is_public,
        theme_id,
        theme_name,
        times_used,
        times_swapped_in,
        times_swapped_out,
        image_url,
        created_at,
        updated_at
      )
    `)
    .eq('meal_plan_id', mealPlanId)
    .order('day')
    .order('meal_type')
    .order('position');

  if (mealsError) {
    console.error('Error fetching meal plan meals:', mealsError);
    return null;
  }

  // Compute grocery list
  const groceryList = await computeGroceryListFromPlan(mealPlanId);

  // Organize meals into days
  const daysMap = new Map<DayOfWeek, MealSlot[]>();

  for (const mpm of mealPlanMeals || []) {
    const day = mpm.day as DayOfWeek;
    if (!daysMap.has(day)) {
      daysMap.set(day, []);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mealData = mpm.meals as any;
    if (!mealData) continue;

    const slot: MealSlot = {
      id: mpm.id,
      meal: {
        ...mealData,
        meal_type: mealData.meal_type as MealType,
      } as MealEntity,
      meal_type: mpm.meal_type as MealType,
      snack_number: mpm.snack_number ?? undefined,
      position: mpm.position,
      is_original: mpm.is_original,
      swapped_at: mpm.swapped_at ?? undefined,
    };

    daysMap.get(day)!.push(slot);
  }

  // Create days array in order
  const days: DayPlanNormalized[] = DAYS_ORDER.map((day) => {
    const meals = daysMap.get(day) || [];

    // Sort meals by meal type order, then by position
    meals.sort((a, b) => {
      const typeOrderA = MEAL_TYPE_ORDER.indexOf(a.meal_type);
      const typeOrderB = MEAL_TYPE_ORDER.indexOf(b.meal_type);
      if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
      return a.position - b.position;
    });

    // Calculate daily totals
    const daily_totals = meals.reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.meal.calories,
        protein: acc.protein + slot.meal.protein,
        carbs: acc.carbs + slot.meal.carbs,
        fat: acc.fat + slot.meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      day,
      meals,
      daily_totals,
    };
  });

  return {
    id: mealPlan.id,
    user_id: mealPlan.user_id,
    week_start_date: mealPlan.week_start_date,
    title: mealPlan.title ?? undefined,
    theme_id: mealPlan.theme_id ?? undefined,
    // meal_plan_themes comes back as a single object when using FK relation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: (mealPlan.meal_plan_themes as any) as MealPlanTheme | undefined,
    core_ingredients: mealPlan.core_ingredients as CoreIngredients | undefined,
    is_favorite: mealPlan.is_favorite,
    created_at: mealPlan.created_at,
    shared_from_user_id: mealPlan.shared_from_user_id ?? undefined,
    shared_from_user_name: mealPlan.shared_from_user_name ?? undefined,
    days,
    grocery_list: groceryList,
  };
}

/**
 * Compute grocery list from linked meals using database function.
 */
export async function computeGroceryListFromPlan(mealPlanId: string): Promise<Ingredient[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('compute_grocery_list', {
    p_meal_plan_id: mealPlanId,
  });

  if (error) {
    console.error('Error computing grocery list:', error);
    return [];
  }

  return (data || []) as Ingredient[];
}

/**
 * Compute contextual grocery list from linked meals using database function.
 * Returns items with meal references instead of calculated totals.
 */
export async function computeContextualGroceryList(
  mealPlanId: string
): Promise<GroceryItemWithContext[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('compute_grocery_list_with_context', {
    p_meal_plan_id: mealPlanId,
  });

  if (error) {
    console.error('Error computing contextual grocery list:', error);
    return [];
  }

  return (data || []) as GroceryItemWithContext[];
}

/**
 * Check if household servings preferences indicate additional household members.
 */
export function hasHouseholdMembers(servings: HouseholdServingsPrefs): boolean {
  for (const day of DAYS_ORDER) {
    const dayServings = servings[day];
    if (!dayServings) continue;

    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
      const mealServings = dayServings[mealType];
      if (mealServings && (mealServings.adults > 0 || mealServings.children > 0)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get a human-readable description of household composition.
 * e.g., "2 adults + 1 child" or "1 adult + 3 children"
 */
export function getHouseholdDescription(servings: HouseholdServingsPrefs): string {
  // Find the most common configuration across all days/meals
  let maxAdults = 0;
  let maxChildren = 0;

  for (const day of DAYS_ORDER) {
    const dayServings = servings[day];
    if (!dayServings) continue;

    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
      const mealServings = dayServings[mealType];
      if (mealServings) {
        maxAdults = Math.max(maxAdults, mealServings.adults);
        maxChildren = Math.max(maxChildren, mealServings.children);
      }
    }
  }

  const parts: string[] = [];

  // Always include 1 for the user themselves
  const totalAdults = 1 + maxAdults;
  parts.push(`${totalAdults} adult${totalAdults > 1 ? 's' : ''}`);

  if (maxChildren > 0) {
    parts.push(`${maxChildren} child${maxChildren > 1 ? 'ren' : ''}`);
  }

  return parts.join(' + ');
}

/**
 * Calculate average serving multiplier for household.
 * Returns a multiplier where 1.0 = single person, 2.0 = double portions, etc.
 */
export function getAverageServingMultiplier(servings: HouseholdServingsPrefs): number {
  let totalMultiplier = 0;
  let mealCount = 0;

  for (const day of DAYS_ORDER) {
    const dayServings = servings[day];
    if (!dayServings) continue;

    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
      const mealServings = dayServings[mealType];
      if (mealServings) {
        // Base multiplier is 1 (for the user) + additional adults + (children * child multiplier)
        const multiplier = 1 + mealServings.adults + (mealServings.children * CHILD_PORTION_MULTIPLIER);
        totalMultiplier += multiplier;
        mealCount++;
      }
    }
  }

  return mealCount > 0 ? totalMultiplier / mealCount : 1;
}

/**
 * Get contextual grocery list with household information.
 * This is the main function for the grocery list page.
 */
export async function getContextualGroceryListWithHousehold(
  mealPlanId: string,
  userId: string
): Promise<ContextualGroceryList> {
  const supabase = await createClient();

  // Fetch grocery items and user profile in parallel
  const [groceryItems, profileResult] = await Promise.all([
    computeContextualGroceryList(mealPlanId),
    supabase
      .from('user_profiles')
      .select('household_servings')
      .eq('id', userId)
      .single()
  ]);

  // Process household info
  let householdInfo: ContextualGroceryList['householdInfo'] = undefined;

  if (profileResult.data?.household_servings) {
    const servings = profileResult.data.household_servings as HouseholdServingsPrefs;
    const hasHousehold = hasHouseholdMembers(servings);

    if (hasHousehold) {
      householdInfo = {
        hasHousehold: true,
        description: getHouseholdDescription(servings),
        avgMultiplier: getAverageServingMultiplier(servings),
      };
    }
  }

  return {
    items: groceryItems,
    householdInfo,
  };
}

/**
 * Compute daily macro totals using database function.
 */
export async function computeDailyTotals(mealPlanId: string): Promise<Record<DayOfWeek, Macros>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('compute_daily_totals', {
    p_meal_plan_id: mealPlanId,
  });

  if (error) {
    console.error('Error computing daily totals:', error);
    return {} as Record<DayOfWeek, Macros>;
  }

  return data as Record<DayOfWeek, Macros>;
}

/**
 * Swap a meal in a meal plan slot.
 * Updates the meal_plan_meals junction and tracks swap history.
 * Also updates core_ingredients if the new meal introduces new ingredients.
 */
export async function swapMeal(
  mealPlanMealId: string,
  newMealId: string,
  userId: string
): Promise<{
  success: boolean;
  swappedCount: number;
  updatedMealPlanMeals: MealPlanMeal[];
  newMeal?: MealEntity;
  updatedCoreIngredients?: CoreIngredients;
  message?: string;
}> {
  const supabase = await createClient();

  // Get the meal slot being swapped, including the meal plan's core_ingredients
  const { data: mealSlot, error: fetchError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      meal_id,
      meal_plan_id,
      day,
      meal_type,
      snack_number,
      meal_plans!inner(user_id, core_ingredients)
    `)
    .eq('id', mealPlanMealId)
    .single();

  if (fetchError || !mealSlot) {
    return { success: false, swappedCount: 0, updatedMealPlanMeals: [], message: 'Meal slot not found' };
  }

  // Verify user owns the meal plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((mealSlot.meal_plans as any).user_id !== userId) {
    return { success: false, swappedCount: 0, updatedMealPlanMeals: [], message: 'Unauthorized' };
  }

  // Check user's consistency preferences for this meal type
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('meal_consistency_prefs')
    .eq('id', userId)
    .single();

  const consistencyPrefs = (profile?.meal_consistency_prefs || {}) as Record<MealType, string>;
  const isConsistentMealType = consistencyPrefs[mealSlot.meal_type as MealType] === 'consistent';

  // Determine which meal slots to update
  let slotsToUpdate: string[] = [mealPlanMealId];

  if (isConsistentMealType) {
    // User wants same meal all week for this type - swap ALL instances with same meal
    const { data: allSlots } = await supabase
      .from('meal_plan_meals')
      .select('id')
      .eq('meal_plan_id', mealSlot.meal_plan_id)
      .eq('meal_type', mealSlot.meal_type)
      .eq('meal_id', mealSlot.meal_id);

    slotsToUpdate = allSlots?.map((s) => s.id) || [mealPlanMealId];
  }

  // Verify new meal exists and is accessible
  const { data: newMeal, error: mealError } = await supabase
    .from('meals')
    .select('*')
    .eq('id', newMealId)
    .or(`source_user_id.eq.${userId},is_public.eq.true`)
    .single();

  if (mealError || !newMeal) {
    return { success: false, swappedCount: 0, updatedMealPlanMeals: [], message: 'Meal not found or not accessible' };
  }

  // Perform the swap (all slots if consistent)
  const { data: updated, error: updateError } = await supabase
    .from('meal_plan_meals')
    .update({
      meal_id: newMealId,
      is_original: false,
      swapped_from_meal_id: mealSlot.meal_id,
      swapped_at: new Date().toISOString(),
    })
    .in('id', slotsToUpdate)
    .select();

  if (updateError) {
    return { success: false, swappedCount: 0, updatedMealPlanMeals: [], message: 'Failed to swap meal' };
  }

  // Update analytics
  await supabase.rpc('increment_meal_swap_counts', {
    p_swapped_in_id: newMealId,
    p_swapped_out_id: mealSlot.meal_id,
    p_swap_count: slotsToUpdate.length,
  });

  // Reset prep sessions for this meal plan (they'll regenerate when viewed)
  await supabase
    .from('prep_sessions')
    .delete()
    .eq('meal_plan_id', mealSlot.meal_plan_id);

  // Update core_ingredients if new meal introduces new ingredients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentCoreIngredients = (mealSlot.meal_plans as any).core_ingredients as CoreIngredients | null;
  const newMealIngredients = extractCoreIngredientsFromMeal(newMeal as MealEntity);
  const { updated: updatedCoreIngredients, hasChanges } = mergeCoreIngredients(
    currentCoreIngredients,
    newMealIngredients
  );

  // Only update the database if there are new ingredients
  if (hasChanges) {
    await supabase
      .from('meal_plans')
      .update({ core_ingredients: updatedCoreIngredients })
      .eq('id', mealSlot.meal_plan_id);
  }

  return {
    success: true,
    swappedCount: slotsToUpdate.length,
    updatedMealPlanMeals: updated as MealPlanMeal[],
    newMeal: newMeal as MealEntity,
    updatedCoreIngredients: hasChanges ? updatedCoreIngredients : undefined,
    message:
      slotsToUpdate.length > 1
        ? `Swapped ${slotsToUpdate.length} ${mealSlot.meal_type} meals (consistent preference)`
        : undefined,
  };
}

/**
 * Get swap candidates for a meal slot.
 * Returns meals in order: custom -> community -> previous
 */
export async function getSwapCandidates(
  userId: string,
  mealPlanId: string,
  options?: {
    mealType?: MealType;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ candidates: Array<{ meal: MealEntity; source: 'custom' | 'community' | 'previous' }>; total: number }> {
  const supabase = await createClient();
  const limit = options?.limit || 20;
  const candidates: Array<{ meal: MealEntity; source: 'custom' | 'community' | 'previous' }> = [];

  // Get meal IDs already in the current plan (to exclude)
  const { data: currentPlanMeals } = await supabase
    .from('meal_plan_meals')
    .select('meal_id')
    .eq('meal_plan_id', mealPlanId);

  const excludeMealIds = currentPlanMeals?.map((m) => m.meal_id) || [];
  const excludeClause = excludeMealIds.length > 0 ? excludeMealIds : ['00000000-0000-0000-0000-000000000000'];

  // 1. CUSTOM MEALS - User's own created meals (highest priority)
  let customQuery = supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', userId)
    .eq('is_user_created', true)
    .not('id', 'in', `(${excludeClause.join(',')})`);

  if (options?.mealType) {
    customQuery = customQuery.eq('meal_type', options.mealType);
  }
  if (options?.search) {
    customQuery = customQuery.ilike('name', `%${options.search}%`);
  }

  const { data: customMeals } = await customQuery.limit(limit);

  for (const meal of customMeals || []) {
    candidates.push({ meal: meal as MealEntity, source: 'custom' });
  }

  // 2. COMMUNITY MEALS - Meals shared by other users
  if (candidates.length < limit) {
    let communityQuery = supabase
      .from('meals')
      .select('*')
      .eq('is_public', true)
      .neq('source_user_id', userId)
      .not('id', 'in', `(${excludeClause.join(',')})`);

    if (options?.mealType) {
      communityQuery = communityQuery.eq('meal_type', options.mealType);
    }
    if (options?.search) {
      communityQuery = communityQuery.ilike('name', `%${options.search}%`);
    }

    const remainingLimit = limit - candidates.length;
    const { data: communityMeals } = await communityQuery.limit(remainingLimit);

    for (const meal of communityMeals || []) {
      candidates.push({ meal: meal as MealEntity, source: 'community' });
    }
  }

  // 3. PREVIOUS MEALS - Meals from user's past meal plans (AI-generated)
  if (candidates.length < limit) {
    const seenIds = new Set(candidates.map((c) => c.meal.id));

    let previousQuery = supabase
      .from('meals')
      .select('*')
      .eq('source_user_id', userId)
      .eq('is_user_created', false)
      .not('id', 'in', `(${excludeClause.join(',')})`);

    if (options?.mealType) {
      previousQuery = previousQuery.eq('meal_type', options.mealType);
    }
    if (options?.search) {
      previousQuery = previousQuery.ilike('name', `%${options.search}%`);
    }

    const { data: previousMeals } = await previousQuery.limit(limit - candidates.length);

    for (const meal of previousMeals || []) {
      if (!seenIds.has(meal.id)) {
        candidates.push({ meal: meal as MealEntity, source: 'previous' });
        seenIds.add(meal.id);
      }
    }
  }

  // Apply offset
  const offset = options?.offset || 0;
  const paginatedCandidates = candidates.slice(offset, offset + limit);

  return {
    candidates: paginatedCandidates,
    total: candidates.length,
  };
}
