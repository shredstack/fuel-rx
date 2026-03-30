/**
 * HealthKit Sync Status API Endpoint
 *
 * PATCH /api/consumption/[id]/healthkit - Update HealthKit sync status for a consumption entry
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { healthkit_synced, healthkit_sample_ids, healthkit_synced_at } = body;

    if (typeof healthkit_synced !== 'boolean') {
      return NextResponse.json(
        { error: 'healthkit_synced (boolean) is required' },
        { status: 400 }
      );
    }

    // Update the entry, ensuring the caller owns it
    const { data, error } = await supabase
      .from('meal_consumption_log')
      .update({
        healthkit_synced,
        healthkit_sample_ids: healthkit_sample_ids || null,
        healthkit_synced_at: healthkit_synced_at || null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating HealthKit sync status:', error);
      return NextResponse.json(
        { error: 'Failed to update sync status' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in healthkit sync update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
