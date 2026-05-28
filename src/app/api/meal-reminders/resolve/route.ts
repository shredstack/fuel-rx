/**
 * Meal Reminder Resolve API
 *
 * POST /api/meal-reminders/resolve
 * Body: { meal_type, date, source, consumption_log_id?, food_journal_entry_id? }
 *
 * Idempotent (backed by the (user, date, meal_type) unique constraint).
 * Allowed for everyone — recording a resolution is cheap and defensive; if a
 * resolution somehow arrives for a non-subscriber, better to record it.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upsertResolution, isReminderMealType } from '@/lib/meal-reminders/resolution-service';
import { trackEvent } from '@/lib/analytics';
import type { ResolutionSource } from '@/lib/meal-reminders/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SOURCES: ResolutionSource[] = ['meal_logged', 'photo_snapped', 'manual_dismiss'];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    meal_type?: string;
    date?: string;
    source?: string;
    consumption_log_id?: string;
    food_journal_entry_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isReminderMealType(body.meal_type)) {
    return NextResponse.json(
      { error: 'meal_type must be one of breakfast, lunch, dinner, snack' },
      { status: 400 }
    );
  }
  if (!body.date || !DATE_RE.test(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  if (!body.source || !VALID_SOURCES.includes(body.source as ResolutionSource)) {
    return NextResponse.json(
      { error: 'source must be one of meal_logged, photo_snapped, manual_dismiss' },
      { status: 400 }
    );
  }

  try {
    const resolution = await upsertResolution(supabase, {
      userId: user.id,
      reminderDate: body.date,
      mealType: body.meal_type,
      source: body.source as ResolutionSource,
      consumptionLogId: body.consumption_log_id ?? null,
      foodJournalEntryId: body.food_journal_entry_id ?? null,
    });

    trackEvent('meal_reminder_resolved', {
      meal_type: body.meal_type,
      source: body.source,
    });

    return NextResponse.json({ resolution });
  } catch (error) {
    console.error('[meal-reminders/resolve] failed:', error);
    return NextResponse.json({ error: 'Failed to record resolution' }, { status: 500 });
  }
}
