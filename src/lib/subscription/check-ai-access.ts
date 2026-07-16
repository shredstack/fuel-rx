/**
 * AI Feature Access Check Utility
 *
 * Checks if a user has access to AI features based on their subscription status.
 * Used by all AI-powered endpoints (cooking assistant, meal photo analysis, quick cook, prep mode).
 *
 * Access is granted if:
 * 1. User has override (friends/testers) - unlimited access
 * 2. User has subscription with AI features (Basic or Pro) - unlimited access
 * 3. User is within the 7-day post-signup trial - full access, then locked
 *
 * Note this is decoupled from the free meal plan allowance: a free user keeps
 * their 1 lifetime free plan (enforced in /api/generate-meal-plan) after the
 * trial expires, they just lose the AI logging features.
 *
 * Food photo validation and ingredient category detection are intentionally NOT
 * gated by this check — they keep the ingredient database clean and are cheap
 * Haiku calls (~$0.001).
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { getTrialState } from './trial-server';
import { TRIAL_DURATION_DAYS } from './trial';

export interface AiAccessResult {
  allowed: boolean;
  reason?: 'AI_FEATURES_LOCKED';
  isOverride?: boolean;
  /** True when access is granted by the 7-day trial rather than a subscription. */
  isTrial?: boolean;
  /** Full days left in the trial, counting today. Only set when isTrial. */
  trialDaysRemaining?: number;
}

/**
 * Check if a user has access to AI features
 *
 * @param userId - The user's ID
 * @returns Object indicating whether access is allowed and the reason if not
 */
export async function checkAiAccess(userId: string): Promise<AiAccessResult> {
  const supabase = createServiceRoleClient();

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('is_override, has_ai_features')
    .eq('user_id', userId)
    .single();

  // Override users always have access
  if (subscription?.is_override) {
    return { allowed: true, isOverride: true };
  }

  // Check if user has AI features (Basic or Pro subscription)
  if (subscription?.has_ai_features) {
    return { allowed: true };
  }

  // Free tier: full AI access for the first 7 days after signup, then locked.
  const trial = await getTrialState(userId);
  if (trial.isInTrial) {
    return {
      allowed: true,
      isTrial: true,
      trialDaysRemaining: trial.trialDaysRemaining,
    };
  }

  return {
    allowed: false,
    reason: 'AI_FEATURES_LOCKED',
  };
}

/**
 * Create a 402 Payment Required response for AI feature access denial
 */
export function createAiAccessDeniedResponse() {
  return Response.json(
    {
      error: 'AI_FEATURES_LOCKED',
      message: `Your ${TRIAL_DURATION_DAYS}-day free trial has ended. Subscribe to Basic or Pro to unlock AI features.`,
    },
    { status: 402 }
  );
}
