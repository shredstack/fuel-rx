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
} from '@/lib/types';

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
    // Fetch from meal_plan_meals with joined meal data
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

    if (error || !data) throw new Error('Meal not found');
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

  // Create consumption entry with macro snapshot
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
      meal_type: mealData.meal_type,
      calories: Math.round(mealData.calories),
      protein: Math.round(mealData.protein * 10) / 10,
      carbs: Math.round(mealData.carbs * 10) / 10,
      fat: Math.round(mealData.fat * 10) / 10,
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
      amount: request.amount,
      unit: request.unit,
      calories: Math.round(request.calories),
      protein: Math.round(request.protein * 10) / 10,
      carbs: Math.round(request.carbs * 10) / 10,
      fat: Math.round(request.fat * 10) / 10,
      notes: request.notes,
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
  });

  return entry as ConsumptionEntry;
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
 * Get meals from all user meal plans, deduplicated by meal_id (keeping newest).
 * Excludes party_meal source_type.
 * Orders by plan creation date (newest first), then by meal type.
 */
async function getLatestPlanMeals(
  userId: string,
  todaysLogs: { id: string; meal_plan_meal_id: string | null; meal_id: string | null; consumed_at: string }[]
): Promise<MealPlanMealToLog[]> {
  const supabase = await createClient();

  // Get all user's meal plans ordered by creation (newest first)
  const { data: userPlans, error: plansError } = await supabase
    .from('meal_plans')
    .select('id, week_start_date, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log('[getLatestPlanMeals] userPlans count:', userPlans?.length, 'error:', plansError?.message);

  if (!userPlans || userPlans.length === 0) {
    return [];
  }

  const planIds = userPlans.map((p) => p.id);
  const planMap = new Map(userPlans.map((p) => [p.id, p]));

  // Fetch all meals from all plans
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

  console.log('[getLatestPlanMeals] planMeals count:', planMeals?.length, 'error:', mealsError?.message);

  if (!planMeals || planMeals.length === 0) {
    return [];
  }

  // Filter out party_meal source_type in JavaScript (more reliable than PostgREST filter on joined table)
  const filteredPlanMeals = planMeals.filter((pm) => {
    const meal = pm.meals as unknown as { source_type?: string };
    return meal.source_type !== 'party_meal';
  });

  console.log('[getLatestPlanMeals] after party_meal filter:', filteredPlanMeals.length);

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

  // Sort by plan creation date (newest first) to ensure deduplication keeps newest
  const sortedPlanMeals = [...filteredPlanMeals].sort((a, b) => {
    const planA = planMap.get(a.meal_plan_id);
    const planB = planMap.get(b.meal_plan_id);
    if (!planA || !planB) return 0;
    return new Date(planB.created_at).getTime() - new Date(planA.created_at).getTime();
  });

  // Deduplicate by meal_id, keeping only the first occurrence (from newest plan)
  const seenMealIds = new Set<string>();
  const results: MealPlanMealToLog[] = [];

  for (const pm of sortedPlanMeals) {
    if (seenMealIds.has(pm.meal_id)) {
      continue;
    }
    seenMealIds.add(pm.meal_id);

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
      plan_title: plan.title,
      day_of_week: pm.day,
      day_label: dayLabels[pm.day] || pm.day,
      meal_id: pm.meal_id,
      ...logInfo,
    });
  }

  // Sort by meal type order for display
  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  results.sort((a, b) => (mealTypeOrder[a.meal_type || 'snack'] || 4) - (mealTypeOrder[b.meal_type || 'snack'] || 4));

  console.log('[getLatestPlanMeals] final results count:', results.length);
  return results;
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

  if (frequent) {
    results.push(
      ...frequent.map((f) => ({
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
      }))
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
          // - User-added ingredients check the validated column
          const isUserAdded = c.is_user_added === true;
          const isValidated = !isUserAdded || c.validated === true;

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
          };
        })
    );
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
  macros: { calories: number; protein: number; carbs: number; fat: number }
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
 * Returns daily data points for charting.
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
}> {
  const supabase = await createClient();
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Get all entries in date range
  const { data: entries, error } = await supabase
    .from('meal_consumption_log')
    .select('consumed_date, calories, protein, carbs, fat')
    .eq('user_id', userId)
    .gte('consumed_date', startStr)
    .lte('consumed_date', endStr)
    .order('consumed_date', { ascending: true });

  if (error) throw new Error(`Failed to fetch entries: ${error.message}`);

  // Group entries by date
  const dailyMap = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number; count: number }
  >();

  for (const entry of entries || []) {
    const date = entry.consumed_date;
    const existing = dailyMap.get(date) || { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    dailyMap.set(date, {
      calories: existing.calories + entry.calories,
      protein: existing.protein + entry.protein,
      carbs: existing.carbs + entry.carbs,
      fat: existing.fat + entry.fat,
      count: existing.count + 1,
    });
  }

  // Generate all dates in range (even if no data)
  const dailyData: import('@/lib/types').DailyDataPoint[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr);
    dailyData.push({
      date: dateStr,
      calories: dayData?.calories || 0,
      protein: Math.round((dayData?.protein || 0) * 10) / 10,
      carbs: Math.round((dayData?.carbs || 0) * 10) / 10,
      fat: Math.round((dayData?.fat || 0) * 10) / 10,
      entry_count: dayData?.count || 0,
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

  return { dailyData, totals, entryCount, daysWithData };
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

  const { dailyData, totals, entryCount, daysWithData } = await getConsumptionRange(
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
  };
}

/**
 * Get monthly consumption summary with daily breakdown.
 */
export async function getMonthlyConsumption(
  userId: string,
  year: number,
  month: number
): Promise<import('@/lib/types').PeriodConsumptionSummary> {
  const supabase = await createClient();

  // Get user's daily macro targets
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new Error('Profile not found');

  const { start: monthStart, end: monthEnd } = getMonthBounds(year, month);
  const dayCount = monthEnd.getDate(); // Number of days in month

  const { dailyData, totals, entryCount, daysWithData } = await getConsumptionRange(
    userId,
    monthStart,
    monthEnd
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
      monthlyTargets.calories > 0
        ? Math.round((totals.calories / monthlyTargets.calories) * 100)
        : 0,
    protein:
      monthlyTargets.protein > 0 ? Math.round((totals.protein / monthlyTargets.protein) * 100) : 0,
    carbs:
      monthlyTargets.carbs > 0 ? Math.round((totals.carbs / monthlyTargets.carbs) * 100) : 0,
    fat: monthlyTargets.fat > 0 ? Math.round((totals.fat / monthlyTargets.fat) * 100) : 0,
  };

  return {
    periodType: 'monthly',
    startDate: monthStart.toISOString().split('T')[0],
    endDate: monthEnd.toISOString().split('T')[0],
    dayCount,
    daysWithData,
    targets: monthlyTargets,
    consumed: totals,
    averagePerDay,
    percentages,
    dailyData,
    entry_count: entryCount,
  };
}
