/**
 * Meal Reminder Access Check
 *
 * Meal reminders are a paid, "always on" feature. Access is stricter than
 * `checkAiAccess()` — there is no free-tier carve-out, because a recurring
 * background feature can't be metered against a one-time free-plan credit.
 *
 * Access is granted to:
 *   1. Active subscribers with AI features (`has_ai_features = true`)
 *   2. VIP / override users (`is_override = true`)
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface ReminderAccessResult {
  allowed: boolean;
  reason?: 'REMINDERS_LOCKED';
  isOverride?: boolean;
}

/**
 * Check whether a user may enable / use meal reminders.
 */
export async function checkReminderAccess(userId: string): Promise<ReminderAccessResult> {
  const supabase = createServiceRoleClient();

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('is_override, has_ai_features')
    .eq('user_id', userId)
    .single();

  if (sub?.is_override) return { allowed: true, isOverride: true };
  if (sub?.has_ai_features) return { allowed: true };
  return { allowed: false, reason: 'REMINDERS_LOCKED' };
}

/**
 * Create a 402 Payment Required response for reminder access denial.
 */
export function createReminderAccessDeniedResponse() {
  return Response.json(
    { error: 'REMINDERS_LOCKED', message: 'Subscribe to unlock meal reminders' },
    { status: 402 }
  );
}
