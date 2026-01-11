/**
 * Daily Consumption Summary API
 *
 * GET /api/consumption/daily?date=2026-01-08
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDailyConsumption } from '@/lib/consumption-service';

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
    const dateParam = searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : new Date();

    const summary = await getDailyConsumption(user.id, date);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching daily consumption:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
