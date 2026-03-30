/**
 * HealthKit Sync Status API Endpoint
 *
 * GET /api/healthkit/status - Get sync statistics for the authenticated user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's sync preference
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('healthkit_nutrition_sync_enabled')
      .eq('id', user.id)
      .single();

    const enabled = profile?.healthkit_nutrition_sync_enabled ?? false;

    // Count synced entries (this month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: totalSynced } = await supabase
      .from('meal_consumption_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('healthkit_synced', true)
      .gte('healthkit_synced_at', monthStart);

    // Count pending (unsynced) entries
    const { count: pendingCount } = await supabase
      .from('meal_consumption_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('healthkit_synced', false);

    // Get last synced timestamp
    const { data: lastSynced } = await supabase
      .from('meal_consumption_log')
      .select('healthkit_synced_at')
      .eq('user_id', user.id)
      .eq('healthkit_synced', true)
      .order('healthkit_synced_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      enabled,
      permissionsGranted: true, // Can't check from server; client handles this
      totalSynced: totalSynced ?? 0,
      lastSyncedAt: lastSynced?.healthkit_synced_at ?? null,
      pendingCount: pendingCount ?? 0,
    });
  } catch (error) {
    console.error('Error fetching HealthKit sync status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
