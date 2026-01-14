/**
 * Log Produce API Endpoint
 *
 * POST /api/consumption/log-produce - Log produce ingredients for 800g tracking
 *
 * Creates separate consumption entries for each fruit/vegetable extracted
 * from a meal, counting toward the 800g daily challenge.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logProduceIngredients } from '@/lib/consumption-service';
import type { MealType } from '@/lib/types';

interface LogProduceRequest {
  ingredients: Array<{
    name: string;
    category: 'fruit' | 'vegetable';
    grams: number;
  }>;
  meal_type: MealType;
  consumed_at: string;
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

    const body = (await request.json()) as LogProduceRequest;

    // Validate request
    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return NextResponse.json({ error: 'Missing required field: ingredients (array)' }, { status: 400 });
    }

    if (!body.meal_type) {
      return NextResponse.json({ error: 'Missing required field: meal_type' }, { status: 400 });
    }

    if (!body.consumed_at) {
      return NextResponse.json({ error: 'Missing required field: consumed_at' }, { status: 400 });
    }

    // Validate each ingredient
    for (const ing of body.ingredients) {
      if (!ing.name || !ing.category || typeof ing.grams !== 'number') {
        return NextResponse.json(
          { error: 'Each ingredient requires: name, category (fruit/vegetable), grams (number)' },
          { status: 400 }
        );
      }
      if (ing.category !== 'fruit' && ing.category !== 'vegetable') {
        return NextResponse.json(
          { error: 'Ingredient category must be "fruit" or "vegetable"' },
          { status: 400 }
        );
      }
    }

    // Log the produce ingredients
    const entries = await logProduceIngredients(
      user.id,
      body.ingredients,
      body.meal_type,
      body.consumed_at
    );

    return NextResponse.json({ entries }, { status: 201 });
  } catch (error) {
    console.error('Error logging produce:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
