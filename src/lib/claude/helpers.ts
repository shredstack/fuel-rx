import type {
  DayPlan,
  Meal,
  Macros,
  Ingredient,
  MealWithIngredientNutrition,
  DayOfWeek,
  MealType,
  HouseholdServingsPrefs,
  SelectableMealType,
} from '../types';
import { DAYS_OF_WEEK, CHILD_PORTION_MULTIPLIER, DAY_OF_WEEK_LABELS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS, DEFAULT_SELECTED_MEAL_TYPES } from '../types';

// ============================================
// Constants
// ============================================

export const DIETARY_LABELS: Record<string, string> = {
  no_restrictions: 'No Restrictions',
  paleo: 'Paleo',
  vegetarian: 'Vegetarian',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
};

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// ============================================
// Meal Organization Helpers
// ============================================

/**
 * Helper function to organize meals into day plans
 */
export function organizeMealsIntoDays(mealsResult: { meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }): DayPlan[] {
  const mealsByDay = new Map<DayOfWeek, Meal[]>();
  for (const day of DAYS) {
    mealsByDay.set(day, []);
  }

  for (const meal of mealsResult.meals) {
    const dayMeals = mealsByDay.get(meal.day as DayOfWeek) || [];
    dayMeals.push({
      name: meal.name,
      type: meal.type,
      prep_time_minutes: meal.prep_time_minutes,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      macros: meal.macros,
    });
    mealsByDay.set(meal.day as DayOfWeek, dayMeals);
  }

  // Build day plans with totals
  return DAYS.map(day => {
    const meals = mealsByDay.get(day) || [];
    const daily_totals: Macros = meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + meal.macros.calories,
        protein: totals.protein + meal.macros.protein,
        carbs: totals.carbs + meal.macros.carbs,
        fat: totals.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return { day, meals, daily_totals };
  });
}

/**
 * Collect all ingredients from meal plans without consolidation
 * Used for LLM processing of grocery lists
 */
export function collectRawIngredients(days: DayPlan[]): Ingredient[] {
  const allIngredients: Ingredient[] = [];

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients) {
        allIngredients.push({ ...ingredient });
      }
    }
  }

  return allIngredients;
}

/**
 * Determine which meal types we need based on selected meal types and snack count
 *
 * @param selectedMealTypes - Array of meal types user has selected (breakfast, pre_workout, lunch, post_workout, dinner)
 * @param snackCount - Number of snacks per day (0-4)
 * @returns Array of meal types in proper order for a day
 */
export function getMealTypesForPlan(
  selectedMealTypes: SelectableMealType[] = DEFAULT_SELECTED_MEAL_TYPES,
  snackCount: number = 0
): MealType[] {
  // Define the canonical order of all possible meal types
  const mealOrder: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner'];

  // Filter to only selected meal types, maintaining order
  const orderedMeals = mealOrder.filter(type =>
    selectedMealTypes.includes(type as SelectableMealType)
  );

  // Add snacks - distribute them throughout the day
  // If 1 snack: after lunch
  // If 2 snacks: mid-morning and afternoon
  // If 3 snacks: mid-morning, afternoon, evening
  // If 4 snacks: spread throughout
  const result: MealType[] = [];

  for (const meal of orderedMeals) {
    result.push(meal);

    // Add snacks at strategic points
    if (snackCount >= 2 && meal === 'breakfast') {
      result.push('snack'); // Mid-morning snack
    }
    if (snackCount >= 1 && meal === 'lunch') {
      result.push('snack'); // Afternoon snack
    }
    if (snackCount >= 3 && meal === 'dinner') {
      result.push('snack'); // Evening snack
    }
  }

  // If we have 4 snacks, add one more (before dinner if we haven't placed it)
  if (snackCount >= 4) {
    // Find dinner index and add snack before it
    const dinnerIndex = result.indexOf('dinner');
    if (dinnerIndex > 0) {
      result.splice(dinnerIndex, 0, 'snack');
    } else {
      result.push('snack');
    }
  }

  return result;
}

/**
 * Legacy helper for backward compatibility
 * Converts old meals_per_day number to new format
 * @deprecated Use getMealTypesForPlan with selectedMealTypes and snackCount instead
 */
export function getMealTypesForPlanLegacy(mealsPerDay: number): MealType[] {
  switch (mealsPerDay) {
    case 3:
      return getMealTypesForPlan(['breakfast', 'lunch', 'dinner'], 0);
    case 4:
      return getMealTypesForPlan(['breakfast', 'lunch', 'dinner'], 1);
    case 5:
      return getMealTypesForPlan(['breakfast', 'lunch', 'dinner'], 2);
    case 6:
      return getMealTypesForPlan(['breakfast', 'lunch', 'dinner'], 3);
    default:
      return getMealTypesForPlan(['breakfast', 'lunch', 'dinner'], 0);
  }
}

// ============================================
// Household Servings Helper Functions
// ============================================

/**
 * Check if user has any household members configured
 */
export function hasHouseholdMembers(servings: HouseholdServingsPrefs): boolean {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  return DAYS_OF_WEEK.some(day =>
    mealTypes.some(meal => servings[day]?.[meal]?.adults > 0 || servings[day]?.[meal]?.children > 0)
  );
}

/**
 * Calculate the serving multiplier for a specific day and meal
 * Returns the total multiplier (1 for the athlete + additional household members)
 */
export function getServingMultiplier(
  servings: HouseholdServingsPrefs,
  day: DayOfWeek,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
): number {
  const dayServings = servings[day]?.[mealType];
  if (!dayServings) return 1;

  // Athlete counts as 1, additional adults as 1 each, children as 0.6 each
  return 1 + dayServings.adults + (dayServings.children * CHILD_PORTION_MULTIPLIER);
}

/**
 * Build a summary of household servings for LLM prompts
 */
export function buildHouseholdContextSection(servings: HouseholdServingsPrefs): string {
  if (!hasHouseholdMembers(servings)) {
    return '';
  }

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  const lines: string[] = [];

  // Build a day-by-day summary
  for (const day of DAYS_OF_WEEK) {
    const dayServings = servings[day];
    const mealSummaries: string[] = [];

    for (const meal of mealTypes) {
      const serving = dayServings?.[meal];
      if (serving && (serving.adults > 0 || serving.children > 0)) {
        const parts: string[] = [];
        if (serving.adults > 0) parts.push(`${serving.adults} additional adult${serving.adults > 1 ? 's' : ''}`);
        if (serving.children > 0) parts.push(`${serving.children} child${serving.children > 1 ? 'ren' : ''}`);
        const multiplier = getServingMultiplier(servings, day, meal);
        mealSummaries.push(`${meal}: ${parts.join(' + ')} (${multiplier.toFixed(1)}x portions)`);
      }
    }

    if (mealSummaries.length > 0) {
      lines.push(`- ${DAY_OF_WEEK_LABELS[day]}: ${mealSummaries.join(', ')}`);
    }
  }

  if (lines.length === 0) return '';

  return `
## HOUSEHOLD SERVINGS (IMPORTANT)
The athlete is also cooking for their household. Generate prep instructions and grocery quantities for the FULL household, not just the athlete.

**Household schedule:**
${lines.join('\n')}

**Key guidelines:**
- The athlete's personal macro targets are still the priority for meal COMPOSITION
- But prep instructions should be for the FULL batch size (all household members)
- Grocery quantities should be scaled to feed everyone
- Children count as approximately 0.6x an adult portion
- Choose meals that scale well and are broadly appealing when feeding children
`;
}

/**
 * Calculate the average serving multiplier across all meals for grocery scaling
 */
export function getAverageServingMultiplier(servings: HouseholdServingsPrefs): number {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  let totalMultiplier = 0;
  let count = 0;

  for (const day of DAYS_OF_WEEK) {
    for (const meal of mealTypes) {
      totalMultiplier += getServingMultiplier(servings, day, meal);
      count++;
    }
  }

  return count > 0 ? totalMultiplier / count : 1;
}

/**
 * Get a human-readable description of the household size
 */
export function getHouseholdDescription(servings: HouseholdServingsPrefs): string {
  let totalAdults = 1; // Athlete
  let totalChildren = 0;

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

  for (const day of DAYS_OF_WEEK) {
    for (const meal of mealTypes) {
      const dayServings = servings[day]?.[meal];
      if (dayServings) {
        totalAdults = Math.max(totalAdults, 1 + (dayServings.adults || 0));
        totalChildren = Math.max(totalChildren, dayServings.children || 0);
      }
    }
  }

  if (totalChildren > 0) {
    return `${totalAdults} adults and ${totalChildren} children`;
  }
  return totalAdults === 1 ? 'just the athlete' : `${totalAdults} adults`;
}
