import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWeeklyConsumption } from '@/lib/consumption-service';

/**
 * GET /api/consumption/weekly?date=YYYY-MM-DD
 *
 * Get weekly consumption summary for the week containing the given date.
 */
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
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const summary = await getWeeklyConsumption(user.id, date);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching weekly consumption:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly consumption' },
      { status: 500 }
    );
  }
}
