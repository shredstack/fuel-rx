import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug endpoint for RevenueCat offerings
 * Logs are captured in Vercel logs for debugging subscription issues
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event, data } = body;

    // Log to Vercel logs
    console.log('[RevenueCat Debug API]', {
      userId: user.id,
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RevenueCat Debug API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
