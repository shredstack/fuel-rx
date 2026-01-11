/**
 * Available Meals to Log API
 *
 * GET /api/consumption/available?date=2026-01-08
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAvailableMealsToLog } from '@/lib/consumption-service';

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

    const available = await getAvailableMealsToLog(user.id, date);

    return NextResponse.json(available);
  } catch (error) {
    console.error('Error fetching available meals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
