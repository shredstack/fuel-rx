import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMonthlyConsumption } from '@/lib/consumption-service';

/**
 * GET /api/consumption/monthly?year=2026&month=1
 *
 * Get monthly consumption summary for the specified month.
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
  const yearStr = searchParams.get('year');
  const monthStr = searchParams.get('month');

  if (!yearStr || !monthStr) {
    return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
  }

  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  const todayStr = searchParams.get('today') || undefined;

  try {
    const summary = await getMonthlyConsumption(user.id, year, month, todayStr);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching monthly consumption:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly consumption' },
      { status: 500 }
    );
  }
}
