/**
 * Free-Tier Trial Window (server-side signup lookup)
 *
 * Resolves a user's true signup date and turns it into a `TrialState`.
 * The date math itself lives in `trial.ts` (dependency-free / testable).
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeTrialState, type TrialState } from './trial';

/**
 * Look up a user's true signup date.
 *
 * Source of truth is `auth.users.created_at`. Deliberately NOT
 * `user_subscriptions.created_at` — that column was backfilled for existing
 * users when the subscriptions table shipped in Jan 2026, so it would hand
 * every legacy free user a fresh 7-day trial.
 *
 * Returns null when it can't be determined; callers treat that as "no trial".
 */
export async function getSignupDate(userId: string): Promise<Date | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (!error && data?.user?.created_at) {
    return new Date(data.user.created_at);
  }

  // Fallback: user_profiles rows are written by the on_auth_user_created
  // trigger, so created_at matches signup. The trigger swallows errors, so a
  // profile can in rare cases be created later — hence auth.users first.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  return profile?.created_at ? new Date(profile.created_at) : null;
}

/**
 * Resolve the trial state for a user from their signup date.
 */
export async function getTrialState(userId: string, now: Date = new Date()): Promise<TrialState> {
  return computeTrialState(await getSignupDate(userId), now);
}
