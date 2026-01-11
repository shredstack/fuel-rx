/**
 * FatSecret API Service
 *
 * Uses FatSecret Platform API for barcode lookup as a fallback to Open Food Facts.
 * Requires Premier API access for barcode lookups.
 * https://platform.fatsecret.com/
 */

import type { BarcodeProduct } from '@/lib/types';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Cache the access token in memory (server-side only)
let cachedToken: { token: string; expiresAt: number } | null = null;

interface FatSecretTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FatSecretFoodResponse {
  food?: {
    food_id: string;
    food_name: string;
    brand_name?: string;
    food_type: string;
    servings?: {
      serving: FatSecretServing | FatSecretServing[];
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  serving_url?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  is_default?: string;
}

interface FatSecretBarcodeResponse {
  food_id?: {
    value: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Get an OAuth2 access token using client credentials flow
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('FatSecret API credentials not configured');
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic barcode',
    });

    if (!response.ok) {
      console.error('FatSecret token error:', response.status);
      return null;
    }

    const data: FatSecretTokenResponse = await response.json();

    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('Error getting FatSecret access token:', error);
    return null;
  }
}

/**
 * Look up a food_id by barcode
 */
async function lookupFoodIdByBarcode(barcode: string, token: string): Promise<string | null> {
  try {
    // Pad barcode to 13 digits (GTIN-13 format) if needed
    const gtin13 = barcode.padStart(13, '0');

    const params = new URLSearchParams({
      method: 'food.find_id_for_barcode',
      barcode: gtin13,
      format: 'json',
    });

    const response = await fetch(`${API_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('FatSecret barcode lookup error:', response.status);
      return null;
    }

    const data: FatSecretBarcodeResponse = await response.json();

    if (data.error) {
      // Code 9 means "barcode not found" - not an error condition
      if (data.error.code !== 9) {
        console.error('FatSecret API error:', data.error.message);
      }
      return null;
    }

    return data.food_id?.value || null;
  } catch (error) {
    console.error('Error looking up barcode on FatSecret:', error);
    return null;
  }
}

/**
 * Get food details by food_id
 */
async function getFoodById(foodId: string, token: string): Promise<FatSecretFoodResponse | null> {
  try {
    const params = new URLSearchParams({
      method: 'food.get.v4',
      food_id: foodId,
      format: 'json',
    });

    const response = await fetch(`${API_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('FatSecret food lookup error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting food from FatSecret:', error);
    return null;
  }
}

/**
 * Look up a product by barcode using FatSecret API
 */
export async function lookupBarcodeOnFatSecret(barcode: string): Promise<BarcodeProduct> {
  const cleanBarcode = barcode.replace(/\D/g, '');

  const notFoundResult: BarcodeProduct = {
    barcode: cleanBarcode,
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    found: false,
  };

  if (!cleanBarcode || cleanBarcode.length < 8) {
    return notFoundResult;
  }

  // Get access token
  const token = await getAccessToken();
  if (!token) {
    return notFoundResult;
  }

  // Look up food_id by barcode
  const foodId = await lookupFoodIdByBarcode(cleanBarcode, token);
  if (!foodId) {
    return notFoundResult;
  }

  // Get food details
  const foodData = await getFoodById(foodId, token);
  if (!foodData?.food) {
    return notFoundResult;
  }

  const food = foodData.food;

  // Get the default or first serving
  let serving: FatSecretServing | null = null;
  if (food.servings?.serving) {
    const servings = Array.isArray(food.servings.serving)
      ? food.servings.serving
      : [food.servings.serving];

    // Prefer the default serving, otherwise use the first one
    serving = servings.find((s) => s.is_default === '1') || servings[0] || null;
  }

  // Parse nutrition values
  const calories = serving?.calories ? Math.round(parseFloat(serving.calories)) : 0;
  const protein = serving?.protein ? Math.round(parseFloat(serving.protein) * 10) / 10 : 0;
  const carbs = serving?.carbohydrate ? Math.round(parseFloat(serving.carbohydrate) * 10) / 10 : 0;
  const fat = serving?.fat ? Math.round(parseFloat(serving.fat) * 10) / 10 : 0;

  // Parse serving size
  const servingSize = serving?.metric_serving_amount
    ? parseFloat(serving.metric_serving_amount)
    : serving?.number_of_units
      ? parseFloat(serving.number_of_units)
      : 1;
  const servingUnit =
    serving?.metric_serving_unit || serving?.measurement_description || 'serving';

  return {
    barcode: cleanBarcode,
    name: food.food_name,
    brand: food.brand_name,
    serving_size: servingSize,
    serving_unit: servingUnit,
    calories,
    protein,
    carbs,
    fat,
    found: true,
  };
}

/**
 * Check if FatSecret API is configured
 */
export function isFatSecretConfigured(): boolean {
  return !!(process.env.FATSECRET_CLIENT_ID && process.env.FATSECRET_CLIENT_SECRET);
}
