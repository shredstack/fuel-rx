/**
 * Consumption API Endpoint
 *
 * POST /api/consumption - Log a meal or ingredient
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logMealConsumed, logIngredientConsumed } from '@/lib/consumption-service';
import { upsertResolution, isReminderMealType } from '@/lib/meal-reminders/resolution-service';
import { celebrateIfOnTime } from '@/lib/celebrations/meal-on-time-service';
import { checkReminderAccess } from '@/lib/subscription/check-reminder-access';
import type { LogMealRequest, LogIngredientRequest } from '@/lib/types';
import type { MealOnTimeCelebration } from '@/lib/meal-reminders/types';

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

    // Server-side hooks: logging a meal of a reminder meal_type silences that
    // meal's reminder for the day, and may also trigger an on-time celebration
    // when the user's settings say so. Both are non-blocking — a failure must
    // not fail the meal log.
    let celebration: MealOnTimeCelebration | null = null;
    if (entry && isReminderMealType(entry.meal_type) && entry.consumed_date) {
      try {
        await upsertResolution(supabase, {
          userId: user.id,
          reminderDate: entry.consumed_date,
          mealType: entry.meal_type,
          source: 'meal_logged',
          consumptionLogId: entry.id,
        });
      } catch (hookError) {
        console.error('[consumption] reminder resolution hook failed:', hookError);
      }

      try {
        const access = await checkReminderAccess(user.id);
        celebration = await celebrateIfOnTime(
          supabase,
          {
            userId: user.id,
            mealType: entry.meal_type,
            consumedAt: entry.consumed_at,
            consumedDate: entry.consumed_date,
            consumptionLogId: entry.id,
          },
          access.allowed
        );
      } catch (hookError) {
        console.error('[consumption] on-time celebration hook failed:', hookError);
      }
    }

    return NextResponse.json({ ...entry, celebration }, { status: 201 });
  } catch (error) {
    console.error('Error logging consumption:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Unauthorized' ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
