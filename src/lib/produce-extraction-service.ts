import { createClient } from './supabase/server';
import { estimateProduceGrams, type ProduceItem } from './claude/produce-estimation';
import type { IngredientCategoryType } from './types';

// ============================================
// Types
// ============================================

export interface ExtractedProduce {
  name: string;
  amount: string;
  unit: string;
  category: 'fruit' | 'vegetable';
  estimatedGrams: number;
}

interface MealIngredient {
  name: string;
  amount: string;
  unit: string;
  category?: string;
}

// Categories that might contain fruits/vegetables
// We send these to Claude for classification since:
// - 'produce' obviously contains fruits/veggies
// - 'grains' might contain sweet potatoes, corn, etc.
// - 'frozen' might contain frozen vegetables
// - 'protein' might contain beans/legumes which count as veggies for 800g
// - 'other' might contain miscategorized items
// Only 'dairy' and 'pantry' (oils, spices) are excluded
const POTENTIALLY_PRODUCE_CATEGORIES = ['produce', 'grains', 'frozen', 'protein', 'other'];

// ============================================
// Main Extraction Function
// ============================================

/**
 * Extract produce ingredients from a meal and classify them as fruit/vegetable with gram estimates.
 *
 * Flow:
 * 1. Fetch meal by ID and get ingredients JSONB
 * 2. Filter for ingredients that might be fruits/vegetables
 * 3. Send ALL potential items to Claude for classification
 * 4. Claude decides what's actually a fruit/vegetable and estimates grams
 * 5. Return only items classified as fruit or vegetable
 */
export async function extractProduceFromMeal(
  mealId: string,
  userId: string
): Promise<ExtractedProduce[]> {
  const supabase = await createClient();

  // 1. Fetch meal and get ingredients
  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .select('id, name, ingredients')
    .eq('id', mealId)
    .single();

  if (mealError || !meal) {
    throw new Error(`Meal not found: ${mealId}`);
  }

  const ingredients = (meal.ingredients || []) as MealIngredient[];

  if (ingredients.length === 0) {
    return [];
  }

  // 2. Filter for items that might be produce
  // Include 'produce', 'grains' (for sweet potatoes), 'frozen' (for frozen veggies), and 'other'
  // Exclude proteins, dairy, pantry (oils, spices) which are definitely not fruits/veggies
  const potentialProduceItems = ingredients.filter((ing) => {
    const category = ing.category?.toLowerCase() || 'other';
    return POTENTIALLY_PRODUCE_CATEGORIES.includes(category);
  });

  if (potentialProduceItems.length === 0) {
    return [];
  }

  // 3. Look up items in the ingredients dimension table for known categories
  const normalizedNames = potentialProduceItems.map((item) =>
    item.name.toLowerCase().trim()
  );

  const { data: knownIngredients } = await supabase
    .from('ingredients')
    .select('name_normalized, category')
    .in('name_normalized', normalizedNames);

  // Build a map of known categories from our ingredients table
  const knownCategoryMap = new Map<string, IngredientCategoryType>();
  if (knownIngredients) {
    for (const ing of knownIngredients) {
      if (ing.category === 'fruit' || ing.category === 'vegetable') {
        knownCategoryMap.set(ing.name_normalized, ing.category);
      }
    }
  }

  // 4. Send ALL potential items to Claude for classification and gram estimation
  const itemsForAI: ProduceItem[] = potentialProduceItems.map((item) => ({
    name: item.name,
    amount: item.amount,
    unit: item.unit,
  }));

  const aiResults = await estimateProduceGrams(itemsForAI, userId);

  // 5. Build results - prefer known categories from DB, otherwise use AI classification
  const results: ExtractedProduce[] = [];

  for (let i = 0; i < potentialProduceItems.length; i++) {
    const originalItem = potentialProduceItems[i];
    const aiResult = aiResults.find(
      (r) => r.name.toLowerCase() === originalItem.name.toLowerCase()
    ) || aiResults[i]; // Fallback to positional match

    if (!aiResult) continue;

    // Determine category: prefer DB lookup, fallback to AI classification
    const knownCategory = knownCategoryMap.get(originalItem.name.toLowerCase().trim());
    const category = knownCategory || aiResult.category;

    // Skip items classified as 'other' (not fruit/vegetable)
    if (category === 'other') continue;

    results.push({
      name: originalItem.name,
      amount: originalItem.amount,
      unit: originalItem.unit,
      category: category as 'fruit' | 'vegetable',
      estimatedGrams: aiResult.estimatedGrams,
    });
  }

  return results;
}

/**
 * Check if a meal has any ingredients that might be fruits/vegetables.
 * This is a quick check to avoid showing the modal for meals with only proteins/dairy.
 */
export async function mealHasProduce(mealId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: meal, error } = await supabase
    .from('meals')
    .select('ingredients')
    .eq('id', mealId)
    .single();

  if (error || !meal) {
    return false;
  }

  const ingredients = (meal.ingredients || []) as MealIngredient[];

  // Check if any ingredient might be produce
  return ingredients.some((ing) => {
    const category = ing.category?.toLowerCase() || 'other';
    return POTENTIALLY_PRODUCE_CATEGORIES.includes(category);
  });
}
