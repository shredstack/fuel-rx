import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { IngredientNutritionWithDetails } from '../types';

// ============================================
// Supabase Service Role Client
// ============================================

/**
 * Create a service role Supabase client that doesn't require cookies.
 * This is necessary because this module may be called from Inngest
 * which doesn't have access to Next.js cookies context.
 */
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// Ingredient Nutrition Cache Functions
// ============================================

/**
 * Fetch cached nutrition data for ingredients
 * Returns a map of normalized ingredient names to nutrition data
 * Uses the ingredient_nutrition_with_details view for convenience
 */
export async function fetchCachedNutrition(ingredientNames: string[]): Promise<Map<string, IngredientNutritionWithDetails>> {
  const supabase = createServiceRoleClient();
  const normalizedNames = ingredientNames.map(name => name.toLowerCase().trim());

  const { data, error } = await supabase
    .from('ingredient_nutrition_with_details')
    .select('*')
    .in('name_normalized', normalizedNames);

  if (error) {
    console.error('Error fetching cached nutrition:', error);
    return new Map();
  }

  const nutritionMap = new Map<string, IngredientNutritionWithDetails>();
  for (const item of data || []) {
    nutritionMap.set(item.name_normalized, item as IngredientNutritionWithDetails);
  }

  return nutritionMap;
}

/**
 * Get or create an ingredient in the ingredients dimension table
 * Returns the ingredient ID
 *
 * IMPORTANT: This function respects soft deletes. If an ingredient was
 * deleted by an admin (deleted_at is set), it will NOT be recreated.
 * This prevents admin-deleted duplicates from reappearing.
 */
async function getOrCreateIngredient(
  supabase: ReturnType<typeof createServiceRoleClient>,
  name: string,
  category: string = 'other'
): Promise<string | null> {
  const normalizedName = name.toLowerCase().trim();

  // Try to find existing NON-DELETED ingredient
  const { data: existing } = await supabase
    .from('ingredients')
    .select('id')
    .eq('name_normalized', normalizedName)
    .is('deleted_at', null)
    .single();

  if (existing) {
    return existing.id;
  }

  // Check if there's a soft-deleted version - don't recreate if so
  const { data: deleted } = await supabase
    .from('ingredients')
    .select('id')
    .eq('name_normalized', normalizedName)
    .not('deleted_at', 'is', null)
    .single();

  if (deleted) {
    // This ingredient was deleted by an admin - don't recreate it
    return null;
  }

  // Create new ingredient (only if it's truly new)
  const { data: created, error } = await supabase
    .from('ingredients')
    .insert({
      name,
      name_normalized: normalizedName,
      category,
    })
    .select('id')
    .single();

  if (error) {
    // Handle race condition - another request might have created it
    if (error.code === '23505') { // unique_violation
      const { data: retry } = await supabase
        .from('ingredients')
        .select('id')
        .eq('name_normalized', normalizedName)
        .is('deleted_at', null)
        .single();
      return retry?.id || null;
    }
    console.error('Error creating ingredient:', error);
    return null;
  }

  return created?.id || null;
}

/**
 * Cache new nutrition data for ingredients
 * First ensures the ingredient exists in the ingredients table,
 * then adds the nutrition data for the specific serving size
 */
export async function cacheIngredientNutrition(
  ingredients: Array<{
    name: string;
    serving_size: number;
    serving_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    category?: string;
  }>
): Promise<void> {
  const supabase = createServiceRoleClient();

  for (const ing of ingredients) {
    // Get or create the ingredient
    const ingredientId = await getOrCreateIngredient(supabase, ing.name, ing.category || 'other');

    if (!ingredientId) {
      console.error(`Failed to get/create ingredient: ${ing.name}`);
      continue;
    }

    // Insert nutrition data for this serving size
    const { error } = await supabase
      .from('ingredient_nutrition')
      .upsert({
        ingredient_id: ingredientId,
        serving_size: Math.round(ing.serving_size),
        serving_unit: ing.serving_unit,
        calories: Math.round(ing.calories),
        protein: Math.round(ing.protein),
        carbs: Math.round(ing.carbs),
        fat: Math.round(ing.fat),
        source: 'llm_estimated' as const,
        confidence_score: 0.7,
      }, {
        onConflict: 'ingredient_id,serving_size,serving_unit',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`Error caching nutrition for ${ing.name}:`, error);
    }
  }
}

/**
 * Build a nutrition reference string from cached data for LLM prompts
 */
export function buildNutritionReferenceSection(nutritionCache: Map<string, IngredientNutritionWithDetails>): string {
  if (nutritionCache.size === 0) return '';

  const lines = Array.from(nutritionCache.values()).map(n =>
    `- ${n.ingredient_name}: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat per ${n.serving_size} ${n.serving_unit}`
  );

  return `
## NUTRITION REFERENCE (use these exact values)
The following ingredients have validated nutrition data. Use these exact values when calculating macros:
${lines.join('\n')}
`;
}
