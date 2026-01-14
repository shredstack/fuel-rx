/**
 * Extract Produce API Endpoint
 *
 * POST /api/consumption/extract-produce - Extract fruits/vegetables from a meal
 *
 * Given a meal ID, extracts produce ingredients, classifies them as fruit/vegetable,
 * and estimates their weight in grams for the 800g challenge.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractProduceFromMeal, mealHasProduce } from '@/lib/produce-extraction-service';

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

    if (!body.meal_id) {
      return NextResponse.json({ error: 'Missing required field: meal_id' }, { status: 400 });
    }

    // Extract and classify produce from the meal
    const produceIngredients = await extractProduceFromMeal(body.meal_id, user.id);

    return NextResponse.json({ produceIngredients }, { status: 200 });
  } catch (error) {
    console.error('Error extracting produce:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/consumption/extract-produce?meal_id=xxx - Check if meal has produce
 *
 * Quick check to determine if the modal should be shown.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mealId = searchParams.get('meal_id');

    if (!mealId) {
      return NextResponse.json({ error: 'Missing required param: meal_id' }, { status: 400 });
    }

    const hasProduce = await mealHasProduce(mealId);

    return NextResponse.json({ hasProduce }, { status: 200 });
  } catch (error) {
    console.error('Error checking produce:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
