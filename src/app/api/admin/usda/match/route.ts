import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-service';
import { findBestUSDAMatch } from '@/lib/usda-matching-service';
import { getUSDAFoodDetails, extractNutritionPer100g, getCommonPortions } from '@/lib/usda-service';

/**
 * POST /api/admin/usda/match
 *
 * Trigger USDA matching for a single nutrition record using Claude
 * Returns the match result for admin review
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  let adminUserId: string;
  try {
    const result = await requireAdmin(supabase);
    adminUserId = result.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden: Admin access required' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  let body: { nutritionId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { nutritionId } = body;

  if (!nutritionId) {
    return NextResponse.json(
      { error: 'nutritionId is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch the nutrition record with ingredient details
    const { data: nutrition, error: fetchError } = await supabase
      .from('ingredient_nutrition_with_details')
      .select('*')
      .eq('id', nutritionId)
      .single();

    if (fetchError || !nutrition) {
      return NextResponse.json(
        { error: 'Nutrition record not found' },
        { status: 404 }
      );
    }

    // Run Claude matching
    const matchResult = await findBestUSDAMatch({
      ingredientName: nutrition.ingredient_name,
      servingSize: nutrition.serving_size,
      servingUnit: nutrition.serving_unit,
      category: nutrition.category,
      existingNutrition: {
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      },
      userId: adminUserId,
    });

    // Return the result for admin review (don't auto-apply)
    return NextResponse.json({
      nutritionId,
      ingredientName: nutrition.ingredient_name,
      currentNutrition: {
        servingSize: nutrition.serving_size,
        servingUnit: nutrition.serving_unit,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        source: nutrition.source,
      },
      matchResult,
    });
  } catch (error) {
    console.error('Error matching USDA:', error);
    return NextResponse.json(
      { error: 'Failed to match ingredient to USDA' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/usda/match
 *
 * Apply a USDA match to a nutrition record
 * Can be used after reviewing the match result or for manual override
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  let adminUserId: string;
  try {
    const result = await requireAdmin(supabase);
    adminUserId = result.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden: Admin access required' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  let body: {
    nutritionId: string;
    fdcId: number;
    confidence?: number;
    reasoning?: string;
    updateNutrition?: boolean;
    isManualOverride?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    nutritionId,
    fdcId,
    confidence = 1.0,
    reasoning = 'Manual admin selection',
    updateNutrition = true,
    isManualOverride = false,
  } = body;

  if (!nutritionId || !fdcId) {
    return NextResponse.json(
      { error: 'nutritionId and fdcId are required' },
      { status: 400 }
    );
  }

  try {
    // Fetch current nutrition record
    const { data: nutrition, error: fetchError } = await supabase
      .from('ingredient_nutrition_with_details')
      .select('*')
      .eq('id', nutritionId)
      .single();

    if (fetchError || !nutrition) {
      return NextResponse.json(
        { error: 'Nutrition record not found' },
        { status: 404 }
      );
    }

    // Fetch USDA food details
    const usdaFood = await getUSDAFoodDetails(fdcId);
    if (!usdaFood) {
      return NextResponse.json(
        { error: 'USDA food not found' },
        { status: 404 }
      );
    }

    const nutritionPer100g = extractNutritionPer100g(usdaFood);
    const usdaPortions = getCommonPortions(usdaFood);

    // Build update object
    const updateData: Record<string, unknown> = {
      usda_fdc_id: fdcId.toString(),
      usda_match_status: isManualOverride ? 'manual_override' : 'matched',
      usda_matched_at: new Date().toISOString(),
      usda_match_confidence: confidence,
      usda_match_reasoning: reasoning,
      usda_calories_per_100g: nutritionPer100g.calories,
      usda_protein_per_100g: nutritionPer100g.protein,
      usda_carbs_per_100g: nutritionPer100g.carbs,
      usda_fat_per_100g: nutritionPer100g.fat,
      usda_fiber_per_100g: nutritionPer100g.fiber,
      usda_sugar_per_100g: nutritionPer100g.sugar,
      source: 'usda',
      confidence_score: 0.95, // High confidence for USDA data
      updated_at: new Date().toISOString(),
    };

    // Calculate serving-specific nutrition if updateNutrition is true
    // Uses USDA portion data when available for non-weight units (cup, tbsp, etc.)
    let conversionSuccessful = false;
    let conversionMethod = 'none';
    let calculatedGramWeight: number | undefined;

    if (updateNutrition) {
      const conversionResult = calculateServingNutritionWithPortions(
        nutritionPer100g,
        nutrition.serving_size,
        nutrition.serving_unit,
        usdaPortions
      );

      if (conversionResult.nutrition) {
        updateData.calories = conversionResult.nutrition.calories;
        updateData.protein = conversionResult.nutrition.protein;
        updateData.carbs = conversionResult.nutrition.carbs;
        updateData.fat = conversionResult.nutrition.fat;
        if (conversionResult.nutrition.fiber !== null) {
          updateData.fiber = conversionResult.nutrition.fiber;
        }
        if (conversionResult.nutrition.sugar !== null) {
          updateData.sugar = conversionResult.nutrition.sugar;
        }
        conversionSuccessful = true;
        conversionMethod = conversionResult.method;
        calculatedGramWeight = conversionResult.gramWeight;
      }
      // If conversion failed, we still save the USDA per-100g values
      // but don't update the serving-specific macros
    }

    // Update the nutrition record
    const { error: updateError } = await supabase
      .from('ingredient_nutrition')
      .update(updateData)
      .eq('id', nutritionId);

    if (updateError) {
      console.error('Error updating nutrition:', updateError);
      console.error('Update data was:', JSON.stringify(updateData, null, 2));
      return NextResponse.json(
        { error: `Failed to update nutrition record: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Log the admin action
    await logAdminAction(
      supabase,
      adminUserId,
      'update_nutrition',
      'ingredient_nutrition',
      nutritionId,
      {
        usda_fdc_id: { old: nutrition.usda_fdc_id, new: fdcId.toString() },
        usda_match_status: { old: nutrition.usda_match_status, new: isManualOverride ? 'manual_override' : 'matched' },
        source: { old: nutrition.source, new: 'usda' },
      }
    );

    // Build detailed message
    let message: string;
    if (conversionSuccessful) {
      if (conversionMethod === 'usda_portion') {
        message = `Updated nutrition for ${nutrition.serving_size} ${nutrition.serving_unit} using USDA portion data (${Math.round(calculatedGramWeight || 0)}g)`;
      } else {
        message = `Updated nutrition for ${nutrition.serving_size} ${nutrition.serving_unit} (${Math.round(calculatedGramWeight || 0)}g)`;
      }
    } else {
      message = `Saved USDA data but could not convert "${nutrition.serving_unit}" to grams. No matching USDA portion data available. Macros unchanged - please update manually.`;
    }

    return NextResponse.json({
      success: true,
      nutritionId,
      fdcId,
      usdaDescription: usdaFood.description,
      nutritionPer100g,
      updatedNutrition: updateNutrition,
      conversionSuccessful,
      conversionMethod,
      calculatedGramWeight,
      servingSize: nutrition.serving_size,
      servingUnit: nutrition.serving_unit,
      availablePortions: usdaPortions.map(p => `${p.description} (${p.gramWeight}g)`),
      message,
    });
  } catch (error) {
    console.error('Error applying USDA match:', error);
    return NextResponse.json(
      { error: 'Failed to apply USDA match' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

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
};

// Common unit aliases for matching USDA portions
const UNIT_ALIASES: Record<string, string[]> = {
  cup: ['cup', 'cups', 'c'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'tbs', 'T'],
  tsp: ['tsp', 'teaspoon', 'teaspoons', 't'],
  whole: ['whole', 'unit', 'piece', 'item', 'each'],
  slice: ['slice', 'slices'],
  medium: ['medium', 'med'],
  large: ['large', 'lg'],
  small: ['small', 'sm'],
};

/**
 * Try to find a matching portion from USDA data for the given serving size/unit
 * Returns gram weight if found, null otherwise
 */
function findMatchingPortion(
  portions: Array<{ description: string; gramWeight: number; amount: number; unit: string }>,
  servingSize: number,
  servingUnit: string
): number | null {
  const unitLower = servingUnit.toLowerCase();

  // Find which canonical unit this matches
  let canonicalUnit: string | null = null;
  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(unitLower) || unitLower.includes(canonical)) {
      canonicalUnit = canonical;
      break;
    }
  }

  // Search through USDA portions
  for (const portion of portions) {
    const portionDesc = portion.description.toLowerCase();
    const portionUnit = portion.unit.toLowerCase();

    // Direct unit match
    if (portionUnit === unitLower || portionDesc.includes(unitLower)) {
      // Found a match - scale by serving size
      return (portion.gramWeight / portion.amount) * servingSize;
    }

    // Canonical unit match
    if (canonicalUnit && (portionUnit.includes(canonicalUnit) || portionDesc.includes(canonicalUnit))) {
      return (portion.gramWeight / portion.amount) * servingSize;
    }
  }

  return null;
}

interface ServingNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
}

interface ConversionResult {
  nutrition: ServingNutrition | null;
  method: 'weight' | 'usda_portion' | 'failed';
  gramWeight?: number;
}

/**
 * Calculate nutrition for a serving, using multiple methods:
 * 1. Direct weight conversion (oz, g, lb, kg)
 * 2. USDA portion data (cup, tbsp, whole, etc.)
 * 3. Return null if no conversion possible
 */
function calculateServingNutritionWithPortions(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number | null; sugar: number | null },
  servingSize: number,
  servingUnit: string,
  usdaPortions: Array<{ description: string; gramWeight: number; amount: number; unit: string }>
): ConversionResult {
  const unit = servingUnit.toLowerCase();

  // Method 1: Direct weight conversion
  const gramsPerUnit = GRAMS_PER_UNIT[unit];
  if (gramsPerUnit) {
    const servingGrams = servingSize * gramsPerUnit;
    const multiplier = servingGrams / 100;
    return {
      nutrition: calculateNutritionFromMultiplier(per100g, multiplier),
      method: 'weight',
      gramWeight: servingGrams,
    };
  }

  // Method 2: Try to find matching USDA portion
  const portionGrams = findMatchingPortion(usdaPortions, servingSize, servingUnit);
  if (portionGrams) {
    const multiplier = portionGrams / 100;
    return {
      nutrition: calculateNutritionFromMultiplier(per100g, multiplier),
      method: 'usda_portion',
      gramWeight: portionGrams,
    };
  }

  // Method 3: No conversion possible
  console.warn(`Cannot convert "${servingSize} ${servingUnit}" to grams - no weight conversion or USDA portion data available`);
  return {
    nutrition: null,
    method: 'failed',
  };
}

function calculateNutritionFromMultiplier(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number | null; sugar: number | null },
  multiplier: number
): ServingNutrition {
  return {
    calories: Math.round(per100g.calories * multiplier),
    protein: Math.round(per100g.protein * multiplier * 10) / 10,
    carbs: Math.round(per100g.carbs * multiplier * 10) / 10,
    fat: Math.round(per100g.fat * multiplier * 10) / 10,
    fiber: per100g.fiber !== null ? Math.round(per100g.fiber * multiplier * 10) / 10 : null,
    sugar: per100g.sugar !== null ? Math.round(per100g.sugar * multiplier * 10) / 10 : null,
  };
}
