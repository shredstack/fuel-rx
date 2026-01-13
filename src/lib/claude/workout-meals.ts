import type { UserProfile, MealType, MealWithIngredientNutrition, DayOfWeek, SelectableMealType } from '../types';
import { DEFAULT_MEAL_CONSISTENCY_PREFS } from '../types';

interface WorkoutMealPromptParams {
  profile: UserProfile;
  targetCalories: number;
  mealType: 'pre_workout' | 'post_workout';
  availableIngredients: string[];
}

/**
 * Get calorie target for pre-workout meal based on user preference
 */
export function getPreWorkoutCalorieTarget(profile: UserProfile): number {
  switch (profile.pre_workout_preference) {
    case 'light':
      return 125; // 100-150 cal midpoint
    case 'moderate':
      return 250; // 200-300 cal midpoint
    case 'substantial':
      return 450; // 400-500 cal midpoint
    default:
      return 125;
  }
}

/**
 * Get calorie target for post-workout meal
 * Post-workout is typically more substantial for recovery
 */
export function getPostWorkoutCalorieTarget(profile: UserProfile): number {
  // Post-workout should be 8-12% of daily calories, leaning toward more substantial
  const minCal = Math.round(profile.target_calories * 0.08);
  const maxCal = Math.round(profile.target_calories * 0.12);
  return Math.round((minCal + maxCal) / 2);
}

/**
 * Generate the workout meal prompt
 */
export function generateWorkoutMealPrompt(params: WorkoutMealPromptParams): string {
  const { profile, targetCalories, mealType, availableIngredients } = params;

  const isPreWorkout = mealType === 'pre_workout';

  const preWorkoutGuidance = `
## PRE-WORKOUT MEAL REQUIREMENTS

**CRITICAL: GRAB-AND-GO SIMPLICITY**
Pre-workout should be QUICK and SIMPLE - not a fancy meal. Think "something I can eat in 2 minutes before heading to the gym."
- Minimal to NO prep required
- 1-2 ingredients max
- Can be eaten standing up or on-the-go
- NO cooking required (raw, pre-made, or assembled only)

**Timing Context:** Eaten 30-60 minutes before training

**Nutritional Goals:**
- Quick-digesting carbs for immediate energy
- Moderate protein to prevent muscle breakdown
- LOW fat and fiber (slows digestion, can cause discomfort)

**Ideal Macro Ratio:**
- Carbs: 60-70% of calories
- Protein: 20-30% of calories
- Fat: <10% of calories

**IDEAL Pre-Workout Options (simple is better):**
- A banana (perfect: quick carbs, easy to eat, no prep)
- Toast with honey (minimal prep)
- Rice cakes with a thin spread
- Small bowl of oatmeal (if made ahead)
- Greek yogurt (grab from fridge)
- Apple slices
- A few dates

**Avoid Pre-Workout:**
- High fat foods (nuts, avocado, cheese)
- High fiber vegetables (broccoli, beans)
- Large protein portions
- Anything that sits heavy
- Complex recipes with multiple steps
`;

  const postWorkoutGuidance = `
## POST-WORKOUT MEAL REQUIREMENTS

**CRITICAL: QUICK RECOVERY FUEL**
Post-workout should be SIMPLE and PROTEIN-FOCUSED - not an elaborate recipe. Think "grab from the fridge after showering."
- Minimal prep required (5 min max)
- Focus on protein delivery first
- Can be assembled quickly
- NO complex cooking required

**Timing Context:** Eaten within 30-60 minutes after training

**Nutritional Goals:**
- PROTEIN for muscle recovery and synthesis (this is the priority)
- Carbs to replenish glycogen stores
- Moderate fat is acceptable

**Ideal Macro Ratio:**
- Protein: 30-40% of calories
- Carbs: 40-50% of calories
- Fat: 15-25% of calories

**IDEAL Post-Workout Options (protein-first, simple):**
- Greek yogurt with berries (high protein, grab and eat)
- Cottage cheese with fruit
- Hard-boiled eggs with toast (can prep eggs ahead)
- Chocolate milk (convenient, good protein-carb ratio)
- Turkey or chicken slices with crackers
- Protein shake with banana

**Recovery Focus:**
- Prioritize COMPLETE proteins (eggs, dairy, meat)
- Include fast-absorbing carbs
- Hydration is also key
- Keep it simple - recovery is the goal, not gourmet cooking
`;

  return `
You are creating a ${isPreWorkout ? 'pre' : 'post'}-workout ${isPreWorkout ? 'snack' : 'meal'} for a CrossFit athlete.

${isPreWorkout ? preWorkoutGuidance : postWorkoutGuidance}

## AVAILABLE INGREDIENTS
You may ONLY use ingredients from this list:
${availableIngredients.map(ing => `- ${ing}`).join('\n')}

## CALORIE TARGET
This ${mealType.replace('_', '-')} should provide approximately **${targetCalories} calories** (±30 cal acceptable).

## ACCURACY REQUIREMENTS (NON-NEGOTIABLE)
1. Use accurate nutrition values for all ingredients
2. Meal total must equal sum of ingredients
3. Do not fabricate nutrition values to hit targets
4. If you cannot hit ${targetCalories} cal with appropriate foods, get as close as possible

## OUTPUT FORMAT
Return a single meal in this JSON format:
{
  "name": "Descriptive meal name",
  "meal_type": "${mealType}",
  "prep_time_minutes": <number>,
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "<number>",
      "unit": "<unit>",
      "category": "<produce|protein|dairy|grains|fats|other>",
      "calories": <number>,
      "protein": <number>,
      "carbs": <number>,
      "fat": <number>
    }
  ],
  "macros": {
    "calories": <sum of ingredient calories>,
    "protein": <sum>,
    "carbs": <sum>,
    "fat": <sum>
  },
  "instructions": ["Step 1...", "Step 2..."],
  "notes": "Brief note about timing or tips"
}
`;
}

/**
 * Get workout meal instructions to add to the main meal generation prompt
 * when user has workout meals selected
 */
export function getWorkoutMealInstructions(profile: UserProfile): string {
  // Check if user has selected workout meals in the new system
  const selectedMealTypes = profile.selected_meal_types ?? [];
  const hasPreWorkout = selectedMealTypes.includes('pre_workout');
  const hasPostWorkout = selectedMealTypes.includes('post_workout');

  // Fall back to legacy field if selected_meal_types is empty
  const includeWorkoutMeals = (hasPreWorkout || hasPostWorkout) || profile.include_workout_meals;

  if (!includeWorkoutMeals) {
    return '';
  }

  const preWorkoutCal = getPreWorkoutCalorieTarget(profile);
  const postWorkoutCal = getPostWorkoutCalorieTarget(profile);

  const sections: string[] = ['## WORKOUT MEALS\n'];

  sections.push(`**CRITICAL**: Workout meals should be SIMPLE grab-and-go options, NOT fancy recipes.
These are functional fuel, not gourmet meals. 1-3 ingredients max, minimal prep.`);

  // Add consistency instructions for workout meals
  const mealConsistencyPrefs = profile.meal_consistency_prefs ?? DEFAULT_MEAL_CONSISTENCY_PREFS;
  const preWorkoutConsistency = mealConsistencyPrefs['pre_workout'] ?? 'consistent';
  const postWorkoutConsistency = mealConsistencyPrefs['post_workout'] ?? 'consistent';

  // Build consistency instruction for workout meals
  const consistencyParts: string[] = [];
  if (hasPreWorkout || profile.include_workout_meals) {
    if (preWorkoutConsistency === 'consistent') {
      consistencyParts.push(`- **Pre-Workout**: Generate 1 meal (will be eaten ALL 7 days - same pre-workout every day)`);
    } else {
      consistencyParts.push(`- **Pre-Workout**: Generate 7 different meals (one unique pre-workout per day)`);
    }
  }
  if (hasPostWorkout || profile.include_workout_meals) {
    if (postWorkoutConsistency === 'consistent') {
      consistencyParts.push(`- **Post-Workout**: Generate 1 meal (will be eaten ALL 7 days - same post-workout every day)`);
    } else {
      consistencyParts.push(`- **Post-Workout**: Generate 7 different meals (one unique post-workout per day)`);
    }
  }

  if (consistencyParts.length > 0) {
    sections.push(`### Workout Meal Consistency
${consistencyParts.join('\n')}`);
  }

  if (hasPreWorkout || profile.include_workout_meals) {
    sections.push(`### Pre-Workout (${preWorkoutCal} cal target)
- **KEEP IT SIMPLE** - 1-2 ingredients, no cooking required
- Timing: 30-60 min before training
- Focus: Quick carbs (60-70%), moderate protein (20-30%), minimal fat (<10%)
- Macro ratio matters: CARB-HEAVY for energy
- **Perfect examples**: just a banana, toast with honey, rice cakes, small yogurt
- **NOT**: elaborate smoothie bowls or complex recipes`);
  }

  if (hasPostWorkout || profile.include_workout_meals) {
    sections.push(`### Post-Workout (${postWorkoutCal} cal target)
- **KEEP IT SIMPLE** - can be assembled in 5 min or less
- Timing: Within 60 min after training
- Focus: Protein first (30-40%), carbs for recovery (40-50%), moderate fat OK (15-25%)
- Macro ratio matters: PROTEIN-HEAVY for muscle recovery
- **Perfect examples**: Greek yogurt with berries, cottage cheese with fruit, hard-boiled eggs with toast
- **NOT**: elaborate cooked meals or complex recipes`);
  }

  sections.push(`
Workout time preference: ${profile.workout_time || 'varies'}
- Morning: Pre-workout after breakfast slot, post-workout before lunch
- Midday: Pre-workout late morning, post-workout early afternoon
- Evening: Pre-workout afternoon snack slot, post-workout after dinner
- Varies: Place flexibly, athlete will adjust`);

  return sections.join('\n\n');
}

/**
 * Get the display order for workout meals based on workout time
 * Default: Workout meals appear at the bottom (after all regular meals)
 */
export function getWorkoutMealDisplayOrder(
  mealType: MealType,
  workoutTime: string
): number {
  // Default order: Regular meals first, then workout meals at the bottom
  // Breakfast (1), Lunch (2), Dinner (3), Snacks (4), Pre-workout (5), Post-workout (6)
  const baseOrder: Record<MealType, number> = {
    breakfast: 1,
    lunch: 2,
    dinner: 3,
    snack: 4,
    pre_workout: 5, // At bottom
    post_workout: 6, // At bottom
  };

  // Workout meals always at the bottom, pre before post
  if (mealType === 'pre_workout') {
    return 5;
  }

  if (mealType === 'post_workout') {
    return 6;
  }

  return baseOrder[mealType] ?? 4;
}

/**
 * Organize meals for display including workout meals
 */
export function organizeMealsWithWorkout(
  meals: MealWithIngredientNutrition[],
  workoutTime: string
): MealWithIngredientNutrition[] {
  return [...meals].sort((a, b) => {
    const orderA = getWorkoutMealDisplayOrder(a.type, workoutTime);
    const orderB = getWorkoutMealDisplayOrder(b.type, workoutTime);
    return orderA - orderB;
  });
}
