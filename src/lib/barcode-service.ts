/**
 * Barcode Lookup Service
 *
 * Uses Open Food Facts API to look up product nutrition data by barcode.
 * https://world.openfoodfacts.org/
 */

import type { BarcodeProduct } from '@/lib/types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2/product';

interface OpenFoodFactsResponse {
  status: number;
  status_verbose: string;
  product?: {
    product_name?: string;
    brands?: string;
    serving_size?: string;
    serving_quantity?: number;
    serving_quantity_unit?: string;
    nutriments?: {
      'energy-kcal'?: number;
      'energy-kcal_100g'?: number;
      'energy-kcal_serving'?: number;
      proteins?: number;
      proteins_100g?: number;
      proteins_serving?: number;
      carbohydrates?: number;
      carbohydrates_100g?: number;
      carbohydrates_serving?: number;
      fat?: number;
      fat_100g?: number;
      fat_serving?: number;
    };
    image_front_url?: string;
    image_url?: string;
  };
}

/**
 * Parse serving size string like "15 g" into number and unit
 */
function parseServingSize(servingSize?: string): { size: number; unit: string } | null {
  if (!servingSize) return null;

  // Match patterns like "15 g", "1 cup (240ml)", "100g"
  const match = servingSize.match(/^([\d.]+)\s*(\w+)/);
  if (match) {
    return {
      size: parseFloat(match[1]),
      unit: match[2].toLowerCase(),
    };
  }
  return null;
}

/**
 * Look up a product by barcode using Open Food Facts API
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  // Clean the barcode (remove any non-digit characters)
  const cleanBarcode = barcode.replace(/\D/g, '');

  if (!cleanBarcode || cleanBarcode.length < 8) {
    return {
      barcode: cleanBarcode,
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      found: false,
    };
  }

  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_API}/${cleanBarcode}.json`, {
      headers: {
        'User-Agent': 'FuelRx - Meal Planning App - contact@fuelrx.app',
      },
    });

    if (!response.ok) {
      console.error('Open Food Facts API error:', response.status);
      return {
        barcode: cleanBarcode,
        name: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        found: false,
      };
    }

    const data: OpenFoodFactsResponse = await response.json();

    if (data.status !== 1 || !data.product) {
      return {
        barcode: cleanBarcode,
        name: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        found: false,
      };
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    // Try to get per-serving values first, fall back to per-100g
    const hasServingData = nutriments['energy-kcal_serving'] !== undefined;
    const calories = hasServingData
      ? nutriments['energy-kcal_serving'] || 0
      : nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
    const protein = hasServingData
      ? nutriments.proteins_serving || 0
      : nutriments.proteins_100g || nutriments.proteins || 0;
    const carbs = hasServingData
      ? nutriments.carbohydrates_serving || 0
      : nutriments.carbohydrates_100g || nutriments.carbohydrates || 0;
    const fat = hasServingData
      ? nutriments.fat_serving || 0
      : nutriments.fat_100g || nutriments.fat || 0;

    // Parse serving size
    const parsedServing = parseServingSize(product.serving_size);
    const servingSize = product.serving_quantity || parsedServing?.size || (hasServingData ? 1 : 100);
    const servingUnit = product.serving_quantity_unit || parsedServing?.unit || (hasServingData ? 'serving' : 'g');

    return {
      barcode: cleanBarcode,
      name: product.product_name || 'Unknown Product',
      brand: product.brands,
      serving_size: servingSize,
      serving_unit: servingUnit,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      image_url: product.image_front_url || product.image_url,
      found: true,
    };
  } catch (error) {
    console.error('Error looking up barcode:', error);
    return {
      barcode: cleanBarcode,
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      found: false,
    };
  }
}

/**
 * Check if a barcode already exists in our database
 */
export async function checkBarcodeExists(barcode: string): Promise<string | null> {
  // This would be called from an API route with Supabase client
  // Returns the ingredient_nutrition ID if found, null otherwise
  // Implementation in API route since it needs server-side Supabase client
  return null;
}
