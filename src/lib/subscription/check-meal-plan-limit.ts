/**
 * Meal Plan Generation Rate Limit Check
 *
 * Checks if a Pro/VIP user has exceeded their rolling 7-day meal plan limit.
 * This does NOT apply to free tier users (they use lifetime free_plans_used counter).
 * This does NOT apply to AI features (Cooking Assistant, Snap-a-Meal, etc.).
 *
 * Supports per-user override via weekly_plan_limit_override column.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { PRO_WEEKLY_PLAN_LIMIT, ROLLING_WINDOW_MS } from '@/lib/constants/rate-limits';

export interface MealPlanLimitResult {
  allowed: boolean;
  reason?: 'WEEKLY_LIMIT_REACHED';
  plansUsedThisWeek: number;
  plansRemaining: number;
  limit: number;
  // Whether this user has a custom limit override
  hasOverride: boolean;
  // When the oldest plan in the window expires, freeing up a slot
  nextSlotAvailableAt: Date | null;
  // The creation times of plans in the current window (for UI display)
  recentPlanDates: Date[];
}

/**
 * Check if a Pro/VIP user can generate another meal plan
 *
 * @param userId - The user's ID
 * @returns Object with limit status and metadata
 */
export async function checkMealPlanLimit(userId: string): Promise<MealPlanLimitResult> {
  const supabase = createServiceRoleClient();

  // Fetch the user's limit override (if any)
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('weekly_plan_limit_override')
    .eq('user_id', userId)
    .single();

  // Use override if set, otherwise use default
  const effectiveLimit = subscription?.weekly_plan_limit_override ?? PRO_WEEKLY_PLAN_LIMIT;
  const hasOverride = subscription?.weekly_plan_limit_override != null;

  const windowStart = new Date(Date.now() - ROLLING_WINDOW_MS);

  // Get all meal plans created in the rolling window, ordered by creation time
  const { data: recentPlans, error } = await supabase
    .from('meal_plans')
    .select('id, created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error checking meal plan limit:', error);
    // Fail open - allow generation if we can't check
    return {
      allowed: true,
      plansUsedThisWeek: 0,
      plansRemaining: effectiveLimit,
      limit: effectiveLimit,
      hasOverride,
      nextSlotAvailableAt: null,
      recentPlanDates: [],
    };
  }

  const plansUsedThisWeek = recentPlans?.length ?? 0;
  const plansRemaining = Math.max(0, effectiveLimit - plansUsedThisWeek);
  const recentPlanDates = (recentPlans ?? []).map(p => new Date(p.created_at));

  // Calculate when the next slot becomes available
  let nextSlotAvailableAt: Date | null = null;
  if (plansUsedThisWeek >= effectiveLimit && recentPlans && recentPlans.length > 0) {
    // The oldest plan will "expire" from the window 7 days after it was created
    const oldestPlanDate = new Date(recentPlans[0].created_at);
    nextSlotAvailableAt = new Date(oldestPlanDate.getTime() + ROLLING_WINDOW_MS);
  }

  if (plansUsedThisWeek >= effectiveLimit) {
    return {
      allowed: false,
      reason: 'WEEKLY_LIMIT_REACHED',
      plansUsedThisWeek,
      plansRemaining: 0,
      limit: effectiveLimit,
      hasOverride,
      nextSlotAvailableAt,
      recentPlanDates,
    };
  }

  return {
    allowed: true,
    plansUsedThisWeek,
    plansRemaining,
    limit: effectiveLimit,
    hasOverride,
    nextSlotAvailableAt,
    recentPlanDates,
  };
}

/**
 * Format the next available time for display
 * @param nextSlotAvailableAt - The date when the next slot becomes available
 * @returns Human-readable string like "in 2 days" or "tomorrow at 3:00 PM"
 */
export function formatNextAvailableTime(nextSlotAvailableAt: Date): string {
  const now = new Date();
  const diffMs = nextSlotAvailableAt.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return 'in less than an hour';
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else {
    return `in ${diffDays} days`;
  }
}
