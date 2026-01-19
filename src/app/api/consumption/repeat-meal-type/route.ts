/**
 * Repeat Meal Type API Endpoint
 *
 * POST /api/consumption/repeat-meal-type
 *
 * Copies all consumption entries of a specific meal type from one day to another.
 * Used for per-section "Log same as yesterday" feature.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { repeatMealType } from '@/lib/consumption-service';
import type { MealType } from '@/lib/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mealType, sourceDate, targetDate } = body;

    if (!mealType || !sourceDate || !targetDate) {
      return NextResponse.json(
        { error: 'mealType, sourceDate, and targetDate are required' },
        { status: 400 }
      );
    }

    // Validate mealType
    const validMealTypes: MealType[] = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'];
    if (!validMealTypes.includes(mealType)) {
      return NextResponse.json({ error: 'Invalid mealType' }, { status: 400 });
    }

    // Validate date formats (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(sourceDate) || !dateRegex.test(targetDate)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const entries = await repeatMealType(user.id, mealType, sourceDate, targetDate);

    return NextResponse.json({
      message: `Copied ${entries.length} entries`,
      copied: entries.length,
      entries,
    });
  } catch (error) {
    console.error('Error repeating meal type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
