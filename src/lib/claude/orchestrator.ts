import type {
  UserProfile,
  DayPlan,
  Ingredient,
  CoreIngredients,
  PrepModeResponse,
  Meal,
  MealPlanTheme,
  DayOfWeek,
  Macros,
} from '../types';
import { normalizeCoreIngredients } from '../types';
import { createClient } from '../supabase/server';
import { getTestConfig } from '../claude_test';
import { generateCoreIngredients } from './core-ingredients';
import { generateMealsFromCoreIngredients } from './meals-generation';
import { generateGroceryListFromCoreIngredients } from './grocery-list';
import { generatePrepSessions } from './prep-sessions';
import { organizeMealsIntoDays } from './helpers';

interface ValidatedMealMacros {
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Progress callback type for streaming updates
 */
export type ProgressCallback = (stage: string, message: string) => void;

/**
 * Main two-stage meal plan generation function
 * Orchestrates all three stages and returns a complete meal plan with prep sessions
 */
export async function generateMealPlanTwoStage(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[],
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  selectedTheme?: MealPlanTheme
): Promise<{
  days: DayPlan[];
  grocery_list: Ingredient[];
  core_ingredients: CoreIngredients;
  prep_sessions: PrepModeResponse;
}> {
  // Use the progress version with a no-op callback
  return generateMealPlanWithProgress(
    profile,
    userId,
    recentMealNames,
    mealPreferences,
    validatedMeals,
    ingredientPreferences,
    selectedTheme,
    () => {} // No-op progress callback
  );
}

/**
 * Main two-stage meal plan generation function WITH progress callbacks
 * Orchestrates all stages with streaming progress updates
 * Parallelizes grocery list and prep sessions for better performance
 */
export async function generateMealPlanWithProgress(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[],
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  selectedTheme?: MealPlanTheme,
  onProgress?: ProgressCallback
): Promise<{
  days: DayPlan[];
  grocery_list: Ingredient[];
  core_ingredients: CoreIngredients;
  prep_sessions: PrepModeResponse;
}> {
  const progress = onProgress || (() => {});

  // ===== TEST MODE: Check for fixture mode =====
  const testConfig = getTestConfig();
  if (testConfig.mode === 'fixture' && process.env.MEAL_PLAN_TEST_MODE) {
    console.log('[TEST MODE] FIXTURE MODE: Returning mock meal plan (no API calls)');
    const { FIXTURE_MEAL_PLAN, FIXTURE_GROCERY_LIST, FIXTURE_CORE_INGREDIENTS, FIXTURE_PREP_SESSIONS } = await import('../claude_test');
    return {
      days: FIXTURE_MEAL_PLAN,
      grocery_list: FIXTURE_GROCERY_LIST,
      core_ingredients: FIXTURE_CORE_INGREDIENTS,
      prep_sessions: FIXTURE_PREP_SESSIONS,
    };
  }

  // Log test mode if active
  if (testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    const { logTestMode, logSavings } = await import('../claude_test');
    logTestMode(testConfig);
    logSavings(testConfig);
  }
  // ===== END TEST MODE =====

  // Stage 1: Generate core ingredients (with theme)
  progress('ingredients', selectedTheme
    ? `Selecting ${selectedTheme.display_name} ingredients...`
    : 'Selecting ingredients based on your macros...');
  const coreIngredients = await generateCoreIngredients(
    profile,
    userId,
    recentMealNames,
    mealPreferences,
    ingredientPreferences,
    selectedTheme
  );
  progress('ingredients_done', 'Ingredients selected!');

  // Stage 2: Generate meals from core ingredients (with theme)
  progress('meals', selectedTheme
    ? `Creating your ${selectedTheme.display_name} meal plan...`
    : 'Creating your 7-day meal plan...');
  const mealsResult = await generateMealsFromCoreIngredients(
    profile,
    coreIngredients,
    userId,
    mealPreferences,
    validatedMeals,
    selectedTheme
  );
  progress('meals_done', 'Meals created!');

  // ===== TEST MODE: Handle day repetition =====
  let days: DayPlan[];
  if (!testConfig.generateFullWeek && testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    // Extract Monday meals and repeat across the week
    const { extractMondayMeals, repeatDayAcrossWeek } = await import('../claude_test');
    console.log('[TEST MODE] Repeating Monday meals across all 7 days...');
    const mondayMeals = extractMondayMeals(mealsResult);
    days = repeatDayAcrossWeek(mondayMeals);
  } else {
    // Normal full week organization
    days = organizeMealsIntoDays(mealsResult);
  }
  // ===== END TEST MODE =====

  // Stage 3: Generate grocery list AND prep sessions IN PARALLEL
  // This is a key performance optimization - these two tasks are independent
  progress('finalizing', 'Building grocery list and prep schedule...');

  // ===== TEST MODE: Skip prep sessions if configured =====
  let grocery_list: Ingredient[];
  let prep_sessions: PrepModeResponse;

  if (testConfig.skipPrepSessions && testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    console.log('[TEST MODE] Skipping prep sessions generation');
    grocery_list = await generateGroceryListFromCoreIngredients(coreIngredients, days, userId, profile);
    prep_sessions = { prepSessions: [], dailyAssembly: {} };
  } else {
    [grocery_list, prep_sessions] = await Promise.all([
      generateGroceryListFromCoreIngredients(coreIngredients, days, userId, profile),
      generatePrepSessions(days, coreIngredients, profile, userId),
    ]);
  }
  // ===== END TEST MODE =====

  progress('finalizing_done', 'Almost done!');

  return {
    days,
    grocery_list,
    core_ingredients: coreIngredients,
    prep_sessions,
  };
}

/**
 * Generate prep sessions for an existing meal plan
 * Can be called separately if prep mode wasn't generated initially
 */
export async function generatePrepModeForExistingPlan(
  mealPlanId: string,
  userId: string
): Promise<PrepModeResponse> {
  const supabase = await createClient();

  // Fetch the meal plan (normalized structure - no plan_data)
  const { data: mealPlan, error } = await supabase
    .from('meal_plans')
    .select('id, core_ingredients')
    .eq('id', mealPlanId)
    .eq('user_id', userId)
    .single();

  if (error || !mealPlan) {
    throw new Error('Meal plan not found');
  }

  // Fetch meal_plan_meals with their linked meals
  // Use explicit FK reference since there are two FKs to meals table
  const { data: mealPlanMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      day,
      meal_type,
      position,
      meals!meal_plan_meals_meal_id_fkey (
        id,
        name,
        meal_type,
        ingredients,
        instructions,
        calories,
        protein,
        carbs,
        fat,
        prep_time_minutes
      )
    `)
    .eq('meal_plan_id', mealPlanId)
    .order('day')
    .order('meal_type')
    .order('position');

  if (mealsError) {
    throw new Error('Failed to fetch meal plan meals');
  }

  // Fetch user profile for prep preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Convert normalized meals to DayPlan[] format for generatePrepSessions
  type DayOfWeekType = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  const DAYS_ORDER: DayOfWeekType[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const daysMap = new Map<DayOfWeekType, Meal[]>();

  for (const mpm of mealPlanMeals || []) {
    const day = mpm.day as DayOfWeekType;
    if (!daysMap.has(day)) {
      daysMap.set(day, []);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mealData = mpm.meals as any;
    if (!mealData) continue;

    const meal: Meal = {
      name: mealData.name,
      type: mealData.meal_type,
      prep_time_minutes: mealData.prep_time_minutes,
      ingredients: mealData.ingredients,
      instructions: mealData.instructions,
      macros: {
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
      },
    };

    daysMap.get(day)!.push(meal);
  }

  // Build days array in proper order
  const days: DayPlan[] = DAYS_ORDER.map(day => ({
    day,
    meals: daysMap.get(day) || [],
    daily_totals: (daysMap.get(day) || []).reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 } as Macros
    ),
  }));

  const rawCoreIngredients = mealPlan.core_ingredients as Record<string, string[]> | null;

  // Normalize core ingredients to handle legacy 'pantry' field
  const ingredients: CoreIngredients = normalizeCoreIngredients(rawCoreIngredients) || {
    proteins: [],
    vegetables: [],
    fruits: [],
    grains: [],
    fats: [],
    dairy: [],
  };

  return generatePrepSessions(days, ingredients, profile as UserProfile, userId);
}
