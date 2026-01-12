import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AddUserIngredientRequest, IngredientToLog } from '@/lib/types';

/**
 * POST /api/ingredients/user-added
 *
 * Add a new user-created ingredient with nutrition data.
 * The ingredient is marked as user-added (not FuelRx validated).
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: AddUserIngredientRequest = await request.json();

  // Validate required fields
  if (!body.name || body.serving_size === undefined || !body.serving_unit) {
    return NextResponse.json(
      { error: 'Name, serving_size, and serving_unit are required' },
      { status: 400 }
    );
  }

  const normalizedName = body.name.toLowerCase().trim();

  // Check if ingredient already exists
  const { data: existing } = await supabase
    .from('ingredients')
    .select('id')
    .eq('name_normalized', normalizedName)
    .single();

  let ingredientId: string;

  if (existing) {
    // Ingredient exists, use existing ID
    ingredientId = existing.id;
  } else {
    // Create new ingredient (marked as user-added)
    const { data: newIngredient, error: insertError } = await supabase
      .from('ingredients')
      .insert({
        name: body.name.trim(),
        name_normalized: normalizedName,
        category: body.category || 'other',
        is_user_added: true,
        added_by_user_id: user.id,
        added_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating ingredient:', insertError);
      return NextResponse.json(
        { error: 'Failed to create ingredient' },
        { status: 500 }
      );
    }

    ingredientId = newIngredient.id;
  }

  // Check if nutrition for this serving size already exists
  const { data: existingNutrition } = await supabase
    .from('ingredient_nutrition')
    .select('id')
    .eq('ingredient_id', ingredientId)
    .eq('serving_size', body.serving_size)
    .eq('serving_unit', body.serving_unit)
    .single();

  if (existingNutrition) {
    // Update existing nutrition entry
    const { error: updateError } = await supabase
      .from('ingredient_nutrition')
      .update({
        calories: Math.round(body.calories),
        protein: Math.round(body.protein * 10) / 10,
        carbs: Math.round(body.carbs * 10) / 10,
        fat: Math.round(body.fat * 10) / 10,
        barcode: body.barcode,
        source: body.barcode ? 'barcode_scan' : 'user_corrected',
        validated: false,
      })
      .eq('id', existingNutrition.id);

    if (updateError) {
      console.error('Error updating nutrition:', updateError);
      return NextResponse.json(
        { error: 'Failed to update nutrition data' },
        { status: 500 }
      );
    }
  } else {
    // Create new nutrition entry
    const { error: nutritionError } = await supabase
      .from('ingredient_nutrition')
      .insert({
        ingredient_id: ingredientId,
        serving_size: body.serving_size,
        serving_unit: body.serving_unit,
        calories: Math.round(body.calories),
        protein: Math.round(body.protein * 10) / 10,
        carbs: Math.round(body.carbs * 10) / 10,
        fat: Math.round(body.fat * 10) / 10,
        barcode: body.barcode,
        source: body.barcode ? 'barcode_scan' : 'user_corrected',
        validated: false,
        confidence_score: 0.5, // Lower confidence for user-added
      });

    if (nutritionError) {
      console.error('Error creating nutrition:', nutritionError);
      return NextResponse.json(
        { error: 'Failed to create nutrition data' },
        { status: 500 }
      );
    }
  }

  // Return the ingredient in IngredientToLog format for immediate use
  // default_amount should be 1 (one serving), not the gram weight
  // The serving_size/serving_unit describe what one serving looks like (e.g., "27g")
  // calories_per_serving etc. are the values for ONE serving
  const result: IngredientToLog = {
    name: body.name.trim(),
    default_amount: 1,
    default_unit: body.serving_unit === 'g' || body.serving_unit === 'ml'
      ? `serving (${body.serving_size}${body.serving_unit})`
      : body.serving_unit,
    calories_per_serving: Math.round(body.calories),
    protein_per_serving: Math.round(body.protein * 10) / 10,
    carbs_per_serving: Math.round(body.carbs * 10) / 10,
    fat_per_serving: Math.round(body.fat * 10) / 10,
    source: body.barcode ? 'barcode' : 'manual',
    is_user_added: true,
    barcode: body.barcode,
  };

  return NextResponse.json(result, { status: 201 });
}

/**
 * GET /api/ingredients/user-added
 *
 * Get all user-added ingredients (optionally filtered by current user only).
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
  const myOnly = searchParams.get('my_only') === 'true';
  const search = searchParams.get('search');

  let query = supabase
    .from('ingredients')
    .select(
      `
      *,
      ingredient_nutrition(
        serving_size,
        serving_unit,
        calories,
        protein,
        carbs,
        fat,
        barcode
      )
    `
    )
    .eq('is_user_added', true)
    .order('name');

  if (myOnly) {
    query = query.eq('added_by_user_id', user.id);
  }

  if (search) {
    query = query.ilike('name_normalized', `%${search.toLowerCase()}%`);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error('Error fetching user-added ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ingredients' },
      { status: 500 }
    );
  }

  // Transform to IngredientToLog format
  // default_amount should be 1 (one serving), not the gram weight
  const ingredients: IngredientToLog[] = (data || [])
    .filter((i) => i.ingredient_nutrition && i.ingredient_nutrition.length > 0)
    .map((i) => {
      const nutrition = i.ingredient_nutrition[0];
      const unit = nutrition.serving_unit === 'g' || nutrition.serving_unit === 'ml'
        ? `serving (${nutrition.serving_size}${nutrition.serving_unit})`
        : nutrition.serving_unit;
      return {
        name: i.name,
        default_amount: 1,
        default_unit: unit,
        calories_per_serving: nutrition.calories,
        protein_per_serving: nutrition.protein,
        carbs_per_serving: nutrition.carbs,
        fat_per_serving: nutrition.fat,
        source: nutrition.barcode ? 'barcode' : 'manual',
        is_user_added: true,
        barcode: nutrition.barcode,
      } as IngredientToLog;
    });

  return NextResponse.json(ingredients);
}
