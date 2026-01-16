/**
 * AI Feature Access Check Utility
 *
 * Checks if a user has access to AI features based on their subscription status.
 * Used by all AI-powered endpoints (cooking assistant, meal photo analysis, quick cook, prep mode).
 *
 * Access is granted if:
 * 1. User has override (friends/testers) - unlimited access
 * 2. User has subscription with AI features (Basic or Pro) - unlimited access
 * 3. User is on free tier with remaining free plans - limited access
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface AiAccessResult {
  allowed: boolean;
  reason?: 'AI_FEATURES_LOCKED';
  isOverride?: boolean;
  isFreeTier?: boolean;
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
    .select('is_override, has_ai_features, free_plans_used, free_plan_limit')
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

  // Free tier users can access AI features while they have free plans remaining
  const freePlansUsed = subscription?.free_plans_used ?? 0;
  const freePlanLimit = subscription?.free_plan_limit ?? 2;
  const hasFreePlansRemaining = freePlansUsed < freePlanLimit;

  if (hasFreePlansRemaining) {
    return { allowed: true, isFreeTier: true };
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
      message: 'Subscribe to Basic or Pro to unlock AI features',
    },
    { status: 402 }
  );
}
