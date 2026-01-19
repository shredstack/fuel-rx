/**
 * Previous Entries by Meal Type API Endpoint
 *
 * GET /api/consumption/previous-by-meal-type
 *
 * Returns the most recent entries for each meal type, looking back up to a specified number of days.
 * Used for "Log same as yesterday" feature per meal type section.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPreviousEntriesByMealType } from '@/lib/consumption-service';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '7', 10);

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const previousEntries = await getPreviousEntriesByMealType(user.id, date, lookbackDays);

    return NextResponse.json(previousEntries);
  } catch (error) {
    console.error('Error fetching previous entries by meal type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
