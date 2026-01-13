/**
 * Celebrate Fruit/Veg Goal API Endpoint
 *
 * POST /api/consumption/celebrate-fruit-veg - Mark 800g goal as celebrated for a day
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json({ error: 'Missing required field: date' }, { status: 400 });
    }

    // Upsert celebration record
    const { error: upsertError } = await supabase
      .from('daily_fruit_veg_celebration')
      .upsert(
        {
          user_id: user.id,
          date,
          goal_celebrated: true,
          celebrated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,date',
        }
      );

    if (upsertError) {
      console.error('Error marking fruit/veg goal as celebrated:', upsertError);
      return NextResponse.json({ error: 'Failed to mark goal as celebrated' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in celebrate-fruit-veg endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
