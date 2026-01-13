import type { UserProfile, DayOfWeek, MealWithIngredientNutrition, Macros } from '../types';

interface DailyTotals {
  day: DayOfWeek;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  deficit: {
    calories: number;
    protein: number;
  };
}

interface DayPlanWithMeals {
  day: DayOfWeek;
  meals: MealWithIngredientNutrition[];
  daily_totals?: Macros;
}

/**
 * Analyzes a meal plan and identifies calorie/protein deficits for each day
 */
export function analyzeMealPlanDeficits(
  days: DayPlanWithMeals[],
  profile: UserProfile
): DailyTotals[] {
  return days.map(day => {
    const totals = day.meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      day: day.day,
      ...totals,
      deficit: {
        calories: Math.max(0, profile.target_calories - totals.calories),
        protein: Math.max(0, profile.target_protein - totals.protein),
      },
    };
  });
}

/**
 * Determines if workout meals should be generated to fill gaps
 */
export function shouldGenerateWorkoutMeals(
  deficits: DailyTotals[],
  profile: UserProfile
): boolean {
  // Only generate if user has enabled workout meals
  if (!profile.include_workout_meals) {
    return false;
  }

  // Check if any day has significant deficit (>10% of target)
  const significantDeficitThreshold = profile.target_calories * 0.10;

  return deficits.some(day => day.deficit.calories > significantDeficitThreshold);
}

/**
 * Calculates optimal calorie distribution for workout meals
 */
export function calculateWorkoutMealTargets(
  dailyDeficit: number,
  profile: UserProfile
): { preWorkout: number; postWorkout: number } {
  // Pre-workout is lighter, post-workout is more substantial
  const preWorkoutRatio =
    profile.pre_workout_preference === 'light'
      ? 0.3
      : profile.pre_workout_preference === 'moderate'
      ? 0.4
      : 0.45;

  const preWorkout = Math.round(dailyDeficit * preWorkoutRatio);
  const postWorkout = dailyDeficit - preWorkout;

  // Apply min/max bounds
  return {
    preWorkout: Math.min(Math.max(preWorkout, 100), 400), // 100-400 cal
    postWorkout: Math.min(Math.max(postWorkout, 150), 500), // 150-500 cal
  };
}

/**
 * Get days that need gap-filling workout meals
 */
export function getDaysNeedingGapFill(
  deficits: DailyTotals[],
  minDeficitThreshold: number = 150
): DailyTotals[] {
  return deficits.filter(day => day.deficit.calories >= minDeficitThreshold);
}

/**
 * Calculate total calories that workout meals would add
 */
export function calculateWorkoutMealCalories(profile: UserProfile): number {
  // Pre-workout calorie targets based on preference
  const preWorkoutCals =
    profile.pre_workout_preference === 'light'
      ? 125
      : profile.pre_workout_preference === 'moderate'
      ? 250
      : 450;

  // Post-workout is 8-12% of daily calories
  const postWorkoutCals = Math.round(profile.target_calories * 0.1);

  return preWorkoutCals + postWorkoutCals;
}

/**
 * Check if workout meals are likely to help hit targets
 */
export function willWorkoutMealsHelpHitTargets(
  deficits: DailyTotals[],
  profile: UserProfile
): {
  wouldHelp: boolean;
  averageDeficit: number;
  workoutMealCalories: number;
  coveragePercent: number;
} {
  const daysWithDeficit = deficits.filter(d => d.deficit.calories > 0);

  if (daysWithDeficit.length === 0) {
    return {
      wouldHelp: false,
      averageDeficit: 0,
      workoutMealCalories: 0,
      coveragePercent: 100,
    };
  }

  const averageDeficit =
    daysWithDeficit.reduce((sum, d) => sum + d.deficit.calories, 0) /
    daysWithDeficit.length;

  const workoutMealCalories = calculateWorkoutMealCalories(profile);
  const coveragePercent = Math.min(100, (workoutMealCalories / averageDeficit) * 100);

  return {
    wouldHelp: coveragePercent >= 50, // Helpful if covers at least 50% of deficit
    averageDeficit,
    workoutMealCalories,
    coveragePercent,
  };
}

/**
 * Summary of meal plan calorie accuracy
 */
export interface MealPlanAccuracySummary {
  totalDays: number;
  daysOnTarget: number; // Within ±150 cal
  daysUnder: number; // More than 150 cal under
  daysOver: number; // More than 150 cal over
  averageDeviation: number;
  proteinOnTarget: number; // Days within ±20g of protein target
  recommendation: 'good' | 'consider_workout_meals' | 'adjust_portions';
}

/**
 * Analyze meal plan accuracy and provide recommendations
 */
export function analyzeMealPlanAccuracy(
  deficits: DailyTotals[],
  profile: UserProfile
): MealPlanAccuracySummary {
  const calorieTolerance = 150;
  const proteinTolerance = 20;

  let daysOnTarget = 0;
  let daysUnder = 0;
  let daysOver = 0;
  let proteinOnTarget = 0;
  let totalDeviation = 0;

  for (const day of deficits) {
    const calorieDeviation = profile.target_calories - day.calories;
    const proteinDeviation = Math.abs(profile.target_protein - day.protein);

    totalDeviation += Math.abs(calorieDeviation);

    if (Math.abs(calorieDeviation) <= calorieTolerance) {
      daysOnTarget++;
    } else if (calorieDeviation > calorieTolerance) {
      daysUnder++;
    } else {
      daysOver++;
    }

    if (proteinDeviation <= proteinTolerance) {
      proteinOnTarget++;
    }
  }

  const averageDeviation = totalDeviation / deficits.length;

  // Determine recommendation
  let recommendation: 'good' | 'consider_workout_meals' | 'adjust_portions';

  if (daysOnTarget >= 5) {
    recommendation = 'good';
  } else if (daysUnder >= 3 && !profile.include_workout_meals) {
    recommendation = 'consider_workout_meals';
  } else {
    recommendation = 'adjust_portions';
  }

  return {
    totalDays: deficits.length,
    daysOnTarget,
    daysUnder,
    daysOver,
    averageDeviation,
    proteinOnTarget,
    recommendation,
  };
}
