import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lookupBarcode } from '@/lib/barcode-service';
import { lookupBarcodeOnFatSecret, isFatSecretConfigured } from '@/lib/fatsecret-service';
import { detectIngredientCategory } from '@/lib/claude/category-detection';
import type { BarcodeProduct } from '@/lib/types';

/**
 * GET /api/ingredients/barcode?code=123456789
 *
 * Look up a product by barcode.
 * First checks our local database, then falls back to Open Food Facts API.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('code');

  if (!barcode) {
    return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
  }

  const cleanBarcode = barcode.replace(/\D/g, '');

  // First, check if we already have this barcode in our database
  const { data: existingNutrition } = await supabase
    .from('ingredient_nutrition')
    .select(
      `
      *,
      ingredients!inner(id, name, name_normalized, category, is_user_added)
    `
    )
    .eq('barcode', cleanBarcode)
    .single();

  if (existingNutrition) {
    const ingredient = existingNutrition.ingredients as {
      id: string;
      name: string;
      name_normalized: string;
      category: string;
      is_user_added: boolean;
    };

    const result: BarcodeProduct = {
      barcode: cleanBarcode,
      name: ingredient.name,
      serving_size: existingNutrition.serving_size,
      serving_unit: existingNutrition.serving_unit,
      calories: existingNutrition.calories,
      protein: existingNutrition.protein,
      carbs: existingNutrition.carbs,
      fat: existingNutrition.fat,
      found: true,
    };

    return NextResponse.json({
      ...result,
      source: 'database',
      is_user_added: ingredient.is_user_added,
      category: ingredient.category,
    });
  }

  // Not in database, try Open Food Facts first
  const openFoodFactsProduct = await lookupBarcode(cleanBarcode);

  if (openFoodFactsProduct.found) {
    const category = await detectIngredientCategory(openFoodFactsProduct.name, user.id);
    return NextResponse.json({
      ...openFoodFactsProduct,
      source: 'open_food_facts',
      is_user_added: false,
      category,
    });
  }

  // Fallback to FatSecret if configured and Open Food Facts didn't find it
  if (isFatSecretConfigured()) {
    const fatSecretProduct = await lookupBarcodeOnFatSecret(cleanBarcode);

    if (fatSecretProduct.found) {
      const category = await detectIngredientCategory(fatSecretProduct.name, user.id);
      return NextResponse.json({
        ...fatSecretProduct,
        source: 'fatsecret',
        is_user_added: false,
        category,
      });
    }
  }

  // Neither API found the product
  return NextResponse.json({
    ...openFoodFactsProduct,
    source: 'not_found',
    is_user_added: false,
  });
}
