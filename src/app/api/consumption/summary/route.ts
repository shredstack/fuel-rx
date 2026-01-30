import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConsumptionSummary } from '@/lib/consumption-service';

/**
 * GET /api/consumption/summary
 *
 * Get rolling-year weekly averages for macros, fruit/veg, and water.
 * Used by the Summary tab on the log-meal page.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await getConsumptionSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching consumption summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consumption summary' },
      { status: 500 }
    );
  }
}
