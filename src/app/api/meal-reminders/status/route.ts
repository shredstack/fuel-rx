/**
 * Meal Reminder Status API
 *
 * GET /api/meal-reminders/status?date=YYYY-MM-DD
 *
 * Returns per-meal status for the given local date so devices can reconcile
 * which notifications should still be active.
 *
 * A meal is `resolved` if either:
 *   - a meal_reminder_resolutions row exists for (user, date, meal_type), OR
 *   - a meal_consumption_log entry of that meal_type exists on that date
 *     (covers the case where a logged meal's resolution write was lost).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkReminderAccess } from '@/lib/subscription/check-reminder-access';
import { mergeWithDefaults } from '@/lib/meal-reminders/settings';
import {
  REMINDER_MEAL_TYPES,
  type MealReminderStatusMap,
  type ReminderStatus,
} from '@/lib/meal-reminders/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function allDisabled(): MealReminderStatusMap {
  return REMINDER_MEAL_TYPES.reduce((acc, m) => {
    acc[m] = 'disabled';
    return acc;
  }, {} as MealReminderStatusMap);
}

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
  const date = searchParams.get('date');
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: 'A valid ?date=YYYY-MM-DD query parameter is required' },
      { status: 400 }
    );
  }

  // Non-subscribers can't have active reminders — short-circuit to all-disabled.
  const access = await checkReminderAccess(user.id);
  if (!access.allowed) {
    return NextResponse.json({ status: allDisabled() });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('meal_reminder_settings')
    .eq('id', user.id)
    .single();
  const settings = mergeWithDefaults(profile?.meal_reminder_settings);

  // Resolutions explicitly recorded for this date.
  const { data: resolutions } = await supabase
    .from('meal_reminder_resolutions')
    .select('meal_type')
    .eq('user_id', user.id)
    .eq('reminder_date', date);

  // Logged meals of a reminder meal_type on this date (resolution fallback).
  const { data: loggedMeals } = await supabase
    .from('meal_consumption_log')
    .select('meal_type')
    .eq('user_id', user.id)
    .eq('consumed_date', date)
    .in('meal_type', REMINDER_MEAL_TYPES);

  const resolvedMeals = new Set<string>([
    ...(resolutions ?? []).map((r) => r.meal_type as string),
    ...(loggedMeals ?? []).map((m) => m.meal_type as string),
  ]);

  const status = REMINDER_MEAL_TYPES.reduce((acc, mealType) => {
    let value: ReminderStatus;
    if (!settings[mealType].enabled) {
      value = 'disabled';
    } else if (resolvedMeals.has(mealType)) {
      value = 'resolved';
    } else {
      value = 'pending';
    }
    acc[mealType] = value;
    return acc;
  }, {} as MealReminderStatusMap);

  return NextResponse.json({ status });
}
