/**
 * Import USDA Food API
 *
 * POST /api/consumption/ingredients/import-usda
 *
 * Imports a USDA food into the FuelRx database for future use.
 * If the food already exists (by usda_fdc_id), returns the existing ingredient.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUSDAFoodDetails, extractNutritionPer100g, getCommonPortions } from '@/lib/usda-service';
import { calculateHealthScoreFromDetails } from '@/lib/health-score-service';
import { detectIngredientCategory } from '@/lib/claude/category-detection';
import type { IngredientToLog, IngredientCategoryType } from '@/lib/types';

interface ImportUSDARequest {
  fdcId: number;
  category?: IngredientCategoryType;
  nameOverride?: string;
  caloriesOverride?: number;
  proteinOverride?: number;
  carbsOverride?: number;
  fatOverride?: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ImportUSDARequest = await request.json();

    if (!body.fdcId) {
      return NextResponse.json({ error: 'fdcId is required' }, { status: 400 });
    }

    const fdcIdStr = body.fdcId.toString();

    // Check if this USDA food has already been imported
    const { data: existingNutrition } = await supabase
      .from('ingredient_nutrition')
      .select(`
        *,
        ingredients (
          id,
          name,
          name_normalized,
          category,
          health_score
        )
      `)
      .eq('usda_fdc_id', fdcIdStr)
      .single();

    if (existingNutrition && existingNutrition.ingredients) {
      // Already imported - return existing ingredient
      const ing = existingNutrition.ingredients;
      const unit =
        existingNutrition.serving_size === 100 && existingNutrition.serving_unit === 'g'
          ? '100g'
          : `${existingNutrition.serving_size}${existingNutrition.serving_unit}`;

      const result: IngredientToLog = {
        name: ing.name,
        default_amount: 1,
        default_unit: unit,
        calories_per_serving: existingNutrition.calories,
        protein_per_serving: existingNutrition.protein,
        carbs_per_serving: existingNutrition.carbs,
        fat_per_serving: existingNutrition.fat,
        source: 'usda',
        is_user_added: false,
        is_validated: true,
        category: ing.category as IngredientCategoryType,
        usda_fdc_id: fdcIdStr,
        health_score: ing.health_score,
        usda_data_type: existingNutrition.usda_data_type,
        usda_brand_owner: existingNutrition.usda_brand_owner,
      };

      return NextResponse.json(result);
    }

    // Fetch full details from USDA
    const usdaFood = await getUSDAFoodDetails(body.fdcId);

    if (!usdaFood) {
      return NextResponse.json(
        { error: 'Failed to fetch food details from USDA' },
        { status: 502 }
      );
    }

    // Extract nutrition and calculate health score
    const nutritionPer100g = extractNutritionPer100g(usdaFood);
    const healthScore = calculateHealthScoreFromDetails(usdaFood);
    const portions = getCommonPortions(usdaFood);

    // Determine category using AI detection
    const category = body.category || await detectIngredientCategory(usdaFood.description, user.id);

    // Track whether user provided any overrides
    const hasUserOverrides = !!(body.nameOverride || body.caloriesOverride !== undefined ||
      body.proteinOverride !== undefined || body.carbsOverride !== undefined ||
      body.fatOverride !== undefined);

    // Create a clean name (remove excessive detail from USDA descriptions)
    // Use user-provided name override if available
    const cleanName = body.nameOverride?.trim() ||
      usdaFood.description
        .split(',')
        .slice(0, 3) // Keep first 3 parts
        .join(',')
        .trim();

    const normalizedName = cleanName.toLowerCase().trim();

    // Check if ingredient with this normalized name already exists
    const { data: existingIngredient } = await supabase
      .from('ingredients')
      .select('id')
      .eq('name_normalized', normalizedName)
      .is('deleted_at', null)
      .single();

    let ingredientId: string;

    if (existingIngredient) {
      ingredientId = existingIngredient.id;

      // Update the health score on existing ingredient
      await supabase
        .from('ingredients')
        .update({ health_score: healthScore.score })
        .eq('id', ingredientId);
    } else {
      // Create new ingredient
      const { data: newIngredient, error: insertError } = await supabase
        .from('ingredients')
        .insert({
          name: cleanName,
          name_normalized: normalizedName,
          category,
          is_user_added: hasUserOverrides,
          health_score: healthScore.score,
          ...(hasUserOverrides ? { added_by_user_id: user.id } : {}),
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

    // Determine serving size - use USDA serving if available, otherwise default to 100g
    let servingSize = 100;
    let servingUnit = 'g';
    let caloriesPerServing = nutritionPer100g.calories;
    let proteinPerServing = nutritionPer100g.protein;
    let carbsPerServing = nutritionPer100g.carbs;
    let fatPerServing = nutritionPer100g.fat;

    // If USDA provides a serving size, use it
    if (usdaFood.servingSize && usdaFood.servingSizeUnit) {
      servingSize = usdaFood.servingSize;
      servingUnit = usdaFood.servingSizeUnit;

      // Recalculate nutrition for USDA serving size (if unit is grams)
      if (servingUnit.toLowerCase() === 'g' || servingUnit.toLowerCase() === 'ml') {
        const multiplier = servingSize / 100;
        caloriesPerServing = Math.round(nutritionPer100g.calories * multiplier);
        proteinPerServing = Math.round(nutritionPer100g.protein * multiplier * 10) / 10;
        carbsPerServing = Math.round(nutritionPer100g.carbs * multiplier * 10) / 10;
        fatPerServing = Math.round(nutritionPer100g.fat * multiplier * 10) / 10;
      }
    } else if (portions.length > 0) {
      // Use first common portion as default serving
      const firstPortion = portions[0];
      servingSize = firstPortion.gramWeight;
      servingUnit = 'g';

      const multiplier = servingSize / 100;
      caloriesPerServing = Math.round(nutritionPer100g.calories * multiplier);
      proteinPerServing = Math.round(nutritionPer100g.protein * multiplier * 10) / 10;
      carbsPerServing = Math.round(nutritionPer100g.carbs * multiplier * 10) / 10;
      fatPerServing = Math.round(nutritionPer100g.fat * multiplier * 10) / 10;
    }

    // Apply user overrides for nutrition values if provided
    if (body.caloriesOverride !== undefined) caloriesPerServing = body.caloriesOverride;
    if (body.proteinOverride !== undefined) proteinPerServing = body.proteinOverride;
    if (body.carbsOverride !== undefined) carbsPerServing = body.carbsOverride;
    if (body.fatOverride !== undefined) fatPerServing = body.fatOverride;

    // Create nutrition record
    const { error: nutritionError } = await supabase
      .from('ingredient_nutrition')
      .insert({
        ingredient_id: ingredientId,
        serving_size: servingSize,
        serving_unit: servingUnit,
        calories: caloriesPerServing,
        protein: proteinPerServing,
        carbs: carbsPerServing,
        fat: fatPerServing,
        fiber: nutritionPer100g.fiber,
        sugar: nutritionPer100g.sugar,
        source: 'usda',
        usda_fdc_id: fdcIdStr,
        usda_data_type: usdaFood.dataType,
        usda_brand_owner: usdaFood.brandOwner || null,
        usda_ingredients_list: usdaFood.ingredients || null,
        confidence_score: hasUserOverrides ? 0.8 : 0.95, // Lower confidence when user modified USDA data
        validated: !hasUserOverrides,
        usda_match_status: 'matched',
        usda_match_confidence: 1.0,
      });

    if (nutritionError) {
      console.error('Error creating nutrition record:', nutritionError);
      return NextResponse.json(
        { error: 'Failed to create nutrition record' },
        { status: 500 }
      );
    }

    // Return the ingredient ready for use
    const displayUnit =
      servingSize === 100 && servingUnit === 'g'
        ? '100g'
        : `${servingSize}${servingUnit}`;

    const result: IngredientToLog = {
      name: cleanName,
      default_amount: 1,
      default_unit: displayUnit,
      calories_per_serving: caloriesPerServing,
      protein_per_serving: proteinPerServing,
      carbs_per_serving: carbsPerServing,
      fat_per_serving: fatPerServing,
      source: 'usda',
      is_user_added: hasUserOverrides,
      is_validated: !hasUserOverrides,
      category,
      usda_fdc_id: fdcIdStr,
      health_score: healthScore.score,
      usda_data_type: usdaFood.dataType,
      usda_brand_owner: usdaFood.brandOwner,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error importing USDA food:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
