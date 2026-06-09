import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMonthlyConsumption } from '@/lib/consumption-service';

/**
 * GET /api/consumption/monthly?date=YYYY-MM-DD
 *
 * Get the rolling 31-day consumption summary ending at the given date.
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
    const summary = await getMonthlyConsumption(user.id, dateStr, todayStr);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching monthly consumption:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly consumption' },
      { status: 500 }
    );
  }
}
