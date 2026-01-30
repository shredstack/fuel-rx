import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWeeklyConsumptionByDateStr } from '@/lib/consumption-service';

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

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  const todayStr = searchParams.get('today') || undefined;

  try {
    // Use timezone-safe function that works with date strings directly
    const summary = await getWeeklyConsumptionByDateStr(user.id, dateStr, todayStr);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching weekly consumption:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly consumption' },
      { status: 500 }
    );
  }
}
