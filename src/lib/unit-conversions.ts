// Unit conversion constants and utilities for converting ingredient amounts to grams
// This is needed to calculate macros from USDA data which is based on 100g servings

import { createClient } from '@/lib/supabase/server';

// Conversion factors to grams (static - these don't change)
const UNIT_TO_GRAMS: Record<string, number> = {
  // Weight units
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,

  // Volume units (approximate conversions for water-like density)
  // These are rough approximations - actual conversion depends on ingredient density
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
};

// Fallback density multipliers (used if database lookup fails)
const FALLBACK_DENSITY_MULTIPLIERS: Record<string, number> = {
  // Liquids (baseline density ~1)
  water: 1,
  milk: 1.03,
  'olive oil': 0.92,
  oil: 0.92,
  honey: 1.42,
  'maple syrup': 1.37,

  // Flour and powders (less dense)
  flour: 0.53,
  'almond flour': 0.48,
  'coconut flour': 0.45,
  'protein powder': 0.4,
  'cocoa powder': 0.45,
  sugar: 0.85,
  'brown sugar': 0.83,

  // Grains, cereals, and rice (variable)
  rice: 0.75,
  oats: 0.35,
  'rolled oats': 0.35,
  quinoa: 0.73,
  granola: 0.45,
  cereal: 0.4,
  muesli: 0.45,

  // Vegetables (leafy are less dense)
  spinach: 0.25,
  lettuce: 0.2,
  kale: 0.25,
  'mixed greens': 0.22,

  // Fruits and berries
  berries: 0.6,
  blueberries: 0.65,
  strawberries: 0.55,
  raspberries: 0.5,
  blackberries: 0.55,
  'mixed berries': 0.6,

  // Nuts and seeds
  almonds: 0.6,
  walnuts: 0.55,
  'peanut butter': 1.05,
  'almond butter': 1.05,

  // Dairy
  'greek yogurt': 1.05,
  yogurt: 1.03,
  'cottage cheese': 0.95,
  cheese: 0.9,
  butter: 0.91,
};

// Fallback item weights (used if database lookup fails)
const FALLBACK_ITEM_WEIGHTS_GRAMS: Record<string, number> = {
  egg: 50,
  eggs: 50,
  'large egg': 50,
  'large eggs': 50,
  banana: 118,
  bananas: 118,
  apple: 182,
  apples: 182,
  orange: 131,
  oranges: 131,
  avocado: 150,
  avocados: 150,
  'chicken breast': 174,
  'chicken breasts': 174,
  'salmon fillet': 170,
  'salmon fillets': 170,
  'sweet potato': 130,
  'sweet potatoes': 130,
  potato: 150,
  potatoes: 150,
  tomato: 123,
  tomatoes: 123,
  onion: 110,
  onions: 110,
  garlic: 3, // single clove
  'garlic clove': 3,
  'garlic cloves': 3,
  clove: 3,
  cloves: 3,
  lemon: 58,
  lemons: 58,
  lime: 44,
  limes: 44,
  slice: 30, // generic slice (bread, etc)
  slices: 30,
  piece: 100, // generic piece
  pieces: 100,
};

// Cache for database lookups to avoid repeated queries
let densityCache: Record<string, number> | null = null;
let itemWeightCache: Record<string, number> | null = null;
let cacheLoadedAt: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ConversionResult {
  grams: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Load conversion data from database into cache
 */
async function loadConversionCache(): Promise<void> {
  const now = Date.now();
  if (densityCache && itemWeightCache && (now - cacheLoadedAt) < CACHE_TTL_MS) {
    return; // Cache is still valid
  }

  try {
    const supabase = await createClient();

    // Load density multipliers
    const { data: densities } = await supabase
      .from('density_multipliers')
      .select('ingredient_name, multiplier');

    if (densities && densities.length > 0) {
      densityCache = {};
      for (const row of densities) {
        densityCache[row.ingredient_name.toLowerCase()] = parseFloat(row.multiplier);
      }
    } else {
      // Use fallback if no data in database
      densityCache = { ...FALLBACK_DENSITY_MULTIPLIERS };
    }

    // Load item weights
    const { data: weights } = await supabase
      .from('item_weights')
      .select('ingredient_name, weight_grams');

    if (weights && weights.length > 0) {
      itemWeightCache = {};
      for (const row of weights) {
        itemWeightCache[row.ingredient_name.toLowerCase()] = parseFloat(row.weight_grams);
      }
    } else {
      // Use fallback if no data in database
      itemWeightCache = { ...FALLBACK_ITEM_WEIGHTS_GRAMS };
    }

    cacheLoadedAt = now;
  } catch (error) {
    console.warn('Failed to load conversion data from database, using fallbacks:', error);
    densityCache = { ...FALLBACK_DENSITY_MULTIPLIERS };
    itemWeightCache = { ...FALLBACK_ITEM_WEIGHTS_GRAMS };
    cacheLoadedAt = now;
  }
}

/**
 * Converts an ingredient amount to grams
 * @param amount - The numeric amount (e.g., "2", "1.5")
 * @param unit - The unit of measurement (e.g., "cups", "oz", "large")
 * @param ingredientName - The name of the ingredient for density/item weight lookups
 * @returns ConversionResult with grams and confidence level
 */
export async function convertToGrams(
  amount: string,
  unit: string,
  ingredientName: string
): Promise<ConversionResult> {
  // Ensure cache is loaded
  await loadConversionCache();

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return { grams: 100, confidence: 'low' }; // Default fallback
  }

  const normalizedUnit = unit.toLowerCase().trim();
  const normalizedIngredient = ingredientName.toLowerCase().trim();

  // Check if it's a countable item (eggs, bananas, etc.)
  if (isCountableItem(normalizedUnit, normalizedIngredient)) {
    const itemWeight = getItemWeight(normalizedIngredient);
    if (itemWeight) {
      return { grams: numericAmount * itemWeight, confidence: 'high' };
    }
  }

  // Check if we have a direct unit conversion
  const baseConversion = UNIT_TO_GRAMS[normalizedUnit];
  if (baseConversion) {
    // For volume units, apply density multiplier if available
    if (isVolumeUnit(normalizedUnit)) {
      const { multiplier: densityMultiplier, found } = getDensityMultiplier(normalizedIngredient);
      return {
        grams: numericAmount * baseConversion * densityMultiplier,
        confidence: found ? 'high' : 'medium',
      };
    }
    // Weight units are direct conversion
    return { grams: numericAmount * baseConversion, confidence: 'high' };
  }

  // Fallback: assume it's a count of standard items
  const itemWeight = getItemWeight(normalizedIngredient);
  if (itemWeight) {
    return { grams: numericAmount * itemWeight, confidence: 'medium' };
  }

  // Last resort: assume 100g per unit
  return { grams: numericAmount * 100, confidence: 'low' };
}

/**
 * Synchronous version for contexts where async isn't possible
 * Uses cached data or fallbacks
 */
export function convertToGramsSync(
  amount: string,
  unit: string,
  ingredientName: string
): ConversionResult {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return { grams: 100, confidence: 'low' };
  }

  const normalizedUnit = unit.toLowerCase().trim();
  const normalizedIngredient = ingredientName.toLowerCase().trim();

  // Check if it's a countable item
  if (isCountableItem(normalizedUnit, normalizedIngredient)) {
    const itemWeight = getItemWeight(normalizedIngredient);
    if (itemWeight) {
      return { grams: numericAmount * itemWeight, confidence: 'high' };
    }
  }

  // Check if we have a direct unit conversion
  const baseConversion = UNIT_TO_GRAMS[normalizedUnit];
  if (baseConversion) {
    if (isVolumeUnit(normalizedUnit)) {
      const { multiplier: densityMultiplier, found } = getDensityMultiplier(normalizedIngredient);
      return {
        grams: numericAmount * baseConversion * densityMultiplier,
        confidence: found ? 'high' : 'medium',
      };
    }
    return { grams: numericAmount * baseConversion, confidence: 'high' };
  }

  // Fallback: assume it's a count of standard items
  const itemWeight = getItemWeight(normalizedIngredient);
  if (itemWeight) {
    return { grams: numericAmount * itemWeight, confidence: 'medium' };
  }

  return { grams: numericAmount * 100, confidence: 'low' };
}

function isCountableItem(unit: string, ingredient: string): boolean {
  const countableUnits = [
    'large', 'medium', 'small', 'whole', 'piece', 'pieces',
    'slice', 'slices', 'clove', 'cloves', 'fillet', 'fillets',
    'breast', 'breasts', 'thigh', 'thighs', ''
  ];
  return countableUnits.includes(unit) || unit === '' || !isNaN(parseFloat(unit));
}

function isVolumeUnit(unit: string): boolean {
  const volumeUnits = [
    'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
    'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
    'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces'
  ];
  return volumeUnits.includes(unit);
}

function getItemWeight(ingredient: string): number | null {
  // Use cache if available, otherwise fallback
  const weights = itemWeightCache || FALLBACK_ITEM_WEIGHTS_GRAMS;

  // Direct match
  if (weights[ingredient]) {
    return weights[ingredient];
  }

  // Partial match
  for (const [key, weight] of Object.entries(weights)) {
    if (ingredient.includes(key) || key.includes(ingredient)) {
      return weight;
    }
  }

  return null;
}

function getDensityMultiplier(ingredient: string): { multiplier: number; found: boolean } {
  // Use cache if available, otherwise fallback
  const densities = densityCache || FALLBACK_DENSITY_MULTIPLIERS;

  // Direct match
  if (densities[ingredient]) {
    return { multiplier: densities[ingredient], found: true };
  }

  // Partial match
  for (const [key, multiplier] of Object.entries(densities)) {
    if (ingredient.includes(key) || key.includes(ingredient)) {
      return { multiplier, found: true };
    }
  }

  // Default to 1 (water-like density) - not found
  return { multiplier: 1, found: false };
}

/**
 * Formats a gram amount back to a user-friendly unit
 * @param grams - Amount in grams
 * @param originalUnit - The original unit to convert back to
 * @returns Formatted string with amount and unit
 */
export function formatFromGrams(grams: number, originalUnit: string): string {
  const normalizedUnit = originalUnit.toLowerCase().trim();
  const conversion = UNIT_TO_GRAMS[normalizedUnit];

  if (conversion) {
    const amount = grams / conversion;
    // Round to reasonable precision
    const rounded = Math.round(amount * 10) / 10;
    return `${rounded}`;
  }

  // For countable items, return rounded whole numbers
  return `${Math.round(grams / 100)}`;
}
