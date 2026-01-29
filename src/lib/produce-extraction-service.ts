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

interface ProduceWeight {
  name_normalized: string;
  category: string;
  unit: string;
  grams: number;
}

// Categories that might contain fruits/vegetables
// We send these to Claude for classification since:
// - 'fruit'/'fruits' and 'vegetable'/'vegetables' are direct matches
// - 'produce' obviously contains fruits/veggies
// - 'grains' might contain sweet potatoes, corn, etc.
// - 'frozen' might contain frozen vegetables
// - 'protein' might contain beans/legumes which count as veggies for 800g
// - 'other' might contain miscategorized items
// Only 'dairy', 'pantry' (oils, spices), and 'fats' are excluded
const POTENTIALLY_PRODUCE_CATEGORIES = [
  'fruit', 'fruits',
  'vegetable', 'vegetables',
  'produce',
  'grains',
  'frozen',
  'protein',
  'other'
];

// ============================================
// Unit Normalization
// ============================================

/**
 * Normalize a unit string from meal ingredients to match produce_weights table format.
 * E.g., "cups" -> "cup_raw", "medium" -> "medium", "oz" -> "oz"
 */
function normalizeUnit(unit: string): string[] {
  const u = unit.toLowerCase().trim();

  // Map common unit variants to produce_weights table keys.
  // Returns multiple candidates to try (first match wins).
  const mappings: Record<string, string[]> = {
    // Cup variants — try specific first, then generic
    'cup': ['cup', 'cup_raw', 'cup_chopped', 'cup_cooked'],
    'cups': ['cup', 'cup_raw', 'cup_chopped', 'cup_cooked'],
    'cup chopped': ['cup_chopped'],
    'cup diced': ['cup_diced'],
    'cup sliced': ['cup_sliced'],
    'cup shredded': ['cup_shredded'],
    'cup cooked': ['cup_cooked'],
    'cup raw': ['cup_raw'],
    'cup cubed': ['cup_cubed'],
    'cup chunks': ['cup_chunks'],
    // Whole/size
    'whole': ['medium', 'whole'],
    'medium': ['medium'],
    'large': ['large'],
    'small': ['small'],
    // Weight
    'oz': ['oz'],
    'ounce': ['oz'],
    'ounces': ['oz'],
    // Specific
    'clove': ['clove'],
    'cloves': ['clove'],
    'stalk': ['stalk'],
    'stalks': ['stalk'],
    'spear': ['spear'],
    'spears': ['spear'],
    'ear': ['ear'],
    'ears': ['ear'],
    'head': ['head'],
    'bunch': ['bunch'],
    'sprout': ['sprout'],
    'leaf': ['leaf'],
    'leaves': ['leaf'],
    'half': ['half'],
    'pepper': ['pepper'],
    'slice': ['slice'],
    'slices': ['slice'],
    'wedge': ['wedge'],
  };

  return mappings[u] || [u];
}

// ============================================
// Deterministic Lookup
// ============================================

/**
 * Look up produce weights from the produce_weights table for known items.
 * Returns a map of ingredient index -> { category, grams } for items that matched.
 */
async function lookupProduceWeights(
  items: MealIngredient[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<number, { category: 'fruit' | 'vegetable'; grams: number }>> {
  const results = new Map<number, { category: 'fruit' | 'vegetable'; grams: number }>();

  if (items.length === 0) return results;

  const normalizedNames = [...new Set(items.map(item => item.name.toLowerCase().trim()))];

  const { data: weights } = await supabase
    .from('produce_weights')
    .select('name_normalized, category, unit, grams')
    .in('name_normalized', normalizedNames);

  if (!weights || weights.length === 0) return results;

  // Build a lookup: name_normalized -> { unit -> { category, grams } }
  const weightMap = new Map<string, Map<string, ProduceWeight>>();
  for (const w of weights) {
    if (!weightMap.has(w.name_normalized)) {
      weightMap.set(w.name_normalized, new Map());
    }
    weightMap.get(w.name_normalized)!.set(w.unit, w as ProduceWeight);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nameNorm = item.name.toLowerCase().trim();
    const unitEntries = weightMap.get(nameNorm);
    if (!unitEntries) continue;

    // Try each normalized unit candidate until we find a match
    const unitCandidates = normalizeUnit(item.unit);
    let match: ProduceWeight | undefined;
    for (const candidate of unitCandidates) {
      match = unitEntries.get(candidate);
      if (match) break;
    }

    if (!match) {
      // Fallback: if the item exists in the table at all, use the first available unit
      // as a rough estimate (better than nothing for classification at least)
      continue;
    }

    // Parse amount and multiply by grams-per-unit
    const amount = parseFloat(item.amount) || 1;
    const totalGrams = Math.round(amount * Number(match.grams));

    // Map legume -> vegetable for the 800g challenge (legumes count as veggies)
    const category = match.category === 'legume' ? 'vegetable' : match.category;
    if (category !== 'fruit' && category !== 'vegetable') continue;

    results.set(i, { category: category as 'fruit' | 'vegetable', grams: totalGrams });
  }

  return results;
}

// ============================================
// Main Extraction Function
// ============================================

/**
 * Extract produce ingredients from a meal and classify them as fruit/vegetable with gram estimates.
 *
 * Flow:
 * 1. Fetch meal by ID and get ingredients JSONB
 * 2. Filter for ingredients that might be fruits/vegetables
 * 3. Deterministic lookup in produce_weights table for known items
 * 4. Send only unmatched items to Claude for classification and gram estimation
 * 5. Merge deterministic + AI results, return only fruit/vegetable items
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

  console.log('[Produce Extraction] Meal ingredients:', {
    mealId,
    mealName: meal.name,
    ingredientCount: ingredients.length,
    ingredients: ingredients.map(i => ({ name: i.name, category: i.category }))
  });

  if (ingredients.length === 0) {
    return [];
  }

  // 2. Filter for items that might be produce
  const potentialProduceItems = ingredients.filter((ing) => {
    const category = ing.category?.toLowerCase() || 'other';
    return POTENTIALLY_PRODUCE_CATEGORIES.includes(category);
  });

  console.log('[Produce Extraction] Potential produce items:', {
    count: potentialProduceItems.length,
    items: potentialProduceItems.map(i => ({ name: i.name, category: i.category }))
  });

  if (potentialProduceItems.length === 0) {
    return [];
  }

  // 3. Deterministic lookup in produce_weights table
  const deterministicResults = await lookupProduceWeights(potentialProduceItems, supabase);

  console.log('[Produce Extraction] Deterministic lookup results:', {
    matched: deterministicResults.size,
    total: potentialProduceItems.length,
    items: Array.from(deterministicResults.entries()).map(([idx, r]) => ({
      name: potentialProduceItems[idx].name,
      category: r.category,
      grams: r.grams,
    })),
  });

  // 4. Collect items that need AI classification (not matched by deterministic lookup)
  const unmatchedItems: { index: number; item: MealIngredient }[] = [];
  for (let i = 0; i < potentialProduceItems.length; i++) {
    if (!deterministicResults.has(i)) {
      unmatchedItems.push({ index: i, item: potentialProduceItems[i] });
    }
  }

  // 5. Look up known categories from the ingredients dimension table
  const normalizedNames = potentialProduceItems.map((item) =>
    item.name.toLowerCase().trim()
  );

  const { data: knownIngredients } = await supabase
    .from('ingredients')
    .select('name_normalized, category')
    .in('name_normalized', normalizedNames);

  const knownCategoryMap = new Map<string, IngredientCategoryType>();
  if (knownIngredients) {
    for (const ing of knownIngredients) {
      if (ing.category === 'fruit' || ing.category === 'vegetable') {
        knownCategoryMap.set(ing.name_normalized, ing.category);
      }
    }
  }

  // 6. Send only unmatched items to Claude for classification and gram estimation
  let aiResults: Awaited<ReturnType<typeof estimateProduceGrams>> = [];
  if (unmatchedItems.length > 0) {
    const itemsForAI: ProduceItem[] = unmatchedItems.map(({ item }) => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
    }));

    aiResults = await estimateProduceGrams(itemsForAI, userId);

    console.log('[Produce Extraction] AI classification results:', {
      count: aiResults.length,
      results: aiResults.map(r => ({ name: r.name, category: r.category, grams: r.estimatedGrams }))
    });
  } else {
    console.log('[Produce Extraction] All items resolved via deterministic lookup, skipping AI call');
  }

  // 7. Build final results — merge deterministic + AI
  const results: ExtractedProduce[] = [];

  for (let i = 0; i < potentialProduceItems.length; i++) {
    const originalItem = potentialProduceItems[i];
    const originalNameLower = originalItem.name.toLowerCase().trim();

    // Check deterministic result first
    const deterministicResult = deterministicResults.get(i);
    if (deterministicResult) {
      results.push({
        name: originalItem.name,
        amount: originalItem.amount,
        unit: originalItem.unit,
        category: deterministicResult.category,
        estimatedGrams: deterministicResult.grams,
      });
      continue;
    }

    // Fall back to AI result for unmatched items
    // Find the AI result index — unmatchedItems preserves order sent to AI
    const unmatchedIdx = unmatchedItems.findIndex(u => u.index === i);
    if (unmatchedIdx === -1) continue;

    // Try to find matching AI result with increasingly fuzzy matching
    let aiResult = aiResults.find(
      (r) => r.name.toLowerCase().trim() === originalNameLower
    );

    if (!aiResult) {
      aiResult = aiResults.find(
        (r) => originalNameLower.includes(r.name.toLowerCase().trim())
      );
    }

    if (!aiResult) {
      aiResult = aiResults.find(
        (r) => r.name.toLowerCase().trim().includes(originalNameLower)
      );
    }

    if (!aiResult && aiResults[unmatchedIdx]) {
      aiResult = aiResults[unmatchedIdx];
    }

    if (!aiResult) continue;

    // Determine category: prefer DB lookup, fallback to AI classification
    const knownCategory = knownCategoryMap.get(originalNameLower);
    const category = knownCategory || aiResult.category;

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
