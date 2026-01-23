/**
 * USDA FoodData Central API Service
 *
 * Provides access to USDA's authoritative nutrition database.
 * https://fdc.nal.usda.gov/api-guide.html
 *
 * Rate limit: 1,000 requests per hour (we stay under 500/hour to be safe)
 */

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA nutrient IDs for the macros we care about
const NUTRIENT_IDS = {
  ENERGY: 1008,        // Energy (kcal)
  PROTEIN: 1003,       // Protein (g)
  CARBS: 1005,         // Carbohydrate, by difference (g)
  FAT: 1004,           // Total lipid (fat) (g)
  FIBER: 1079,         // Fiber, total dietary (g)
  SUGAR: 2000,         // Sugars, total including NLEA (g)
  SUGAR_ALT: 1063,     // Sugars, Total (NLEA) - alternative ID
};

// ============================================
// Types for USDA API Responses
// ============================================

export interface USDASearchResult {
  fdcId: number;
  description: string;
  dataType: string;  // 'Foundation', 'SR Legacy', 'Branded', 'Survey (FNDDS)'
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: Array<{
    nutrientId: number;
    nutrientName: string;
    nutrientNumber: string;
    unitName: string;
    value: number;
  }>;
}

export interface USDAFoodDetails {
  fdcId: number;
  description: string;
  dataType: string;
  publicationDate?: string;
  brandOwner?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: Array<{
    nutrient: {
      id: number;
      number: string;
      name: string;
      unitName: string;
    };
    amount: number;
  }>;
  foodPortions?: Array<{
    id: number;
    gramWeight: number;
    amount: number;
    measureUnit?: {
      name: string;
      abbreviation: string;
    };
    modifier?: string;
    portionDescription?: string;
  }>;
}

export interface USDANutritionPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
}

export interface USDASearchResponse {
  foods: USDASearchResult[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get the USDA API key from environment variables
 */
function getApiKey(): string | null {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.warn('USDA_API_KEY environment variable not set');
    return null;
  }
  return apiKey;
}

/**
 * Search USDA FoodData Central for foods matching a query
 *
 * @param query - The search term (e.g., "almonds", "chicken breast")
 * @param pageSize - Number of results to return (default 10, max 50)
 * @param dataType - Filter by data type (e.g., ['Foundation', 'SR Legacy'])
 * @returns Array of search results with basic nutrition info
 */
export async function searchUSDA(
  query: string,
  pageSize: number = 10,
  dataType?: string[]
): Promise<USDASearchResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Cannot search USDA: API key not configured');
    return [];
  }

  try {
    // Add wildcard suffix for prefix matching (e.g., "kirklan" -> "kirklan*")
    // This allows partial word matches like "kirklan" matching "kirkland"
    const wildcardQuery = query.endsWith('*') ? query : `${query}*`;

    const params = new URLSearchParams({
      api_key: apiKey,
      query: wildcardQuery,
      pageSize: Math.min(pageSize, 50).toString(),
    });

    // Prefer Foundation and SR Legacy data (most accurate for whole foods)
    // over Branded products (which can vary)
    if (dataType && dataType.length > 0) {
      params.append('dataType', dataType.join(','));
    }

    const response = await fetch(`${USDA_API_BASE}/foods/search?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('USDA API rate limit exceeded');
      } else {
        console.error('USDA API error:', response.status, await response.text());
      }
      return [];
    }

    const data: USDASearchResponse = await response.json();
    return data.foods || [];
  } catch (error) {
    console.error('Error searching USDA:', error);
    return [];
  }
}

/**
 * Get detailed nutrition data for a specific food by FDC ID
 *
 * @param fdcId - The USDA FoodData Central ID
 * @returns Full food details including all nutrients
 */
export async function getUSDAFoodDetails(fdcId: string | number): Promise<USDAFoodDetails | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Cannot fetch USDA food details: API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${USDA_API_BASE}/food/${fdcId}?api_key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`USDA food not found: ${fdcId}`);
      } else if (response.status === 429) {
        console.error('USDA API rate limit exceeded');
      } else {
        console.error('USDA API error:', response.status);
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching USDA food details:', error);
    return null;
  }
}

/**
 * Extract nutrition values (per 100g) from USDA food details
 *
 * USDA reports nutrition per 100g as the standard unit.
 * This function extracts the key macros we care about.
 *
 * @param food - Full USDA food details
 * @returns Nutrition values per 100g
 */
export function extractNutritionPer100g(food: USDAFoodDetails): USDANutritionPer100g {
  const nutrients = food.foodNutrients || [];

  // Helper to find nutrient by ID(s)
  const findNutrient = (...ids: number[]): number | null => {
    for (const id of ids) {
      const nutrient = nutrients.find(n => n.nutrient?.id === id);
      if (nutrient && typeof nutrient.amount === 'number') {
        return nutrient.amount;
      }
    }
    return null;
  };

  return {
    calories: findNutrient(NUTRIENT_IDS.ENERGY) ?? 0,
    protein: findNutrient(NUTRIENT_IDS.PROTEIN) ?? 0,
    carbs: findNutrient(NUTRIENT_IDS.CARBS) ?? 0,
    fat: findNutrient(NUTRIENT_IDS.FAT) ?? 0,
    fiber: findNutrient(NUTRIENT_IDS.FIBER),
    sugar: findNutrient(NUTRIENT_IDS.SUGAR, NUTRIENT_IDS.SUGAR_ALT),
  };
}

/**
 * Extract nutrition values from search result (less detailed than full details)
 *
 * Search results include basic nutrition but may be less complete.
 * Use getUSDAFoodDetails for full nutrition data.
 */
export function extractNutritionFromSearchResult(result: USDASearchResult): USDANutritionPer100g {
  const nutrients = result.foodNutrients || [];

  const findNutrient = (...ids: number[]): number | null => {
    for (const id of ids) {
      const nutrient = nutrients.find(n => n.nutrientId === id);
      if (nutrient && typeof nutrient.value === 'number') {
        return nutrient.value;
      }
    }
    return null;
  };

  return {
    calories: findNutrient(NUTRIENT_IDS.ENERGY) ?? 0,
    protein: findNutrient(NUTRIENT_IDS.PROTEIN) ?? 0,
    carbs: findNutrient(NUTRIENT_IDS.CARBS) ?? 0,
    fat: findNutrient(NUTRIENT_IDS.FAT) ?? 0,
    fiber: findNutrient(NUTRIENT_IDS.FIBER),
    sugar: findNutrient(NUTRIENT_IDS.SUGAR, NUTRIENT_IDS.SUGAR_ALT),
  };
}

// ============================================
// Unit Conversion Utilities
// ============================================

/**
 * Convert weight in grams to another unit
 * Returns null if conversion not possible
 */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

/**
 * Convert nutrition per 100g to nutrition for a specific serving
 *
 * @param nutritionPer100g - Nutrition values per 100g from USDA
 * @param servingSize - Size of the serving
 * @param servingUnit - Unit of the serving (e.g., 'oz', 'g', 'cup')
 * @returns Nutrition values for the specified serving, or null if unit not convertible
 */
export function convertTo100gToServing(
  nutritionPer100g: USDANutritionPer100g,
  servingSize: number,
  servingUnit: string
): USDANutritionPer100g | null {
  const unit = servingUnit.toLowerCase();
  const gramsPerUnit = GRAMS_PER_UNIT[unit];

  if (!gramsPerUnit) {
    // Can't convert units like 'cup', 'tbsp', 'whole' without food-specific data
    console.warn(`Cannot convert unit '${servingUnit}' to grams without food-specific data`);
    return null;
  }

  // Calculate total grams in the serving
  const servingGrams = servingSize * gramsPerUnit;

  // Calculate multiplier (e.g., 4oz = 113.4g = 1.134x of 100g)
  const multiplier = servingGrams / 100;

  return {
    calories: Math.round(nutritionPer100g.calories * multiplier),
    protein: Math.round(nutritionPer100g.protein * multiplier * 10) / 10,
    carbs: Math.round(nutritionPer100g.carbs * multiplier * 10) / 10,
    fat: Math.round(nutritionPer100g.fat * multiplier * 10) / 10,
    fiber: nutritionPer100g.fiber !== null
      ? Math.round(nutritionPer100g.fiber * multiplier * 10) / 10
      : null,
    sugar: nutritionPer100g.sugar !== null
      ? Math.round(nutritionPer100g.sugar * multiplier * 10) / 10
      : null,
  };
}

/**
 * Get common portion sizes from USDA food data
 *
 * USDA Foundation/SR Legacy foods often include common portions
 * like "1 cup", "1 large", "1 oz" with their gram weights.
 */
export function getCommonPortions(food: USDAFoodDetails): Array<{
  description: string;
  gramWeight: number;
  amount: number;
  unit: string;
}> {
  if (!food.foodPortions) return [];

  return food.foodPortions
    .filter(p => p.gramWeight > 0)
    .map(p => ({
      description: p.portionDescription || p.modifier || `${p.amount} ${p.measureUnit?.name || 'unit'}`,
      gramWeight: p.gramWeight,
      amount: p.amount,
      unit: p.measureUnit?.abbreviation || p.measureUnit?.name || 'unit',
    }));
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Search USDA and get full nutrition for top results
 *
 * Convenience function that combines search + detailed fetch
 */
export async function searchWithNutrition(
  query: string,
  limit: number = 5
): Promise<Array<{
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  nutrition: USDANutritionPer100g;
}>> {
  const searchResults = await searchUSDA(query, limit);

  // For search results, we can extract nutrition directly
  // (no need for separate detail fetch for basic macros)
  return searchResults.map(result => ({
    fdcId: result.fdcId,
    description: result.description,
    dataType: result.dataType,
    brandOwner: result.brandOwner,
    nutrition: extractNutritionFromSearchResult(result),
  }));
}

/**
 * Check if USDA API is configured and accessible
 */
export async function checkUSDAConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      configured: false,
      connected: false,
      error: 'USDA_API_KEY environment variable not set',
    };
  }

  try {
    // Test with a simple search
    const results = await searchUSDA('test', 1);
    return {
      configured: true,
      connected: true,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
