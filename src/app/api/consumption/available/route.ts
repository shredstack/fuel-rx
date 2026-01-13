/**
 * Available Meals to Log API
 *
 * GET /api/consumption/available?date=2026-01-08
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAvailableMealsToLogByDateStr } from '@/lib/consumption-service';

// Helper to get today's date string in a consistent format
function getTodayDateString(): string {
  // Use UTC to avoid server timezone issues
  // The client should always pass the date explicitly
  return new Date().toISOString().split('T')[0];
}

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
    // Use the date string directly without converting to Date object
    const dateStr = searchParams.get('date') || getTodayDateString();

    const available = await getAvailableMealsToLogByDateStr(user.id, dateStr);

    return NextResponse.json(available);
  } catch (error) {
    console.error('Error fetching available meals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
