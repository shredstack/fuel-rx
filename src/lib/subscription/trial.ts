/**
 * Free-Tier Trial Window (pure logic)
 *
 * Free users get full AI features for the first 7 days after signup, then they
 * are locked out. This replaces the old carve-out that granted AI access while
 * `free_plans_used < free_plan_limit` — that counted meal plans rather than
 * time, so a free user who never generated a plan kept AI features forever.
 *
 * The 1 lifetime free meal plan is NOT part of this window: it is enforced
 * separately by `/api/generate-meal-plan` and stays redeemable after the trial
 * ends.
 *
 * This module is deliberately dependency-free so the date math can be tested in
 * isolation. Signup-date lookup lives in `trial-server.ts`.
 */

export const TRIAL_DURATION_DAYS = 7;

const MS_PER_DAY = 86_400_000;

export interface TrialState {
  /** True while the user is still inside the 7-day post-signup window. */
  isInTrial: boolean;
  /** Full days left in the trial, counting today. 0 once expired/unknown. */
  trialDaysRemaining: number;
  /** End of the trial (exclusive), as an ISO string. Null if signup is unknown. */
  trialEndsAt: string | null;
}

export const EXPIRED_TRIAL: TrialState = {
  isInTrial: false,
  trialDaysRemaining: 0,
  trialEndsAt: null,
};

/**
 * Midnight-UTC day index for a date. Using a single UTC boundary keeps the
 * server's access decision and the client's "X days left" copy consistent no
 * matter which timezone either one is in.
 */
function utcDayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

/**
 * Compute trial state from a signup date.
 *
 * The window runs from the UTC day of signup through the end of the 7th UTC
 * day, so a user who signs up at any time on day 0 has 7 full days remaining
 * and loses access at 00:00 UTC on day 7.
 *
 * A null/invalid signup date yields "no trial" — callers must not fail open
 * here, or they would restore the unlimited-free-AI hole this closes.
 *
 * @param signupDate - The user's true signup date, or null if unknown
 * @param now - Current time (injectable for testing)
 */
export function computeTrialState(signupDate: Date | null, now: Date = new Date()): TrialState {
  if (!signupDate || Number.isNaN(signupDate.getTime())) {
    return EXPIRED_TRIAL;
  }

  const signupDay = utcDayIndex(signupDate);
  const daysElapsed = utcDayIndex(now) - signupDay;

  // Clamp so clock skew / future-dated rows can't extend the trial.
  const trialDaysRemaining = Math.max(
    0,
    Math.min(TRIAL_DURATION_DAYS, TRIAL_DURATION_DAYS - daysElapsed)
  );

  return {
    isInTrial: trialDaysRemaining > 0,
    trialDaysRemaining,
    trialEndsAt: new Date((signupDay + TRIAL_DURATION_DAYS) * MS_PER_DAY).toISOString(),
  };
}
