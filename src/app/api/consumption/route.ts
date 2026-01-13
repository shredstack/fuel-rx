/**
 * Consumption API Endpoint
 *
 * POST /api/consumption - Log a meal or ingredient
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logMealConsumed, logIngredientConsumed } from '@/lib/consumption-service';
import type { LogMealRequest, LogIngredientRequest } from '@/lib/types';

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

    const body = await request.json();

    if (!body.type) {
      return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 });
    }

    let entry;

    if (body.type === 'ingredient') {
      const ingredientRequest = body as LogIngredientRequest;
      if (
        !ingredientRequest.ingredient_name ||
        ingredientRequest.amount === undefined ||
        !ingredientRequest.unit ||
        !ingredientRequest.meal_type ||
        ingredientRequest.calories === undefined
      ) {
        return NextResponse.json(
          { error: 'Ingredient logging requires: ingredient_name, amount, unit, meal_type, calories, protein, carbs, fat' },
          { status: 400 }
        );
      }
      entry = await logIngredientConsumed(user.id, ingredientRequest);
    } else {
      const mealRequest = body as LogMealRequest;
      if (!mealRequest.source_id) {
        return NextResponse.json({ error: 'Meal logging requires: source_id' }, { status: 400 });
      }
      entry = await logMealConsumed(user.id, mealRequest);
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error logging consumption:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Unauthorized' ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
