/**
 * Meal On-Time Celebrations API
 *
 * GET /api/meal-on-time-celebrations?date=YYYY-MM-DD
 *   Returns the user's celebration rows for the given local date (defaults to
 *   today). Used by the consumption screen to render the 🎉 badge on each
 *   celebrated meal section.
 *
 * No PUT / DELETE — celebrations are immutable. The only writer is the
 * server-side hook on POST /api/consumption.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MealOnTimeCelebration } from '@/lib/meal-reminders/types';

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayLocalDate();

  const { data, error } = await supabase
    .from('meal_on_time_celebrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('celebration_date', date)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[meal-on-time-celebrations] fetch failed:', error);
    return NextResponse.json({ error: 'Failed to load celebrations' }, { status: 500 });
  }

  return NextResponse.json({
    date,
    celebrations: (data ?? []) as MealOnTimeCelebration[],
  });
}
