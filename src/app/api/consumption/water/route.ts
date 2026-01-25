/**
 * Water Tracking API Endpoint
 *
 * GET /api/consumption/water?date=YYYY-MM-DD - Get water progress for a date
 * POST /api/consumption/water - Add water intake
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWaterProgress, addWater } from '@/lib/consumption-service';

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
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Missing required parameter: date' }, { status: 400 });
    }

    const waterProgress = await getWaterProgress(user.id, date);
    return NextResponse.json(waterProgress);
  } catch (error) {
    console.error('Error fetching water progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { date, ounces } = body;

    if (!date || typeof ounces !== 'number') {
      return NextResponse.json({ error: 'Missing required fields: date, ounces' }, { status: 400 });
    }

    if (ounces <= 0) {
      return NextResponse.json({ error: 'Ounces must be a positive number' }, { status: 400 });
    }

    const waterProgress = await addWater(user.id, date, ounces);
    return NextResponse.json(waterProgress);
  } catch (error) {
    console.error('Error adding water:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
