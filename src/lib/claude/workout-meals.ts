import type { UserProfile, MealType, MealWithIngredientNutrition, DayOfWeek } from '../types';

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

**Timing Context:** Eaten 30-60 minutes before training

**Nutritional Goals:**
- Quick-digesting carbs for immediate energy
- Moderate protein to prevent muscle breakdown
- LOW fat and fiber (slows digestion, can cause discomfort)

**Ideal Macro Ratio:**
- Carbs: 60-70% of calories
- Protein: 20-30% of calories
- Fat: <10% of calories

**Good Pre-Workout Foods:**
- Banana (quick carbs, potassium)
- Toast with honey
- Rice cakes
- Oatmeal (if >60 min before)
- Greek yogurt (small portion)
- Apple slices

**Avoid Pre-Workout:**
- High fat foods (nuts, avocado, cheese)
- High fiber vegetables (broccoli, beans)
- Large protein portions
- Anything that sits heavy
`;

  const postWorkoutGuidance = `
## POST-WORKOUT MEAL REQUIREMENTS

**Timing Context:** Eaten within 30-60 minutes after training

**Nutritional Goals:**
- Protein for muscle recovery and synthesis
- Carbs to replenish glycogen stores
- Moderate fat is acceptable

**Ideal Macro Ratio:**
- Protein: 30-40% of calories
- Carbs: 40-50% of calories
- Fat: 15-25% of calories

**Good Post-Workout Foods:**
- Greek yogurt with fruit
- Protein shake with banana
- Eggs with toast
- Chocolate milk
- Cottage cheese with fruit
- Turkey/chicken wrap

**Recovery Focus:**
- Prioritize complete proteins (eggs, dairy, meat)
- Include fast-absorbing carbs
- Hydration is also key
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
 * when user has workout meals enabled
 */
export function getWorkoutMealInstructions(profile: UserProfile): string {
  if (!profile.include_workout_meals) {
    return '';
  }

  const preWorkoutCal = getPreWorkoutCalorieTarget(profile);
  const postWorkoutCal = getPostWorkoutCalorieTarget(profile);

  return `
## WORKOUT MEALS

In addition to the standard meals, generate these workout-specific items for each day:

### Pre-Workout (${preWorkoutCal} cal target)
- Timing: 30-60 min before training
- Focus: Quick carbs, moderate protein, minimal fat
- Keep it light and easily digestible
- Examples: banana, toast with honey, rice cakes, small yogurt

### Post-Workout (${postWorkoutCal} cal target)
- Timing: Within 60 min after training
- Focus: Protein for recovery, carbs for glycogen
- More substantial than pre-workout
- Examples: Greek yogurt with fruit, eggs with toast, protein shake

Workout time preference: ${profile.workout_time}
- Morning: Pre-workout after breakfast slot, post-workout before lunch
- Midday: Pre-workout late morning, post-workout early afternoon
- Evening: Pre-workout afternoon snack slot, post-workout after dinner
- Varies: Place flexibly, athlete will adjust
`;
}

/**
 * Get the display order for workout meals based on workout time
 */
export function getWorkoutMealDisplayOrder(
  mealType: MealType,
  workoutTime: string
): number {
  const baseOrder: Record<MealType, number> = {
    breakfast: 1,
    pre_workout: 2, // Default position
    lunch: 3,
    post_workout: 4, // Default position
    snack: 5,
    dinner: 6,
  };

  // Adjust based on workout time
  if (mealType === 'pre_workout') {
    switch (workoutTime) {
      case 'morning':
        return 2; // After breakfast
      case 'midday':
        return 3; // Late morning (before lunch)
      case 'evening':
        return 5; // Afternoon (before dinner)
      default:
        return 2;
    }
  }

  if (mealType === 'post_workout') {
    switch (workoutTime) {
      case 'morning':
        return 3; // Before lunch
      case 'midday':
        return 4; // Early afternoon
      case 'evening':
        return 7; // After dinner
      default:
        return 4;
    }
  }

  return baseOrder[mealType] ?? 5;
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
