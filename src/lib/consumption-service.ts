/**
 * Consumption Tracking Service
 *
 * Handles all operations for logging and retrieving meal/ingredient consumption.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  ConsumptionEntry,
  DailyConsumptionSummary,
  AvailableMealsToLog,
  MealToLog,
  MealPlanMealToLog,
  IngredientToLog,
  FrequentIngredient,
  LogMealRequest,
  LogIngredientRequest,
  MealType,
  Macros,
  ConsumptionEntryType,
  MealTypeBreakdown,
  FruitVegProgress,
  WaterProgress,
  IngredientCategoryType,
  ConsumptionSummaryData,
  WeeklySummaryDataPoint,
  ContributorItem,
  MacroContributors,
  TopContributorsData,
} from '@/lib/types';

// Categories that count toward the 800g goal
const FRUIT_VEG_CATEGORIES = ['fruit', 'vegetable'];
const FRUIT_VEG_GOAL_GRAMS = 800;

// Water intake goal for CrossFit athletes (in ounces)
const WATER_GOAL_OUNCES = 100;

// Helper to normalize ingredient names for matching
function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim();
}

// Helper to get week start (Monday) from a date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to get week start (Monday) from a date string (YYYY-MM-DD)
// This avoids timezone issues by parsing the date components directly
function getWeekStartFromDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date at noon UTC to avoid any DST issues
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = date.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is 1, Sunday is 0
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split('T')[0];
}

// Helper to get week end (Sunday) from a week start date string (YYYY-MM-DD)
function getWeekEndFromDateStr(weekStartStr: string): string {
  const [year, month, day] = weekStartStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 6, 12, 0, 0));
  return date.toISOString().split('T')[0];
}

// Helper to get month bounds as date strings (avoids timezone issues)
function getMonthBoundsAsStrings(year: number, month: number): { startStr: string; endStr: string; dayCount: number } {
  // First day of month
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  // Last day of month - create date at day 0 of next month
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  const endStr = lastDay.toISOString().split('T')[0];
  const dayCount = lastDay.getUTCDate();
  return { startStr, endStr, dayCount };
}

// Helper to get day of week name from a date string (YYYY-MM-DD)
function getDayOfWeekFromDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date at noon UTC to avoid any DST issues
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getUTCDay()];
}

/**
 * Log a meal as consumed.
 * Fetches meal details from source and creates consumption entry with macro snapshot.
 */
export async function logMealConsumed(
  userId: string,
  request: LogMealRequest
): Promise<ConsumptionEntry> {
  const supabase = await createClient();

  // Fetch meal details based on type
  let mealData: {
    name: string;
    meal_type: MealType;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  let mealPlanMealId: string | null = null;
  let mealId: string | null = null;

  if (request.type === 'meal_plan') {
    // Try to fetch from meal_plan_meals with joined meal data
    const { data, error } = await supabase
      .from('meal_plan_meals')
      .select(
        `
        id,
        meal_id,
        meals!inner(
          name,
          meal_type,
          calories,
          protein,
          carbs,
          fat
        ),
        meal_plans!inner(user_id)
      `
      )
      .eq('id', request.source_id)
      .single();

    if (error || !data) {
      // Fallback: If meal_plan_meals record not found but we have meal_id, fetch from meals directly
      if (request.meal_id) {
        const { data: mealDirectData, error: mealDirectError } = await supabase
          .from('meals')
          .select('id, name, meal_type, calories, protein, carbs, fat, source_user_id')
          .eq('id', request.meal_id)
          .single();

        if (mealDirectError || !mealDirectData) throw new Error('Meal not found');
        if (mealDirectData.source_user_id !== userId) throw new Error('Unauthorized');

        mealData = mealDirectData;
        mealId = mealDirectData.id;
        // mealPlanMealId stays null since the record doesn't exist
      } else {
        throw new Error('Meal not found');
      }
    } else {
      const mealPlanData = data.meal_plans as unknown as { user_id: string };
      if (mealPlanData.user_id !== userId) throw new Error('Unauthorized');

      const mealRecord = data.meals as unknown as {
        name: string;
        meal_type: MealType;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      };
      mealData = mealRecord;
      mealPlanMealId = data.id;
      mealId = data.meal_id;
    }
  } else {
    // Fetch from meals table (custom_meal or quick_cook)
    const { data, error } = await supabase
      .from('meals')
      .select('id, name, meal_type, calories, protein, carbs, fat, source_user_id')
      .eq('id', request.source_id)
      .single();

    if (error || !data) throw new Error('Meal not found');
    if (data.source_user_id !== userId) throw new Error('Unauthorized');

    mealData = data;
    mealId = data.id;
  }

  const consumedAt = request.consumed_at || new Date().toISOString();
  const consumedDate = consumedAt.split('T')[0];

  // Use custom macros if provided (user modified portions), otherwise use source meal's macros
  const macros = request.custom_macros || {
    calories: mealData.calories,
    protein: mealData.protein,
    carbs: mealData.carbs,
    fat: mealData.fat,
  };

  // Create consumption entry with macro snapshot
  // Use request.meal_type override if provided, otherwise use source meal's type
  const { data: entry, error: insertError } = await supabase
    .from('meal_consumption_log')
    .insert({
      user_id: userId,
      entry_type: request.type,
      meal_plan_meal_id: mealPlanMealId,
      meal_id: mealId,
      consumed_at: consumedAt,
      consumed_date: consumedDate,
      display_name: mealData.name,
      meal_type: request.meal_type || mealData.meal_type,
      calories: Math.round(macros.calories),
      protein: Math.round(macros.protein * 10) / 10,
      carbs: Math.round(macros.carbs * 10) / 10,
      fat: Math.round(macros.fat * 10) / 10,
      notes: request.notes,
    })
    .select()
    .single();

  if (insertError) throw new Error(`Failed to log meal: ${insertError.message}`);

  return entry as ConsumptionEntry;
}

/**
 * Log an ingredient as consumed.
 * Also updates user_frequent_ingredients for quick-add.
 */
export async function logIngredientConsumed(
  userId: string,
  request: LogIngredientRequest
): Promise<ConsumptionEntry> {
  const supabase = await createClient();

  const consumedAt = request.consumed_at || new Date().toISOString();
  const consumedDate = consumedAt.split('T')[0];

  // Create consumption entry
  const { data: entry, error: insertError } = await supabase
    .from('meal_consumption_log')
    .insert({
      user_id: userId,
      entry_type: 'ingredient',
      ingredient_name: request.ingredient_name,
      consumed_at: consumedAt,
      consumed_date: consumedDate,
      display_name: request.ingredient_name,
      meal_type: request.meal_type,
      amount: request.amount,
      unit: request.unit,
      calories: Math.round(request.calories),
      protein: Math.round(request.protein * 10) / 10,
      carbs: Math.round(request.carbs * 10) / 10,
      fat: Math.round(request.fat * 10) / 10,
      notes: request.notes,
      // 800g Challenge tracking
      grams: request.grams,
      ingredient_category: request.category,
    })
    .select()
    .single();

  if (insertError) throw new Error(`Failed to log ingredient: ${insertError.message}`);

  // Update frequent ingredients
  await upsertFrequentIngredient(userId, request.ingredient_name, request.amount, request.unit, {
    calories: request.calories,
    protein: request.protein,
    carbs: request.carbs,
    fat: request.fat,
  }, request.category, request.grams);

  return entry as ConsumptionEntry;
}

/**
 * Log multiple produce ingredients as consumption entries for 800g tracking.
 * Used by the ProduceExtractorModal after logging a meal.
 * Creates separate entries for each fruit/vegetable with only gram data (no macros).
 */
export async function logProduceIngredients(
  userId: string,
  ingredients: Array<{
    name: string;
    category: 'fruit' | 'vegetable';
    grams: number;
  }>,
  mealType: MealType,
  consumedAt: string
): Promise<ConsumptionEntry[]> {
  if (ingredients.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const consumedDate = consumedAt.split('T')[0];

  // Build array of entries to insert
  const entries = ingredients.map((ing) => ({
    user_id: userId,
    entry_type: 'ingredient' as ConsumptionEntryType,
    ingredient_name: ing.name,
    consumed_at: consumedAt,
    consumed_date: consumedDate,
    display_name: `${ing.name} (800g)`,
    meal_type: mealType,
    // 800g tracking only - no macro data
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    grams: ing.grams,
    ingredient_category: ing.category,
  }));

  const { data, error } = await supabase
    .from('meal_consumption_log')
    .insert(entries)
    .select();

  if (error) {
    throw new Error(`Failed to log produce ingredients: ${error.message}`);
  }

  return (data || []) as ConsumptionEntry[];
}

/**
 * Remove a consumption log entry.
 */
export async function removeConsumptionEntry(entryId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('meal_consumption_log')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to remove entry: ${error.message}`);
}

/**
 * Update the meal type of a consumption log entry.
 * Used to move a logged meal from one meal type to another (e.g., lunch to dinner).
 */
export async function updateConsumptionEntryMealType(
  entryId: string,
  userId: string,
  newMealType: MealType
): Promise<ConsumptionEntry> {
  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from('meal_consumption_log')
    .update({ meal_type: newMealType })
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update meal type: ${error.message}`);
  if (!entry) throw new Error('Entry not found');

  return entry as ConsumptionEntry;
}

/**
 * Update the amount and macros of a consumption log entry.
 * Used for inline editing of ingredient amounts.
 */
export async function updateConsumptionEntryAmount(
  entryId: string,
  userId: string,
  updates: {
    amount?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    grams?: number;
  }
): Promise<ConsumptionEntry> {
  const supabase = await createClient();

  const updateData: Record<string, number | undefined> = {};
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.calories !== undefined) updateData.calories = Math.round(updates.calories);
  if (updates.protein !== undefined) updateData.protein = Math.round(updates.protein * 10) / 10;
  if (updates.carbs !== undefined) updateData.carbs = Math.round(updates.carbs * 10) / 10;
  if (updates.fat !== undefined) updateData.fat = Math.round(updates.fat * 10) / 10;
  if (updates.grams !== undefined) updateData.grams = updates.grams;

  const { data: entry, error } = await supabase
    .from('meal_consumption_log')
    .update(updateData)
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update entry amount: ${error.message}`);
  if (!entry) throw new Error('Entry not found');

  return entry as ConsumptionEntry;
}

/**
 * Get the most recent entries for each meal type, looking back up to a specified number of days.
 * Used for "Log same as yesterday" feature per meal type section.
 */
export async function getPreviousEntriesByMealType(
  userId: string,
  beforeDate: string,
  lookbackDays: number = 7
): Promise<Record<MealType, { entries: ConsumptionEntry[]; sourceDate: string } | null>> {
  const supabase = await createClient();

  // Calculate the earliest date to look back to
  const [year, month, day] = beforeDate.split('-').map(Number);
  const beforeDateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const earliestDate = new Date(beforeDateObj);
  earliestDate.setUTCDate(earliestDate.getUTCDate() - lookbackDays);
  const earliestDateStr = earliestDate.toISOString().split('T')[0];

  // Fetch all entries within the lookback window, ordered by date descending
  const { data: entries, error } = await supabase
    .from('meal_consumption_log')
    .select('*')
    .eq('user_id', userId)
    .lt('consumed_date', beforeDate)
    .gte('consumed_date', earliestDateStr)
    .order('consumed_date', { ascending: false })
    .order('consumed_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch previous entries: ${error.message}`);

  // Group entries by meal type, keeping only the most recent date for each type
  const mealTypes: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'];
  const result: Record<MealType, { entries: ConsumptionEntry[]; sourceDate: string } | null> = {
    breakfast: null,
    pre_workout: null,
    lunch: null,
    post_workout: null,
    snack: null,
    dinner: null,
  };

  for (const mealType of mealTypes) {
    // Find entries for this meal type
    const typeEntries = (entries || []).filter(e => e.meal_type === mealType);

    if (typeEntries.length > 0) {
      // Get the most recent date that has entries for this meal type
      const mostRecentDate = typeEntries[0].consumed_date;

      // Get all entries from that date for this meal type
      const entriesFromDate = typeEntries.filter(e => e.consumed_date === mostRecentDate);

      result[mealType] = {
        entries: entriesFromDate as ConsumptionEntry[],
        sourceDate: mostRecentDate,
      };
    }
  }

  return result;
}

/**
 * Copy all entries of a specific meal type from one date to another.
 * Used for per-section "Log same as yesterday" feature.
 */
export async function repeatMealType(
  userId: string,
  mealType: MealType,
  sourceDate: string,
  targetDate: string
): Promise<ConsumptionEntry[]> {
  const supabase = await createClient();

  // Fetch entries for the specific meal type from the source date
  const { data: sourceEntries, error: fetchError } = await supabase
    .from('meal_consumption_log')
    .select('*')
    .eq('user_id', userId)
    .eq('consumed_date', sourceDate)
    .eq('meal_type', mealType);

  if (fetchError) throw new Error(`Failed to fetch source entries: ${fetchError.message}`);

  if (!sourceEntries || sourceEntries.length === 0) {
    return [];
  }

  // Prepare entries for the target date
  const newEntries = sourceEntries.map((entry) => ({
    user_id: userId,
    entry_type: entry.entry_type,
    meal_plan_meal_id: entry.meal_plan_meal_id,
    meal_id: entry.meal_id,
    ingredient_name: entry.ingredient_name,
    display_name: entry.display_name,
    meal_type: entry.meal_type,
    amount: entry.amount,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    consumed_date: targetDate,
    consumed_at: new Date().toISOString(),
    notes: entry.notes,
    grams: entry.grams,
    ingredient_category: entry.ingredient_category,
  }));

  // Insert all new entries
  const { data: inserted, error: insertError } = await supabase
    .from('meal_consumption_log')
    .insert(newEntries)
    .select();

  if (insertError) throw new Error(`Failed to copy entries: ${insertError.message}`);

  return (inserted || []) as ConsumptionEntry[];
}

/**
 * Get daily consumption summary with progress toward targets.
 */
export async function getDailyConsumption(userId: string, date: Date): Promise<DailyConsumptionSummary> {
  const supabase = await createClient();
  const dateStr = date.toISOString().split('T')[0];

  // Get user's macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  const targets: Macros = {
    calories: profile.target_calories,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };

  // Get all entries for the day
  const { data: entries, error: entriesError } = await supabase
    .from('meal_consumption_log')
    .select('*')
    .eq('user_id', userId)
    .eq('consumed_date', dateStr)
    .order('consumed_at', { ascending: true });

  if (entriesError) throw new Error(`Failed to fetch entries: ${entriesError.message}`);

  // Calculate consumed totals
  const consumed: Macros = (entries || []).reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Calculate remaining and percentages
  const remaining: Macros = {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };

  const percentages: Macros = {
    calories: targets.calories > 0 ? Math.round((consumed.calories / targets.calories) * 100) : 0,
    protein: targets.protein > 0 ? Math.round((consumed.protein / targets.protein) * 100) : 0,
    carbs: targets.carbs > 0 ? Math.round((consumed.carbs / targets.carbs) * 100) : 0,
    fat: targets.fat > 0 ? Math.round((consumed.fat / targets.fat) * 100) : 0,
  };

  return {
    date: dateStr,
    targets,
    consumed,
    remaining,
    percentages,
    entries: (entries || []) as ConsumptionEntry[],
    entry_count: entries?.length || 0,
  };
}

/**
 * Get daily consumption summary using a date string (YYYY-MM-DD).
 * This avoids timezone issues by not converting through Date objects.
 */
export async function getDailyConsumptionByDateStr(userId: string, dateStr: string): Promise<DailyConsumptionSummary> {
  const supabase = await createClient();

  // Get user's macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  const targets: Macros = {
    calories: profile.target_calories,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };

  // Get all entries for the day
  const { data: entries, error: entriesError } = await supabase
    .from('meal_consumption_log')
    .select('*')
    .eq('user_id', userId)
    .eq('consumed_date', dateStr)
    .order('consumed_at', { ascending: true });

  if (entriesError) throw new Error(`Failed to fetch entries: ${entriesError.message}`);

  // Calculate consumed totals
  const consumed: Macros = (entries || []).reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Calculate remaining and percentages
  const remaining: Macros = {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };

  const percentages: Macros = {
    calories: targets.calories > 0 ? Math.round((consumed.calories / targets.calories) * 100) : 0,
    protein: targets.protein > 0 ? Math.round((consumed.protein / targets.protein) * 100) : 0,
    carbs: targets.carbs > 0 ? Math.round((consumed.carbs / targets.carbs) * 100) : 0,
    fat: targets.fat > 0 ? Math.round((consumed.fat / targets.fat) * 100) : 0,
  };

  // Calculate fruit/vegetable totals for 800g Challenge
  const fruitVegGrams = (entries || []).reduce((total, entry) => {
    if (entry.ingredient_category && FRUIT_VEG_CATEGORIES.includes(entry.ingredient_category.toLowerCase())) {
      return total + (entry.grams || 0);
    }
    return total;
  }, 0);

  // Check if 800g goal was already celebrated today
  const { data: celebration } = await supabase
    .from('daily_fruit_veg_celebration')
    .select('goal_celebrated')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  const fruitVeg: FruitVegProgress = {
    currentGrams: Math.round(fruitVegGrams),
    goalGrams: FRUIT_VEG_GOAL_GRAMS,
    percentage: FRUIT_VEG_GOAL_GRAMS > 0 ? Math.round((fruitVegGrams / FRUIT_VEG_GOAL_GRAMS) * 100) : 0,
    goalCelebrated: celebration?.goal_celebrated || false,
  };

  // Get water intake for the day
  const { data: waterLog } = await supabase
    .from('daily_water_log')
    .select('ounces_consumed, goal_ounces, goal_celebrated')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  const water: WaterProgress = {
    currentOunces: waterLog?.ounces_consumed || 0,
    goalOunces: waterLog?.goal_ounces || WATER_GOAL_OUNCES,
    percentage: WATER_GOAL_OUNCES > 0 ? Math.round(((waterLog?.ounces_consumed || 0) / WATER_GOAL_OUNCES) * 100) : 0,
    goalCelebrated: waterLog?.goal_celebrated || false,
  };

  return {
    date: dateStr,
    targets,
    consumed,
    remaining,
    percentages,
    entries: (entries || []) as ConsumptionEntry[],
    entry_count: entries?.length || 0,
    fruitVeg,
    water,
  };
}

/**
 * Get user's frequently logged ingredients.
 */
export async function getFrequentIngredients(userId: string, limit: number = 8): Promise<FrequentIngredient[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_frequent_ingredients')
    .select('*')
    .eq('user_id', userId)
    .order('times_logged', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching frequent ingredients:', error);
    return [];
  }

  return data as FrequentIngredient[];
}

/**
 * Get user's pinned/favorite ingredients.
 */
export async function getPinnedIngredients(userId: string): Promise<FrequentIngredient[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_frequent_ingredients')
    .select('*')
    .eq('user_id', userId)
    .eq('is_pinned', true)
    .order('ingredient_name', { ascending: true });

  if (error) {
    console.error('Error fetching pinned ingredients:', error);
    return [];
  }

  return data as FrequentIngredient[];
}

/**
 * Get meals from the user's most recent meal plan only.
 * Excludes party_meal source_type.
 * Orders by meal type for display.
 */
async function getLatestPlanMeals(
  userId: string,
  todaysLogs: { id: string; meal_plan_meal_id: string | null; meal_id: string | null; consumed_at: string }[]
): Promise<MealPlanMealToLog[]> {
  const supabase = await createClient();

  // Get the most recent meal plan and all favorited meal plans
  const [latestPlanResult, favoritePlansResult] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('id, week_start_date, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('meal_plans')
      .select('id, week_start_date, title, created_at')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false }),
  ]);

  const latestPlan = latestPlanResult.data?.[0];
  const favoritePlans = favoritePlansResult.data || [];

  // Combine latest plan with favorites, avoiding duplicates
  const planMap = new Map<string, { id: string; week_start_date: string; title: string | null; created_at: string }>();

  if (latestPlan) {
    planMap.set(latestPlan.id, latestPlan);
  }
  for (const plan of favoritePlans) {
    if (!planMap.has(plan.id)) {
      planMap.set(plan.id, plan);
    }
  }

  if (planMap.size === 0) {
    return [];
  }

  const planIds = Array.from(planMap.keys());

  // Fetch all meals from the latest plan and favorited plans
  // Use meals!meal_id to specify the foreign key (there's also swapped_from_meal_id)
  const { data: planMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      day,
      meal_id,
      meal_plan_id,
      meals!meal_id(name, meal_type, calories, protein, carbs, fat, source_type)
    `)
    .in('meal_plan_id', planIds);

  if (!planMeals || planMeals.length === 0) {
    return [];
  }

  // Filter out party_meal source_type and null meals (deleted or RLS blocked)
  const filteredPlanMeals = planMeals.filter((pm) => {
    if (!pm.meals) return false;
    const meal = pm.meals as unknown as { source_type?: string };
    return meal.source_type !== 'party_meal';
  });

  const dayLabels: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  };

  // Helper to check if logged
  const getLoggedInfo = (mealPlanMealId: string, mealId: string) => {
    const log = todaysLogs.find(
      (l) => l.meal_plan_meal_id === mealPlanMealId || l.meal_id === mealId
    );
    return {
      is_logged: !!log,
      logged_entry_id: log?.id,
      logged_at: log?.consumed_at,
    };
  };

  // Build results from the filtered meals (from latest plan and favorited plans)
  const results: MealPlanMealToLog[] = [];

  for (const pm of filteredPlanMeals) {

    const meal = pm.meals as unknown as {
      name: string;
      meal_type: MealType;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      source_type: string;
    };

    const plan = planMap.get(pm.meal_plan_id);
    if (!plan) continue;

    const logInfo = getLoggedInfo(pm.id, pm.meal_id);

    results.push({
      id: pm.id,
      source: 'meal_plan' as ConsumptionEntryType,
      source_id: pm.id,
      name: meal.name,
      meal_type: meal.meal_type,
      calories: Math.round(meal.calories),
      protein: Math.round(meal.protein),
      carbs: Math.round(meal.carbs),
      fat: Math.round(meal.fat),
      plan_week_start: plan.week_start_date,
      plan_title: plan.title ?? undefined,
      day_of_week: pm.day,
      day_label: dayLabels[pm.day] || pm.day,
      meal_id: pm.meal_id,
      ...logInfo,
    });
  }

  // Deduplicate by meal_id - when users have preferences like "same lunch all week",
  // the same meal appears multiple times. We only want to show each unique meal once.
  const seenMealIds = new Set<string>();
  const dedupedResults: MealPlanMealToLog[] = [];

  for (const meal of results) {
    if (!seenMealIds.has(meal.meal_id)) {
      seenMealIds.add(meal.meal_id);
      dedupedResults.push(meal);
    }
  }

  // Sort by meal type order for display
  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  dedupedResults.sort((a, b) => (mealTypeOrder[a.meal_type || 'snack'] || 4) - (mealTypeOrder[b.meal_type || 'snack'] || 4));

  return dedupedResults;
}

/**
 * Search for ingredients to log.
 * Priority: frequent > cache
 * Includes validation status for each ingredient.
 */
export async function searchIngredients(userId: string, query: string): Promise<IngredientToLog[]> {
  const supabase = await createClient();
  const normalizedQuery = query.toLowerCase().trim();
  const results: IngredientToLog[] = [];

  // 1. Search user's frequent ingredients first
  const { data: frequent } = await supabase
    .from('user_frequent_ingredients')
    .select('*')
    .eq('user_id', userId)
    .ilike('ingredient_name_normalized', `%${normalizedQuery}%`)
    .limit(5);

  if (frequent && frequent.length > 0) {
    // Look up current categories from the ingredients table
    // This ensures we use the admin-updated category, not the cached one
    // Also filter out soft-deleted ingredients
    const frequentNames = frequent.map((f) => f.ingredient_name_normalized);
    const { data: currentIngredients } = await supabase
      .from('ingredients')
      .select('name_normalized, category')
      .in('name_normalized', frequentNames)
      .is('deleted_at', null);

    // Build a map of normalized name -> current category
    const categoryMap = new Map<string, string | null>();
    if (currentIngredients) {
      for (const ing of currentIngredients) {
        categoryMap.set(ing.name_normalized, ing.category);
      }
    }

    results.push(
      ...frequent.map((f) => {
        // Use the current category from ingredients table if available,
        // otherwise fall back to the cached category in frequent ingredients
        const currentCategory = categoryMap.get(f.ingredient_name_normalized);
        const category = currentCategory !== undefined
          ? currentCategory
          : (f as { category?: string }).category;

        return {
          name: f.ingredient_name,
          default_amount: f.default_amount,
          default_unit: f.default_unit,
          calories_per_serving: f.calories_per_serving,
          protein_per_serving: f.protein_per_serving,
          carbs_per_serving: f.carbs_per_serving,
          fat_per_serving: f.fat_per_serving,
          source: 'frequent' as const,
          is_user_added: true, // Frequent ingredients are always user-added
          is_validated: false, // User-added ingredients are not validated by default
          is_pinned: (f as { is_pinned?: boolean }).is_pinned || false,
          // 800g Challenge tracking - use current category from ingredients table
          category: category as IngredientCategoryType | undefined,
          default_grams: (f as { default_grams?: number }).default_grams,
        };
      })
    );
  }

  // 2. Search ingredient_nutrition via view that joins with ingredients table
  // The ingredient_nutrition table no longer has name columns - they're in the ingredients table
  const { data: cached } = await supabase
    .from('ingredient_nutrition_with_details')
    .select('*')
    .ilike('name_normalized', `%${normalizedQuery}%`)
    .limit(10);

  if (cached) {
    const existingNames = new Set(results.map((r) => r.name.toLowerCase()));
    results.push(
      ...cached
        .filter((c) => !existingNames.has(c.ingredient_name.toLowerCase()))
        .map((c) => {
          // Format the unit to include serving size for clarity
          // e.g., "4oz" instead of default_amount=4, default_unit="oz"
          // This ensures default_amount is always 1 (one serving)
          const unit = c.serving_size === 1
            ? c.serving_unit
            : `${c.serving_size}${c.serving_unit}`;

          // Determine validation status:
          // - System ingredients (not user_added) are considered validated
          // - User-added ingredients check the ingredient_validated column from the view
          const isUserAdded = c.is_user_added === true;
          const isValidated = !isUserAdded || c.ingredient_validated === true;

          return {
            name: c.ingredient_name,
            default_amount: 1,
            default_unit: unit,
            calories_per_serving: c.calories,
            protein_per_serving: c.protein,
            carbs_per_serving: c.carbs,
            fat_per_serving: c.fat,
            source: 'cache' as const,
            is_user_added: isUserAdded,
            is_validated: isValidated,
            // 800g Challenge tracking - category comes from the ingredients table via view
            category: (c as { category?: string }).category as IngredientCategoryType | undefined,
          };
        })
    );
  }

  // 3. Populate default_grams for fruit/vegetable results from produce_weights table
  const produceResults = results.filter(
    (r) => !r.default_grams && (r.category === 'fruit' || r.category === 'vegetable')
  );

  if (produceResults.length > 0) {
    const produceNames = [...new Set(produceResults.map((r) => r.name.toLowerCase().trim()))];
    const { data: weights } = await supabase
      .from('produce_weights')
      .select('name_normalized, unit, grams')
      .in('name_normalized', produceNames);

    if (weights && weights.length > 0) {
      // Build a map: name_normalized -> first available grams value
      // Prefer 'medium' unit, then 'cup' variants, then any available
      const gramsMap = new Map<string, number>();
      const unitPriority = ['medium', 'cup', 'cup_raw', 'cup_chopped', 'cup_cooked'];

      for (const name of produceNames) {
        const nameWeights = weights.filter((w) => w.name_normalized === name);
        if (nameWeights.length === 0) continue;

        // Pick the best unit by priority
        let bestWeight = nameWeights[0];
        for (const preferred of unitPriority) {
          const match = nameWeights.find((w) => w.unit === preferred);
          if (match) {
            bestWeight = match;
            break;
          }
        }
        gramsMap.set(name, Number(bestWeight.grams));
      }

      // Apply default_grams to matching results
      for (const r of produceResults) {
        const grams = gramsMap.get(r.name.toLowerCase().trim());
        if (grams) {
          r.default_grams = grams;
        }
      }
    }
  }

  return results;
}

/**
 * Update or create a frequent ingredient entry.
 */
async function upsertFrequentIngredient(
  userId: string,
  ingredientName: string,
  amount: number,
  unit: string,
  macros: { calories: number; protein: number; carbs: number; fat: number },
  category?: string,
  defaultGrams?: number
): Promise<void> {
  const supabase = await createClient();
  const normalizedName = normalizeIngredientName(ingredientName);

  // Calculate per-serving macros
  const caloriesPerServing = amount > 0 ? Math.round(macros.calories / amount) : macros.calories;
  const proteinPerServing = amount > 0 ? Math.round((macros.protein / amount) * 10) / 10 : macros.protein;
  const carbsPerServing = amount > 0 ? Math.round((macros.carbs / amount) * 10) / 10 : macros.carbs;
  const fatPerServing = amount > 0 ? Math.round((macros.fat / amount) * 10) / 10 : macros.fat;

  // First, check if the ingredient already exists
  const { data: existing } = await supabase
    .from('user_frequent_ingredients')
    .select('id, times_logged')
    .eq('user_id', userId)
    .eq('ingredient_name_normalized', normalizedName)
    .single();

  if (existing) {
    // Update existing entry - increment count
    await supabase
      .from('user_frequent_ingredients')
      .update({
        times_logged: existing.times_logged + 1,
        last_logged_at: new Date().toISOString(),
        default_amount: amount,
        default_unit: unit,
        calories_per_serving: caloriesPerServing,
        protein_per_serving: proteinPerServing,
        carbs_per_serving: carbsPerServing,
        fat_per_serving: fatPerServing,
        // 800g Challenge tracking (only update if provided)
        ...(category && { category }),
        ...(defaultGrams && { default_grams: defaultGrams }),
      })
      .eq('id', existing.id);
  } else {
    // Insert new entry
    await supabase.from('user_frequent_ingredients').insert({
      user_id: userId,
      ingredient_name: ingredientName,
      ingredient_name_normalized: normalizedName,
      default_amount: amount,
      default_unit: unit,
      calories_per_serving: caloriesPerServing,
      protein_per_serving: proteinPerServing,
      carbs_per_serving: carbsPerServing,
      fat_per_serving: fatPerServing,
      times_logged: 1,
      last_logged_at: new Date().toISOString(),
      // 800g Challenge tracking
      category,
      default_grams: defaultGrams,
    });
  }
}

/**
 * Get all meals available to log for a given date.
 */
export async function getAvailableMealsToLog(userId: string, date: Date): Promise<AvailableMealsToLog> {
  const supabase = await createClient();
  const dateStr = date.toISOString().split('T')[0];

  // Get day of week from date
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[date.getDay()];

  // Get today's logged entries for is_logged status
  const { data: todaysLogs } = await supabase
    .from('meal_consumption_log')
    .select('id, meal_plan_meal_id, meal_id, consumed_at')
    .eq('user_id', userId)
    .eq('consumed_date', dateStr);

  // Helper to check if logged
  const getLoggedInfo = (mealPlanMealId?: string, mealId?: string) => {
    const log = (todaysLogs || []).find(
      (l) => (mealPlanMealId && l.meal_plan_meal_id === mealPlanMealId) || (mealId && l.meal_id === mealId)
    );
    return {
      is_logged: !!log,
      logged_entry_id: log?.id,
      logged_at: log?.consumed_at,
    };
  };

  // 1. Get current week's meal plan
  const weekStart = getWeekStart(date);
  const { data: currentPlan } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart.toISOString().split('T')[0])
    .single();

  const from_todays_plan: MealToLog[] = [];
  const from_week_plan: MealToLog[] = [];

  if (currentPlan) {
    const { data: planMeals } = await supabase
      .from('meal_plan_meals')
      .select(
        `
        id,
        day,
        meal_id,
        meals!meal_id(name, meal_type, calories, protein, carbs, fat, source_type)
      `
      )
      .eq('meal_plan_id', currentPlan.id);

    if (planMeals) {
      for (const pm of planMeals) {
        // Skip if meal was deleted
        if (!pm.meals) continue;

        const meal = pm.meals as unknown as {
          name: string;
          meal_type: MealType;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          source_type?: string;
        };

        // Skip party meals
        if (meal.source_type === 'party_meal') {
          continue;
        }
        const logInfo = getLoggedInfo(pm.id, pm.meal_id);
        const mealToLog: MealToLog = {
          id: pm.id,
          source: 'meal_plan' as ConsumptionEntryType,
          source_id: pm.id,
          name: meal.name,
          meal_type: meal.meal_type,
          calories: Math.round(meal.calories),
          protein: Math.round(meal.protein),
          carbs: Math.round(meal.carbs),
          fat: Math.round(meal.fat),
          meal_id: pm.meal_id,
          ...logInfo,
        };

        if (pm.day === dayOfWeek) {
          from_todays_plan.push(mealToLog);
        } else {
          from_week_plan.push(mealToLog);
        }
      }
    }
  }

  // Sort today's plan by meal type order
  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  from_todays_plan.sort((a, b) => (mealTypeOrder[a.meal_type || 'snack'] || 4) - (mealTypeOrder[b.meal_type || 'snack'] || 4));

  // 2. Get custom meals (user-created, excluding quick_cook and party_meal)
  const { data: customMeals } = await supabase
    .from('meals')
    .select('id, name, meal_type, calories, protein, carbs, fat')
    .eq('source_user_id', userId)
    .eq('is_user_created', true)
    .neq('source_type', 'quick_cook')  // Exclude quick_cook meals (fetched separately)
    .neq('source_type', 'party_meal')  // Exclude party meals
    .order('updated_at', { ascending: false })
    .limit(10);

  const custom_meals: MealToLog[] = (customMeals || []).map((m) => {
    const logInfo = getLoggedInfo(undefined, m.id);
    return {
      id: m.id,
      source: 'custom_meal' as ConsumptionEntryType,
      source_id: m.id,
      name: m.name,
      meal_type: m.meal_type,
      calories: Math.round(m.calories),
      protein: Math.round(m.protein),
      carbs: Math.round(m.carbs),
      fat: Math.round(m.fat),
      ...logInfo,
    };
  });

  // 3. Get quick cook meals (source_type = 'quick_cook', excludes party_meal and ai_generated meal plan meals)
  const { data: quickCookMeals } = await supabase
    .from('meals')
    .select('id, name, meal_type, calories, protein, carbs, fat')
    .eq('source_user_id', userId)
    .eq('source_type', 'quick_cook')  // Only Quick Cook single meals
    .order('updated_at', { ascending: false })
    .limit(10);

  const quick_cook_meals: MealToLog[] = (quickCookMeals || []).map((m) => {
    const logInfo = getLoggedInfo(undefined, m.id);
    return {
      id: m.id,
      source: 'quick_cook' as ConsumptionEntryType,
      source_id: m.id,
      name: m.name,
      meal_type: m.meal_type,
      calories: Math.round(m.calories),
      protein: Math.round(m.protein),
      carbs: Math.round(m.carbs),
      fat: Math.round(m.fat),
      ...logInfo,
    };
  });

  // 4. Get frequent ingredients
  const frequentIngredients = await getFrequentIngredients(userId);
  const frequent_ingredients: IngredientToLog[] = frequentIngredients.map((fi) => ({
    name: fi.ingredient_name,
    default_amount: fi.default_amount,
    default_unit: fi.default_unit,
    calories_per_serving: fi.calories_per_serving,
    protein_per_serving: fi.protein_per_serving,
    carbs_per_serving: fi.carbs_per_serving,
    fat_per_serving: fi.fat_per_serving,
    source: 'frequent' as const,
    is_pinned: (fi as { is_pinned?: boolean }).is_pinned || false,
    // 800g Challenge tracking
    category: fi.category,
    default_grams: fi.default_grams,
  }));

  // 5. Get pinned ingredients (favorites)
  const pinnedIngredients = await getPinnedIngredients(userId);
  const pinned_ingredients: IngredientToLog[] = pinnedIngredients.map((fi) => ({
    name: fi.ingredient_name,
    default_amount: fi.default_amount,
    default_unit: fi.default_unit,
    calories_per_serving: fi.calories_per_serving,
    protein_per_serving: fi.protein_per_serving,
    carbs_per_serving: fi.carbs_per_serving,
    fat_per_serving: fi.fat_per_serving,
    source: 'frequent' as const,
    is_pinned: true,
    // 800g Challenge tracking
    category: fi.category,
    default_grams: fi.default_grams,
  }));

  // 6. Get latest meal plan meals (for the "Meal Plan Meals" section)
  const latest_plan_meals = await getLatestPlanMeals(userId, todaysLogs || []);

  return {
    from_todays_plan,
    from_week_plan,
    latest_plan_meals,
    custom_meals,
    quick_cook_meals,
    recent_meals: [], // Could populate from recent consumption entries later
    frequent_ingredients,
    pinned_ingredients,
  };
}

/**
 * Get all meals available to log for a given date string (YYYY-MM-DD).
 * This avoids timezone issues by not converting through Date objects.
 */
export async function getAvailableMealsToLogByDateStr(userId: string, dateStr: string): Promise<AvailableMealsToLog> {
  const supabase = await createClient();

  // Get day of week from date string
  const dayOfWeek = getDayOfWeekFromDateStr(dateStr);

  // Get today's logged entries for is_logged status
  const { data: todaysLogs } = await supabase
    .from('meal_consumption_log')
    .select('id, meal_plan_meal_id, meal_id, consumed_at')
    .eq('user_id', userId)
    .eq('consumed_date', dateStr);

  // Helper to check if logged
  const getLoggedInfo = (mealPlanMealId?: string, mealId?: string) => {
    const log = (todaysLogs || []).find(
      (l) => (mealPlanMealId && l.meal_plan_meal_id === mealPlanMealId) || (mealId && l.meal_id === mealId)
    );
    return {
      is_logged: !!log,
      logged_entry_id: log?.id,
      logged_at: log?.consumed_at,
    };
  };

  // Run all independent queries in parallel (todaysLogs already available)
  const weekStartStr = getWeekStartFromDateStr(dateStr);

  const [
    { data: currentPlan },
    { data: customMeals },
    { data: quickCookMeals },
    frequentIngredients,
    pinnedIngredients,
    latest_plan_meals,
  ] = await Promise.all([
    // 1. Get current week's meal plan
    supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartStr)
      .single(),
    // 2. Get custom meals (user-created, excluding quick_cook and party_meal)
    supabase
      .from('meals')
      .select('id, name, meal_type, calories, protein, carbs, fat')
      .eq('source_user_id', userId)
      .eq('is_user_created', true)
      .neq('source_type', 'quick_cook')
      .neq('source_type', 'party_meal')
      .order('updated_at', { ascending: false })
      .limit(10),
    // 3. Get quick cook meals
    supabase
      .from('meals')
      .select('id, name, meal_type, calories, protein, carbs, fat')
      .eq('source_user_id', userId)
      .eq('source_type', 'quick_cook')
      .order('updated_at', { ascending: false })
      .limit(10),
    // 4. Get frequent ingredients
    getFrequentIngredients(userId),
    // 5. Get pinned ingredients (favorites)
    getPinnedIngredients(userId),
    // 6. Get latest meal plan meals
    getLatestPlanMeals(userId, todaysLogs || []),
  ]);

  // Fetch plan meals (depends on currentPlan result)
  const from_todays_plan: MealToLog[] = [];
  const from_week_plan: MealToLog[] = [];

  if (currentPlan) {
    const { data: planMeals } = await supabase
      .from('meal_plan_meals')
      .select(
        `
        id,
        day,
        meal_id,
        meals!meal_id(name, meal_type, calories, protein, carbs, fat, source_type)
      `
      )
      .eq('meal_plan_id', currentPlan.id);

    if (planMeals) {
      for (const pm of planMeals) {
        // Skip if meal was deleted
        if (!pm.meals) continue;

        const meal = pm.meals as unknown as {
          name: string;
          meal_type: MealType;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          source_type?: string;
        };

        // Skip party meals
        if (meal.source_type === 'party_meal') {
          continue;
        }
        const logInfo = getLoggedInfo(pm.id, pm.meal_id);
        const mealToLog: MealToLog = {
          id: pm.id,
          source: 'meal_plan' as ConsumptionEntryType,
          source_id: pm.id,
          name: meal.name,
          meal_type: meal.meal_type,
          calories: Math.round(meal.calories),
          protein: Math.round(meal.protein),
          carbs: Math.round(meal.carbs),
          fat: Math.round(meal.fat),
          meal_id: pm.meal_id,
          ...logInfo,
        };

        if (pm.day === dayOfWeek) {
          from_todays_plan.push(mealToLog);
        } else {
          from_week_plan.push(mealToLog);
        }
      }
    }
  }

  // Sort today's plan by meal type order
  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  from_todays_plan.sort((a, b) => (mealTypeOrder[a.meal_type || 'snack'] || 4) - (mealTypeOrder[b.meal_type || 'snack'] || 4));

  const custom_meals: MealToLog[] = (customMeals || []).map((m) => {
    const logInfo = getLoggedInfo(undefined, m.id);
    return {
      id: m.id,
      source: 'custom_meal' as ConsumptionEntryType,
      source_id: m.id,
      name: m.name,
      meal_type: m.meal_type,
      calories: Math.round(m.calories),
      protein: Math.round(m.protein),
      carbs: Math.round(m.carbs),
      fat: Math.round(m.fat),
      ...logInfo,
    };
  });

  const quick_cook_meals: MealToLog[] = (quickCookMeals || []).map((m) => {
    const logInfo = getLoggedInfo(undefined, m.id);
    return {
      id: m.id,
      source: 'quick_cook' as ConsumptionEntryType,
      source_id: m.id,
      name: m.name,
      meal_type: m.meal_type,
      calories: Math.round(m.calories),
      protein: Math.round(m.protein),
      carbs: Math.round(m.carbs),
      fat: Math.round(m.fat),
      ...logInfo,
    };
  });

  const frequent_ingredients: IngredientToLog[] = frequentIngredients.map((fi) => ({
    name: fi.ingredient_name,
    default_amount: fi.default_amount,
    default_unit: fi.default_unit,
    calories_per_serving: fi.calories_per_serving,
    protein_per_serving: fi.protein_per_serving,
    carbs_per_serving: fi.carbs_per_serving,
    fat_per_serving: fi.fat_per_serving,
    source: 'frequent' as const,
    is_pinned: (fi as { is_pinned?: boolean }).is_pinned || false,
    // 800g Challenge tracking
    category: fi.category,
    default_grams: fi.default_grams,
  }));

  const pinned_ingredients: IngredientToLog[] = pinnedIngredients.map((fi) => ({
    name: fi.ingredient_name,
    default_amount: fi.default_amount,
    default_unit: fi.default_unit,
    calories_per_serving: fi.calories_per_serving,
    protein_per_serving: fi.protein_per_serving,
    carbs_per_serving: fi.carbs_per_serving,
    fat_per_serving: fi.fat_per_serving,
    source: 'frequent' as const,
    is_pinned: true,
    // 800g Challenge tracking
    category: fi.category,
    default_grams: fi.default_grams,
  }));

  return {
    from_todays_plan,
    from_week_plan,
    latest_plan_meals,
    custom_meals,
    quick_cook_meals,
    recent_meals: [],
    frequent_ingredients,
    pinned_ingredients,
  };
}

// Helper to get week end (Sunday) from week start
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

// Helper to get month start and end dates
function getMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  return { start, end };
}

/**
 * Get consumption data for a date range.
 * Returns daily data points for charting and meal type breakdown.
 */
export async function getConsumptionRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  dailyData: import('@/lib/types').DailyDataPoint[];
  totals: Macros;
  entryCount: number;
  daysWithData: number;
  byMealType: MealTypeBreakdown;
}> {
  const supabase = await createClient();
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Get all entries in date range (including meal_type for breakdown)
  const { data: entries, error } = await supabase
    .from('meal_consumption_log')
    .select('consumed_date, meal_type, calories, protein, carbs, fat')
    .eq('user_id', userId)
    .gte('consumed_date', startStr)
    .lte('consumed_date', endStr)
    .order('consumed_date', { ascending: true });

  if (error) throw new Error(`Failed to fetch entries: ${error.message}`);

  // Type for per-day data including meal type breakdown
  type DailyAccumulator = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    count: number;
    byMealType: {
      breakfast: Macros;
      pre_workout: Macros;
      lunch: Macros;
      post_workout: Macros;
      snack: Macros;
      dinner: Macros;
    };
  };

  const emptyMealTypeBreakdown = () => ({
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    pre_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    post_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  });

  // Group entries by date
  const dailyMap = new Map<string, DailyAccumulator>();

  // Initialize period-level meal type breakdown
  const byMealType: MealTypeBreakdown = {
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    pre_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    post_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    unassigned: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };

  for (const entry of entries || []) {
    const date = entry.consumed_date;
    const existing = dailyMap.get(date) || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      count: 0,
      byMealType: emptyMealTypeBreakdown(),
    };

    // Update daily totals
    existing.calories += entry.calories;
    existing.protein += entry.protein;
    existing.carbs += entry.carbs;
    existing.fat += entry.fat;
    existing.count += 1;

    // Update per-day meal type breakdown (only for known meal types)
    const mealTypeKey = entry.meal_type as MealType | null;
    if (mealTypeKey && mealTypeKey in existing.byMealType) {
      const dayBucket = existing.byMealType[mealTypeKey as keyof typeof existing.byMealType];
      dayBucket.calories += entry.calories;
      dayBucket.protein += entry.protein;
      dayBucket.carbs += entry.carbs;
      dayBucket.fat += entry.fat;
    }

    dailyMap.set(date, existing);

    // Aggregate period-level by meal type
    const periodBucket = mealTypeKey ? byMealType[mealTypeKey] : byMealType.unassigned;
    periodBucket.calories += entry.calories;
    periodBucket.protein += entry.protein;
    periodBucket.carbs += entry.carbs;
    periodBucket.fat += entry.fat;
  }

  // Generate all dates in range (even if no data)
  const dailyData: import('@/lib/types').DailyDataPoint[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr);
    const emptyBreakdown = emptyMealTypeBreakdown();

    // Round meal type values for this day
    const dayMealTypeBreakdown = dayData?.byMealType || emptyBreakdown;
    for (const key of Object.keys(dayMealTypeBreakdown) as (keyof typeof dayMealTypeBreakdown)[]) {
      dayMealTypeBreakdown[key].protein = Math.round(dayMealTypeBreakdown[key].protein * 10) / 10;
      dayMealTypeBreakdown[key].carbs = Math.round(dayMealTypeBreakdown[key].carbs * 10) / 10;
      dayMealTypeBreakdown[key].fat = Math.round(dayMealTypeBreakdown[key].fat * 10) / 10;
    }

    dailyData.push({
      date: dateStr,
      calories: dayData?.calories || 0,
      protein: Math.round((dayData?.protein || 0) * 10) / 10,
      carbs: Math.round((dayData?.carbs || 0) * 10) / 10,
      fat: Math.round((dayData?.fat || 0) * 10) / 10,
      entry_count: dayData?.count || 0,
      byMealType: dayMealTypeBreakdown,
    });
    current.setDate(current.getDate() + 1);
  }

  // Calculate totals
  const totals: Macros = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  let entryCount = 0;
  let daysWithData = 0;

  for (const day of dailyData) {
    totals.calories += day.calories;
    totals.protein += day.protein;
    totals.carbs += day.carbs;
    totals.fat += day.fat;
    entryCount += day.entry_count;
    if (day.entry_count > 0) daysWithData++;
  }

  // Round meal type breakdown values
  for (const key of Object.keys(byMealType) as (keyof MealTypeBreakdown)[]) {
    byMealType[key].protein = Math.round(byMealType[key].protein * 10) / 10;
    byMealType[key].carbs = Math.round(byMealType[key].carbs * 10) / 10;
    byMealType[key].fat = Math.round(byMealType[key].fat * 10) / 10;
  }

  return { dailyData, totals, entryCount, daysWithData, byMealType };
}

/**
 * Get consumption data for a date range using date strings.
 * This version avoids timezone issues by working with strings directly.
 */
export async function getConsumptionRangeByDateStr(
  userId: string,
  startStr: string,
  endStr: string
): Promise<{
  dailyData: import('@/lib/types').DailyDataPoint[];
  totals: Macros;
  entryCount: number;
  daysWithData: number;
  byMealType: MealTypeBreakdown;
}> {
  const supabase = await createClient();

  // Get all entries in date range (including meal_type for breakdown)
  const { data: entries, error } = await supabase
    .from('meal_consumption_log')
    .select('consumed_date, meal_type, calories, protein, carbs, fat')
    .eq('user_id', userId)
    .gte('consumed_date', startStr)
    .lte('consumed_date', endStr)
    .order('consumed_date', { ascending: true });

  if (error) throw new Error(`Failed to fetch entries: ${error.message}`);

  // Type for per-day data including meal type breakdown
  type DailyAccumulator = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    count: number;
    byMealType: {
      breakfast: Macros;
      pre_workout: Macros;
      lunch: Macros;
      post_workout: Macros;
      snack: Macros;
      dinner: Macros;
    };
  };

  const emptyMealTypeBreakdown = () => ({
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    pre_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    post_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  });

  // Group entries by date
  const dailyMap = new Map<string, DailyAccumulator>();

  // Initialize period-level meal type breakdown
  const byMealType: MealTypeBreakdown = {
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    pre_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    post_workout: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    unassigned: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };

  for (const entry of entries || []) {
    const date = entry.consumed_date;
    const existing = dailyMap.get(date) || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      count: 0,
      byMealType: emptyMealTypeBreakdown(),
    };

    // Update daily totals
    existing.calories += entry.calories;
    existing.protein += entry.protein;
    existing.carbs += entry.carbs;
    existing.fat += entry.fat;
    existing.count += 1;

    // Update per-day meal type breakdown (only for known meal types)
    const mealTypeKey = entry.meal_type as MealType | null;
    if (mealTypeKey && mealTypeKey in existing.byMealType) {
      const dayBucket = existing.byMealType[mealTypeKey as keyof typeof existing.byMealType];
      dayBucket.calories += entry.calories;
      dayBucket.protein += entry.protein;
      dayBucket.carbs += entry.carbs;
      dayBucket.fat += entry.fat;
    }

    dailyMap.set(date, existing);

    // Aggregate period-level by meal type
    const periodBucket = mealTypeKey ? byMealType[mealTypeKey] : byMealType.unassigned;
    periodBucket.calories += entry.calories;
    periodBucket.protein += entry.protein;
    periodBucket.carbs += entry.carbs;
    periodBucket.fat += entry.fat;
  }

  // Generate all dates in range using UTC to avoid timezone issues
  const dailyData: import('@/lib/types').DailyDataPoint[] = [];
  const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endStr.split('-').map(Number);
  const current = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0));

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr);
    const emptyBreakdown = emptyMealTypeBreakdown();

    // Round meal type values for this day
    const dayMealTypeBreakdown = dayData?.byMealType || emptyBreakdown;
    for (const key of Object.keys(dayMealTypeBreakdown) as (keyof typeof dayMealTypeBreakdown)[]) {
      dayMealTypeBreakdown[key].protein = Math.round(dayMealTypeBreakdown[key].protein * 10) / 10;
      dayMealTypeBreakdown[key].carbs = Math.round(dayMealTypeBreakdown[key].carbs * 10) / 10;
      dayMealTypeBreakdown[key].fat = Math.round(dayMealTypeBreakdown[key].fat * 10) / 10;
    }

    dailyData.push({
      date: dateStr,
      calories: dayData?.calories || 0,
      protein: Math.round((dayData?.protein || 0) * 10) / 10,
      carbs: Math.round((dayData?.carbs || 0) * 10) / 10,
      fat: Math.round((dayData?.fat || 0) * 10) / 10,
      entry_count: dayData?.count || 0,
      byMealType: dayMealTypeBreakdown,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Calculate totals
  const totals: Macros = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  let entryCount = 0;
  let daysWithData = 0;

  for (const day of dailyData) {
    totals.calories += day.calories;
    totals.protein += day.protein;
    totals.carbs += day.carbs;
    totals.fat += day.fat;
    entryCount += day.entry_count;
    if (day.entry_count > 0) daysWithData++;
  }

  // Round meal type breakdown values
  for (const key of Object.keys(byMealType) as (keyof MealTypeBreakdown)[]) {
    byMealType[key].protein = Math.round(byMealType[key].protein * 10) / 10;
    byMealType[key].carbs = Math.round(byMealType[key].carbs * 10) / 10;
    byMealType[key].fat = Math.round(byMealType[key].fat * 10) / 10;
  }

  return { dailyData, totals, entryCount, daysWithData, byMealType };
}

/**
 * Get weekly consumption summary with daily breakdown.
 */
export async function getWeeklyConsumption(
  userId: string,
  date: Date
): Promise<import('@/lib/types').PeriodConsumptionSummary> {
  const supabase = await createClient();

  // Get user's daily macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(weekStart);

  const { dailyData, totals, entryCount, daysWithData, byMealType } = await getConsumptionRange(
    userId,
    weekStart,
    weekEnd
  );

  const dayCount = 7;
  const dailyTargets: Macros = {
    calories: profile.target_calories,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };

  const weeklyTargets: Macros = {
    calories: dailyTargets.calories * dayCount,
    protein: dailyTargets.protein * dayCount,
    carbs: dailyTargets.carbs * dayCount,
    fat: dailyTargets.fat * dayCount,
  };

  const averagePerDay: Macros =
    daysWithData > 0
      ? {
          calories: Math.round(totals.calories / daysWithData),
          protein: Math.round((totals.protein / daysWithData) * 10) / 10,
          carbs: Math.round((totals.carbs / daysWithData) * 10) / 10,
          fat: Math.round((totals.fat / daysWithData) * 10) / 10,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const percentages: Macros = {
    calories:
      weeklyTargets.calories > 0 ? Math.round((totals.calories / weeklyTargets.calories) * 100) : 0,
    protein:
      weeklyTargets.protein > 0 ? Math.round((totals.protein / weeklyTargets.protein) * 100) : 0,
    carbs: weeklyTargets.carbs > 0 ? Math.round((totals.carbs / weeklyTargets.carbs) * 100) : 0,
    fat: weeklyTargets.fat > 0 ? Math.round((totals.fat / weeklyTargets.fat) * 100) : 0,
  };

  return {
    periodType: 'weekly',
    startDate: weekStart.toISOString().split('T')[0],
    endDate: weekEnd.toISOString().split('T')[0],
    dayCount,
    daysWithData,
    targets: weeklyTargets,
    consumed: totals,
    averagePerDay,
    percentages,
    dailyData,
    entry_count: entryCount,
    byMealType,
  };
}

/**
 * Get weekly consumption summary with daily breakdown.
 * Uses date string to avoid timezone issues.
 */
export async function getWeeklyConsumptionByDateStr(
  userId: string,
  dateStr: string,
  todayStr?: string
): Promise<import('@/lib/types').PeriodConsumptionSummary> {
  const supabase = await createClient();

  // Get user's daily macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  // Use timezone-safe helpers
  const weekStartStr = getWeekStartFromDateStr(dateStr);
  const weekEndStr = getWeekEndFromDateStr(weekStartStr);

  const { dailyData, totals, entryCount, daysWithData, byMealType } = await getConsumptionRangeByDateStr(
    userId,
    weekStartStr,
    weekEndStr
  );

  const dayCount = 7;
  const dailyTargets: Macros = {
    calories: profile.target_calories,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };

  const weeklyTargets: Macros = {
    calories: dailyTargets.calories * dayCount,
    protein: dailyTargets.protein * dayCount,
    carbs: dailyTargets.carbs * dayCount,
    fat: dailyTargets.fat * dayCount,
  };

  // Exclude today from averages since the user likely hasn't finished logging for the day
  const todayData = todayStr ? dailyData.find((d) => d.date === todayStr) : undefined;
  const todayHasData = todayData && todayData.entry_count > 0;
  const avgTotals = todayHasData
    ? {
        calories: totals.calories - todayData.calories,
        protein: totals.protein - todayData.protein,
        carbs: totals.carbs - todayData.carbs,
        fat: totals.fat - todayData.fat,
      }
    : totals;
  const avgDaysWithData = todayHasData ? daysWithData - 1 : daysWithData;

  const averagePerDay: Macros =
    avgDaysWithData > 0
      ? {
          calories: Math.round(avgTotals.calories / avgDaysWithData),
          protein: Math.round((avgTotals.protein / avgDaysWithData) * 10) / 10,
          carbs: Math.round((avgTotals.carbs / avgDaysWithData) * 10) / 10,
          fat: Math.round((avgTotals.fat / avgDaysWithData) * 10) / 10,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const percentages: Macros = {
    calories:
      weeklyTargets.calories > 0 ? Math.round((totals.calories / weeklyTargets.calories) * 100) : 0,
    protein:
      weeklyTargets.protein > 0 ? Math.round((totals.protein / weeklyTargets.protein) * 100) : 0,
    carbs: weeklyTargets.carbs > 0 ? Math.round((totals.carbs / weeklyTargets.carbs) * 100) : 0,
    fat: weeklyTargets.fat > 0 ? Math.round((totals.fat / weeklyTargets.fat) * 100) : 0,
  };

  // Compute top contributors
  const contributorEntries = await getConsumptionEntriesForContributors(userId, weekStartStr, weekEndStr);
  const topContributors = await computeTopContributorsData(contributorEntries, userId);

  return {
    periodType: 'weekly',
    startDate: weekStartStr,
    endDate: weekEndStr,
    dayCount,
    daysWithData,
    targets: weeklyTargets,
    consumed: totals,
    averagePerDay,
    percentages,
    dailyData,
    entry_count: entryCount,
    byMealType,
    topContributors,
  };
}

/**
 * Get monthly consumption summary with daily breakdown.
 * Uses timezone-safe date string helpers.
 */
export async function getMonthlyConsumption(
  userId: string,
  year: number,
  month: number,
  todayStr?: string
): Promise<import('@/lib/types').PeriodConsumptionSummary> {
  const supabase = await createClient();

  // Get user's daily macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  // Use timezone-safe helper to get month bounds as strings
  const { startStr, endStr, dayCount } = getMonthBoundsAsStrings(year, month);

  const { dailyData, totals, entryCount, daysWithData, byMealType } = await getConsumptionRangeByDateStr(
    userId,
    startStr,
    endStr
  );

  const dailyTargets: Macros = {
    calories: profile.target_calories,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };

  const monthlyTargets: Macros = {
    calories: dailyTargets.calories * dayCount,
    protein: dailyTargets.protein * dayCount,
    carbs: dailyTargets.carbs * dayCount,
    fat: dailyTargets.fat * dayCount,
  };

  // Exclude today from averages since the user likely hasn't finished logging for the day
  const todayData = todayStr ? dailyData.find((d) => d.date === todayStr) : undefined;
  const todayHasData = todayData && todayData.entry_count > 0;
  const avgTotals = todayHasData
    ? {
        calories: totals.calories - todayData.calories,
        protein: totals.protein - todayData.protein,
        carbs: totals.carbs - todayData.carbs,
        fat: totals.fat - todayData.fat,
      }
    : totals;
  const avgDaysWithData = todayHasData ? daysWithData - 1 : daysWithData;

  const averagePerDay: Macros =
    avgDaysWithData > 0
      ? {
          calories: Math.round(avgTotals.calories / avgDaysWithData),
          protein: Math.round((avgTotals.protein / avgDaysWithData) * 10) / 10,
          carbs: Math.round((avgTotals.carbs / avgDaysWithData) * 10) / 10,
          fat: Math.round((avgTotals.fat / avgDaysWithData) * 10) / 10,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const percentages: Macros = {
    calories:
      monthlyTargets.calories > 0
        ? Math.round((totals.calories / monthlyTargets.calories) * 100)
        : 0,
    protein:
      monthlyTargets.protein > 0 ? Math.round((totals.protein / monthlyTargets.protein) * 100) : 0,
    carbs:
      monthlyTargets.carbs > 0 ? Math.round((totals.carbs / monthlyTargets.carbs) * 100) : 0,
    fat: monthlyTargets.fat > 0 ? Math.round((totals.fat / monthlyTargets.fat) * 100) : 0,
  };

  // Compute top contributors
  const contributorEntries = await getConsumptionEntriesForContributors(userId, startStr, endStr);
  const topContributors = await computeTopContributorsData(contributorEntries, userId);

  return {
    periodType: 'monthly',
    startDate: startStr,
    endDate: endStr,
    dayCount,
    daysWithData,
    targets: monthlyTargets,
    consumed: totals,
    averagePerDay,
    percentages,
    dailyData,
    entry_count: entryCount,
    byMealType,
    topContributors,
  };
}

/**
 * Get rolling-year summary data with weekly averages for macros, fruit/veg, and water.
 * Used by the Summary tab on the log-meal page.
 */
export async function getConsumptionSummary(userId: string, todayStr?: string): Promise<ConsumptionSummaryData> {
  const supabase = await createClient();

  // Get user's daily macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  // Calculate date range: 52 weeks back from today (Monday-aligned)
  if (!todayStr) {
    const now = new Date();
    todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const todayWeekStart = getWeekStartFromDateStr(todayStr);

  // Go back 51 more weeks from this week's Monday (52 weeks total including current)
  const [twsYear, twsMonth, twsDay] = todayWeekStart.split('-').map(Number);
  const rangeStart = new Date(Date.UTC(twsYear, twsMonth - 1, twsDay - 51 * 7, 12, 0, 0));
  const rangeStartStr = rangeStart.toISOString().split('T')[0];

  // Fetch all consumption entries in the range using pagination
  // NOTE: Supabase has a server-side max_rows limit (default 1000) that cannot be exceeded
  // by the client .limit() call. We must paginate to get all entries.
  const PAGE_SIZE = 1000;
  let entries: { consumed_date: string; calories: number; protein: number; carbs: number; fat: number; grams: number | null; ingredient_category: string | null }[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error: batchError } = await supabase
      .from('meal_consumption_log')
      .select('consumed_date, calories, protein, carbs, fat, grams, ingredient_category')
      .eq('user_id', userId)
      .gte('consumed_date', rangeStartStr)
      .lte('consumed_date', todayStr)
      .order('consumed_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (batchError) throw new Error(`Failed to fetch consumption entries: ${batchError.message}`);

    if (batch && batch.length > 0) {
      entries = entries.concat(batch);
      offset += batch.length;
      // If we got fewer than PAGE_SIZE, we've reached the end
      hasMore = batch.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // Fetch all water entries in the range
  const { data: waterEntries, error: waterError } = await supabase
    .from('daily_water_log')
    .select('date, ounces_consumed')
    .eq('user_id', userId)
    .gte('date', rangeStartStr)
    .lte('date', todayStr)
    .limit(500);  // Water has at most 1 entry per day, 500 is plenty for ~365 days

  if (waterError) throw new Error(`Failed to fetch water entries: ${waterError.message}`);

  // Build daily aggregates for macros and fruit/veg
  const dailyMacros = new Map<string, { calories: number; protein: number; carbs: number; fat: number; fruitVegGrams: number; hasEntries: boolean }>();

  // Helper to normalize date to YYYY-MM-DD format
  // Handles various formats: Date objects, ISO strings, YYYY-MM-DD strings
  const normalizeDate = (date: unknown): string => {
    if (!date) return '';
    if (typeof date === 'string') {
      // If already in YYYY-MM-DD format, return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // If it's an ISO datetime string, extract the date part
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      // Try to parse and reformat
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    // Return as string as fallback
    return String(date);
  };

  for (const entry of entries || []) {
    const date = normalizeDate(entry.consumed_date);
    const existing = dailyMacros.get(date) || { calories: 0, protein: 0, carbs: 0, fat: 0, fruitVegGrams: 0, hasEntries: false };

    existing.calories += entry.calories;
    existing.protein += entry.protein;
    existing.carbs += entry.carbs;
    existing.fat += entry.fat;
    existing.hasEntries = true;

    if (entry.ingredient_category && FRUIT_VEG_CATEGORIES.includes(entry.ingredient_category.toLowerCase())) {
      existing.fruitVegGrams += (entry.grams || 0);
    }

    dailyMacros.set(date, existing);
  }

  // Build daily water map
  const dailyWater = new Map<string, number>();
  for (const w of waterEntries || []) {
    dailyWater.set(normalizeDate(w.date), w.ounces_consumed);
  }

  // Generate 52 weekly data points
  const weeks: WeeklySummaryDataPoint[] = [];

  // Debug: Log entry count and date range
  const allDates = Array.from(dailyMacros.keys()).sort();
  console.log(`[Summary Debug] Total days with data: ${allDates.length}`);
  console.log(`[Summary Debug] Date range: ${allDates[0]} to ${allDates[allDates.length - 1]}`);
  console.log(`[Summary Debug] Total entries fetched: ${entries?.length ?? 0}`);

  for (let i = 0; i < 52; i++) {
    const weekStartDate = new Date(Date.UTC(twsYear, twsMonth - 1, twsDay - (51 - i) * 7, 12, 0, 0));
    const weekStartStr = weekStartDate.toISOString().split('T')[0];

    // Format week label (e.g., "Jan 6")
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekLabel = `${monthNames[weekStartDate.getUTCMonth()]} ${weekStartDate.getUTCDate()}`;

    // Debug: Log November weeks specifically
    if (weekStartStr.startsWith('2025-11')) {
      console.log(`[Summary Debug] November week: ${weekLabel} (${weekStartStr})`);
    }

    // Accumulate 7 days for this week
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFruitVegGrams = 0;
    let totalWaterOunces = 0;
    let daysWithMealData = 0;
    let daysWithWaterData = 0;

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(Date.UTC(
        weekStartDate.getUTCFullYear(),
        weekStartDate.getUTCMonth(),
        weekStartDate.getUTCDate() + d,
        12, 0, 0
      ));
      const dayStr = dayDate.toISOString().split('T')[0];

      // Don't count future days
      if (dayStr > todayStr) break;

      // Skip today from averages since the user likely hasn't finished logging
      if (dayStr === todayStr) continue;

      const macroData = dailyMacros.get(dayStr);

      // Debug: Log November day lookups
      if (dayStr.startsWith('2025-11')) {
        console.log(`[Summary Debug] Looking up ${dayStr}: found=${!!macroData?.hasEntries}, calories=${macroData?.calories ?? 0}`);
      }

      if (macroData?.hasEntries) {
        totalCalories += macroData.calories;
        totalProtein += macroData.protein;
        totalCarbs += macroData.carbs;
        totalFat += macroData.fat;
        totalFruitVegGrams += macroData.fruitVegGrams;
        daysWithMealData++;
      }

      const waterOunces = dailyWater.get(dayStr);
      if (waterOunces !== undefined && waterOunces > 0) {
        totalWaterOunces += waterOunces;
        daysWithWaterData++;
      }
    }

    // Debug: Log November week results
    if (weekStartStr.startsWith('2025-11')) {
      console.log(`[Summary Debug] Week ${weekLabel} result: daysWithMealData=${daysWithMealData}, totalCalories=${totalCalories}`);
    }

    weeks.push({
      weekStart: weekStartStr,
      weekLabel,
      avgCalories: daysWithMealData > 0 ? Math.round(totalCalories / daysWithMealData) : 0,
      avgProtein: daysWithMealData > 0 ? Math.round((totalProtein / daysWithMealData) * 10) / 10 : 0,
      avgCarbs: daysWithMealData > 0 ? Math.round((totalCarbs / daysWithMealData) * 10) / 10 : 0,
      avgFat: daysWithMealData > 0 ? Math.round((totalFat / daysWithMealData) * 10) / 10 : 0,
      daysWithData: daysWithMealData,
      avgFruitVegGrams: daysWithMealData > 0 ? Math.round(totalFruitVegGrams / daysWithMealData) : 0,
      avgWaterOunces: daysWithWaterData > 0 ? Math.round(totalWaterOunces / daysWithWaterData) : 0,
    });
  }

  return {
    weeks,
    targets: {
      calories: profile.target_calories,
      protein: profile.target_protein,
      carbs: profile.target_carbs,
      fat: profile.target_fat,
      fruitVegGrams: FRUIT_VEG_GOAL_GRAMS,
      waterOunces: WATER_GOAL_OUNCES,
    },
  };
}

/**
 * Get water progress for a specific date.
 */
export async function getWaterProgress(userId: string, dateStr: string): Promise<WaterProgress> {
  const supabase = await createClient();

  const { data: waterLog } = await supabase
    .from('daily_water_log')
    .select('ounces_consumed, goal_ounces, goal_celebrated')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  return {
    currentOunces: waterLog?.ounces_consumed || 0,
    goalOunces: waterLog?.goal_ounces || WATER_GOAL_OUNCES,
    percentage: WATER_GOAL_OUNCES > 0 ? Math.round(((waterLog?.ounces_consumed || 0) / WATER_GOAL_OUNCES) * 100) : 0,
    goalCelebrated: waterLog?.goal_celebrated || false,
  };
}

/**
 * Add water intake for a specific date.
 * Uses upsert to create or increment the daily water log.
 */
export async function addWater(userId: string, dateStr: string, ounces: number): Promise<WaterProgress> {
  const supabase = await createClient();

  // First, get existing water log for the day
  const { data: existing } = await supabase
    .from('daily_water_log')
    .select('id, ounces_consumed, goal_ounces, goal_celebrated')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  if (existing) {
    // Update existing entry - increment ounces
    const newOunces = existing.ounces_consumed + ounces;
    await supabase
      .from('daily_water_log')
      .update({
        ounces_consumed: newOunces,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return {
      currentOunces: newOunces,
      goalOunces: existing.goal_ounces,
      percentage: WATER_GOAL_OUNCES > 0 ? Math.round((newOunces / WATER_GOAL_OUNCES) * 100) : 0,
      goalCelebrated: existing.goal_celebrated,
    };
  } else {
    // Insert new entry
    const { data: newLog } = await supabase
      .from('daily_water_log')
      .insert({
        user_id: userId,
        date: dateStr,
        ounces_consumed: ounces,
        goal_ounces: WATER_GOAL_OUNCES,
      })
      .select()
      .single();

    return {
      currentOunces: newLog?.ounces_consumed || ounces,
      goalOunces: newLog?.goal_ounces || WATER_GOAL_OUNCES,
      percentage: WATER_GOAL_OUNCES > 0 ? Math.round((ounces / WATER_GOAL_OUNCES) * 100) : 0,
      goalCelebrated: false,
    };
  }
}

// ============================================
// Top Macro Contributors Functions
// ============================================

/** Type for consumption entries with fields needed for contributor calculation */
type ContributorEntry = {
  entry_type: string;
  meal_id: string | null;
  ingredient_name: string | null;
  display_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number | null;
  ingredient_category: string | null;
};

/** Type for aggregated contribution data */
type ContributionData = {
  name: string;
  displayName: string; // First-seen casing for display
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  entryCount: number;
};

/**
 * Rank contributions by each macro and return top N + "Others" aggregate.
 * This is a pure function with no database calls.
 */
function computeTopContributors(
  contributions: ContributionData[],
  topN: number = 10
): MacroContributors {
  const macroKeys = ['calories', 'protein', 'carbs', 'fat'] as const;
  const result: MacroContributors = {
    calories: [],
    protein: [],
    carbs: [],
    fat: [],
  };

  for (const macro of macroKeys) {
    // Calculate total for this macro
    const total = contributions.reduce((sum, c) => sum + c[macro], 0);

    // Sort contributions by this macro (descending)
    const sorted = [...contributions]
      .filter((c) => c[macro] > 0)
      .sort((a, b) => b[macro] - a[macro]);

    // Take top N
    const topItems = sorted.slice(0, topN);
    const rest = sorted.slice(topN);

    // Build result items
    const items: ContributorItem[] = topItems.map((item) => ({
      name: item.displayName,
      value: macro === 'calories' ? Math.round(item[macro]) : Math.round(item[macro] * 10) / 10,
      percentage: total > 0 ? Math.round((item[macro] / total) * 100) : 0,
      entryCount: item.entryCount,
    }));

    // Add "Others" row if there are remaining items with positive values
    if (rest.length > 0) {
      const othersValue = rest.reduce((sum, c) => sum + c[macro], 0);
      const othersCount = rest.reduce((sum, c) => sum + c.entryCount, 0);
      if (othersValue > 0) {
        items.push({
          name: `Others (${rest.length} ${rest.length === 1 ? 'item' : 'items'})`,
          value: macro === 'calories' ? Math.round(othersValue) : Math.round(othersValue * 10) / 10,
          percentage: total > 0 ? Math.round((othersValue / total) * 100) : 0,
          entryCount: othersCount,
          isAggregate: true,
          aggregateCount: rest.length,
        });
      }
    }

    result[macro] = items;
  }

  return result;
}

/**
 * Resolve consumption entries into ingredient-level contributions.
 * For meal entries: look up meal's ingredients JSONB and scale by portion ratio
 * For ingredient entries: use directly
 */
async function resolveIngredientContributions(
  entries: ContributorEntry[],
  userId: string
): Promise<ContributionData[]> {
  const supabase = await createClient();

  // Filter out 800g-only entries (0 calories, has grams, is fruit/vegetable)
  const filteredEntries = entries.filter((e) => {
    const is800gOnly =
      e.calories === 0 &&
      e.grams !== null &&
      e.grams > 0 &&
      e.ingredient_category &&
      FRUIT_VEG_CATEGORIES.includes(e.ingredient_category);
    return !is800gOnly;
  });

  // Collect unique meal_ids from meal-based entries
  const mealIds = new Set<string>();
  for (const entry of filteredEntries) {
    if (entry.entry_type !== 'ingredient' && entry.meal_id) {
      mealIds.add(entry.meal_id);
    }
  }

  // Batch fetch meals with ingredients
  type MealWithIngredients = {
    id: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    ingredients: Array<{
      name: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }>;
  };
  const mealsMap = new Map<string, MealWithIngredients>();

  if (mealIds.size > 0) {
    const { data: meals } = await supabase
      .from('meals')
      .select('id, calories, protein, carbs, fat, ingredients')
      .in('id', Array.from(mealIds));

    if (meals) {
      for (const meal of meals) {
        mealsMap.set(meal.id, meal as MealWithIngredients);
      }
    }
  }

  // Aggregation map: normalized name -> contribution data
  const aggregationMap = new Map<string, ContributionData>();

  for (const entry of filteredEntries) {
    if (entry.entry_type === 'ingredient') {
      // Direct ingredient entry
      const key = normalizeIngredientName(entry.ingredient_name || entry.display_name);
      const existing = aggregationMap.get(key);

      if (existing) {
        existing.calories += entry.calories;
        existing.protein += entry.protein;
        existing.carbs += entry.carbs;
        existing.fat += entry.fat;
        existing.entryCount += 1;
      } else {
        aggregationMap.set(key, {
          name: key,
          displayName: entry.ingredient_name || entry.display_name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          entryCount: 1,
        });
      }
    } else if (entry.meal_id && mealsMap.has(entry.meal_id)) {
      // Meal-based entry with ingredient data available
      const meal = mealsMap.get(entry.meal_id)!;

      // Compute scale factor: how much did user modify the portion?
      const scaleFactor = meal.calories > 0 ? entry.calories / meal.calories : 1;

      // Process each ingredient
      const ingredients = meal.ingredients || [];
      for (const ing of ingredients) {
        const key = normalizeIngredientName(ing.name);
        const scaledCalories = (ing.calories || 0) * scaleFactor;
        const scaledProtein = (ing.protein || 0) * scaleFactor;
        const scaledCarbs = (ing.carbs || 0) * scaleFactor;
        const scaledFat = (ing.fat || 0) * scaleFactor;

        const existing = aggregationMap.get(key);
        if (existing) {
          existing.calories += scaledCalories;
          existing.protein += scaledProtein;
          existing.carbs += scaledCarbs;
          existing.fat += scaledFat;
          existing.entryCount += 1;
        } else {
          aggregationMap.set(key, {
            name: key,
            displayName: ing.name,
            calories: scaledCalories,
            protein: scaledProtein,
            carbs: scaledCarbs,
            fat: scaledFat,
            entryCount: 1,
          });
        }
      }
    } else {
      // Meal entry but meal was deleted or not found - treat as single item
      const key = normalizeIngredientName(entry.display_name);
      const existing = aggregationMap.get(key);

      if (existing) {
        existing.calories += entry.calories;
        existing.protein += entry.protein;
        existing.carbs += entry.carbs;
        existing.fat += entry.fat;
        existing.entryCount += 1;
      } else {
        aggregationMap.set(key, {
          name: key,
          displayName: entry.display_name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          entryCount: 1,
        });
      }
    }
  }

  return Array.from(aggregationMap.values());
}

/**
 * Build meal-level contributions directly from entries.
 * Aggregates by display_name (meal name).
 */
function buildMealContributions(entries: ContributorEntry[]): ContributionData[] {
  // Filter out 800g-only entries
  const filteredEntries = entries.filter((e) => {
    const is800gOnly =
      e.calories === 0 &&
      e.grams !== null &&
      e.grams > 0 &&
      e.ingredient_category &&
      FRUIT_VEG_CATEGORIES.includes(e.ingredient_category);
    return !is800gOnly;
  });

  // Aggregation map: normalized name -> contribution data
  const aggregationMap = new Map<string, ContributionData>();

  for (const entry of filteredEntries) {
    const key = normalizeIngredientName(entry.display_name);
    const existing = aggregationMap.get(key);

    if (existing) {
      existing.calories += entry.calories;
      existing.protein += entry.protein;
      existing.carbs += entry.carbs;
      existing.fat += entry.fat;
      existing.entryCount += 1;
    } else {
      aggregationMap.set(key, {
        name: key,
        displayName: entry.display_name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        entryCount: 1,
      });
    }
  }

  return Array.from(aggregationMap.values());
}

/**
 * Compute both ingredient-level and meal-level top contributors.
 */
export async function computeTopContributorsData(
  entries: ContributorEntry[],
  userId: string
): Promise<TopContributorsData> {
  // Resolve ingredient-level contributions
  const ingredientContributions = await resolveIngredientContributions(entries, userId);

  // Build meal-level contributions
  const mealContributions = buildMealContributions(entries);

  return {
    byIngredient: computeTopContributors(ingredientContributions),
    byMeal: computeTopContributors(mealContributions),
  };
}

/**
 * Get consumption entries with additional fields needed for top contributors.
 * This is separate from getConsumptionRangeByDateStr to keep the original function lean.
 */
export async function getConsumptionEntriesForContributors(
  userId: string,
  startStr: string,
  endStr: string
): Promise<ContributorEntry[]> {
  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from('meal_consumption_log')
    .select(
      'entry_type, meal_id, ingredient_name, display_name, calories, protein, carbs, fat, grams, ingredient_category'
    )
    .eq('user_id', userId)
    .gte('consumed_date', startStr)
    .lte('consumed_date', endStr);

  if (error) throw new Error(`Failed to fetch entries for contributors: ${error.message}`);

  return (entries || []) as ContributorEntry[];
}
