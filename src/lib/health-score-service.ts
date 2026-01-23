/**
 * Health Score Service
 *
 * Calculates health scores (0-100) for foods based on their nutritional profile
 * and processing level. Used to help users make healthier food choices.
 *
 * Score ranges:
 * - 80-100: Whole foods (green indicator)
 * - 60-79: Minimally processed (yellow-green indicator)
 * - 40-59: Healthy processed (yellow indicator)
 * - 0-39: Heavily processed (red indicator)
 */

import type { USDASearchResult, USDAFoodDetails, USDANutritionPer100g } from './usda-service';
import { extractNutritionFromSearchResult, extractNutritionPer100g } from './usda-service';

export type HealthCategory = 'whole' | 'minimally_processed' | 'healthy_processed' | 'heavily_processed';

export interface HealthScoreResult {
  score: number;
  category: HealthCategory;
  factors: {
    is_whole_food: boolean;
    has_short_ingredient_list: boolean;
    no_additives: boolean;
    good_macro_profile: boolean;
  };
}

// Common additives and preservatives that lower health scores
const ADDITIVES = [
  'high fructose corn syrup',
  'high fructose',
  'artificial',
  'preservative',
  'bha',
  'bht',
  'tbhq',
  'sodium nitrate',
  'sodium nitrite',
  'monosodium glutamate',
  'msg',
  'aspartame',
  'sucralose',
  'acesulfame',
  'red 40',
  'yellow 5',
  'yellow 6',
  'blue 1',
  'caramel color',
  'carrageenan',
  'polysorbate',
  'sodium benzoate',
  'potassium sorbate',
];

/**
 * Get health category from numeric score
 */
export function getHealthCategory(score: number): HealthCategory {
  if (score >= 80) return 'whole';
  if (score >= 60) return 'minimally_processed';
  if (score >= 40) return 'healthy_processed';
  return 'heavily_processed';
}

/**
 * Get display label for health category
 */
export function getHealthCategoryLabel(category: HealthCategory): string {
  switch (category) {
    case 'whole':
      return 'Whole Food';
    case 'minimally_processed':
      return 'Minimally Processed';
    case 'healthy_processed':
      return 'Lightly Processed';
    case 'heavily_processed':
      return 'Processed';
  }
}

/**
 * Get color class for health score display
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-lime-600';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

/**
 * Get background color class for health score badge
 */
export function getHealthScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-lime-100';
  if (score >= 40) return 'bg-amber-100';
  return 'bg-red-100';
}

/**
 * Check if ingredients list contains additives
 */
function hasAdditives(ingredients: string): boolean {
  const lowerIngredients = ingredients.toLowerCase();
  return ADDITIVES.some(additive => lowerIngredients.includes(additive));
}

/**
 * Count ingredients in an ingredients list string
 */
function countIngredients(ingredients: string): number {
  // USDA ingredients lists are typically comma-separated
  // Handle parentheses for sub-ingredients
  const cleaned = ingredients
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content
    .replace(/\[[^\]]*\]/g, ''); // Remove bracketed content

  const parts = cleaned.split(',').filter(part => part.trim().length > 0);
  return parts.length;
}

/**
 * Calculate macro-based score adjustment
 * Rewards: high protein, high fiber, low sugar
 * Penalizes: very high sugar, very low protein
 */
function calculateMacroAdjustment(nutrition: USDANutritionPer100g): number {
  let adjustment = 0;

  // High protein bonus (>15g per 100g is good)
  if (nutrition.protein >= 20) {
    adjustment += 5;
  } else if (nutrition.protein >= 15) {
    adjustment += 3;
  }

  // High fiber bonus (>5g per 100g is good)
  if (nutrition.fiber !== null) {
    if (nutrition.fiber >= 8) {
      adjustment += 5;
    } else if (nutrition.fiber >= 5) {
      adjustment += 3;
    }
  }

  // High sugar penalty (>15g per 100g is concerning)
  if (nutrition.sugar !== null) {
    if (nutrition.sugar >= 30) {
      adjustment -= 15;
    } else if (nutrition.sugar >= 20) {
      adjustment -= 10;
    } else if (nutrition.sugar >= 15) {
      adjustment -= 5;
    }
  }

  return adjustment;
}

/**
 * Calculate health score for a USDA food
 *
 * @param food - USDA food data (search result or full details)
 * @returns Health score result with score, category, and contributing factors
 */
export function calculateHealthScore(
  food: USDASearchResult | USDAFoodDetails
): HealthScoreResult {
  let score = 50; // Base score
  const factors = {
    is_whole_food: false,
    has_short_ingredient_list: false,
    no_additives: true,
    good_macro_profile: false,
  };

  // 1. Data type scoring
  // Foundation and SR Legacy are USDA's highest quality whole food data
  const dataType = food.dataType;

  if (dataType === 'Foundation' || dataType === 'SR Legacy') {
    // Whole foods from USDA reference databases
    score = 85;
    factors.is_whole_food = true;
    factors.has_short_ingredient_list = true;
  } else if (dataType === 'Survey (FNDDS)') {
    // Food survey data - mixed quality
    score = 60;
  } else if (dataType === 'Branded') {
    // Branded products - score based on ingredients
    score = 50;
  }

  // 2. Ingredients list analysis (primarily for Branded foods)
  const ingredients = food.ingredients;

  if (ingredients) {
    const ingredientCount = countIngredients(ingredients);

    // Short ingredient list is better
    if (ingredientCount <= 3) {
      score = Math.max(score, 75);
      factors.has_short_ingredient_list = true;
    } else if (ingredientCount <= 5) {
      score = Math.max(score, 65);
      factors.has_short_ingredient_list = true;
    } else if (ingredientCount <= 10) {
      score = Math.min(score, 55);
    } else if (ingredientCount <= 15) {
      score = Math.min(score, 45);
    } else {
      score = Math.min(score, 35);
    }

    // Check for additives
    if (hasAdditives(ingredients)) {
      score -= 15;
      factors.no_additives = false;
    }
  } else if (dataType === 'Branded') {
    // Branded food without ingredients list - be cautious
    score = Math.min(score, 50);
  }

  // 3. Macro profile adjustment
  const nutrition = 'foodNutrients' in food && Array.isArray(food.foodNutrients)
    ? ('nutrient' in (food.foodNutrients[0] || {})
        ? extractNutritionPer100g(food as USDAFoodDetails)
        : extractNutritionFromSearchResult(food as USDASearchResult))
    : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null };

  const macroAdjustment = calculateMacroAdjustment(nutrition);
  score += macroAdjustment;

  if (macroAdjustment > 0) {
    factors.good_macro_profile = true;
  }

  // Clamp score to valid range
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    category: getHealthCategory(score),
    factors,
  };
}

/**
 * Calculate health score from just the basic food info
 * Used when we only have search result data
 */
export function calculateHealthScoreFromSearchResult(result: USDASearchResult): HealthScoreResult {
  return calculateHealthScore(result);
}

/**
 * Calculate health score from full food details
 * More accurate as we have complete nutrition data
 */
export function calculateHealthScoreFromDetails(details: USDAFoodDetails): HealthScoreResult {
  return calculateHealthScore(details);
}
