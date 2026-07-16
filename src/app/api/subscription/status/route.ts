import { createClient } from '@/lib/supabase/server';
import { checkMealPlanLimit } from '@/lib/subscription/check-meal-plan-limit';
import { computeTrialState, EXPIRED_TRIAL } from '@/lib/subscription/trial';
import type { SubscriptionStatusResponse, SubscriptionTier, SubscriptionStore, MealPlanRateLimitStatus } from '@/lib/types';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .select(`
      is_subscribed,
      subscription_tier,
      subscription_status,
      current_period_end,
      store,
      has_ai_features,
      has_meal_plan_generation,
      free_plans_used,
      free_plan_limit,
      is_override
    `)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Failed to fetch subscription:', error);
    return Response.json({ error: 'Failed to fetch subscription status' }, { status: 500 });
  }

  // Calculate remaining free plans
  const freePlansUsed = subscription?.free_plans_used ?? 0;
  const freePlanLimit = subscription?.free_plan_limit ?? 1;
  const freePlansRemaining = Math.max(0, freePlanLimit - freePlansUsed);

  const isSubscribed = subscription?.is_subscribed ?? false;
  const isOverride = subscription?.is_override ?? false;
  const tier = subscription?.subscription_tier as SubscriptionTier | null;

  // Feature access based on tier or override
  // Override grants full access to everything
  const hasAiFeatures = isOverride || (subscription?.has_ai_features ?? false);
  const hasMealPlanGeneration = isOverride || (subscription?.has_meal_plan_generation ?? false);

  // Can generate meal plan if:
  // 1. Has override (friends/testers)
  // 2. Has Pro tier (pro_monthly or pro_yearly)
  // 3. Is free user with remaining free plans
  const canGeneratePlan = isOverride || hasMealPlanGeneration || freePlansRemaining > 0;

  // 7-day trial state for free users. Uses the auth user's created_at (the true
  // signup date) — NOT user_subscriptions.created_at, which was backfilled in
  // Jan 2026. Must mirror checkAiAccess()/trial.ts or the UI and the server
  // will disagree about who has access.
  const trial =
    isOverride || hasAiFeatures
      ? EXPIRED_TRIAL // Already have permanent access; "trial" is not meaningful.
      : computeTrialState(user.created_at ? new Date(user.created_at) : null);

  // Can use AI features if:
  // 1. Has override
  // 2. Has any active subscription (basic or pro)
  // 3. Is within the 7-day post-signup trial
  const canUseAiFeatures = isOverride || hasAiFeatures || trial.isInTrial;

  // For Pro/VIP users, include rate limit status
  let rateLimitStatus: MealPlanRateLimitStatus | null = null;
  if (isOverride || hasMealPlanGeneration) {
    const limitCheck = await checkMealPlanLimit(user.id);
    rateLimitStatus = {
      plansUsedThisWeek: limitCheck.plansUsedThisWeek,
      plansRemaining: limitCheck.plansRemaining,
      weeklyLimit: limitCheck.limit,
      nextSlotAvailableAt: limitCheck.nextSlotAvailableAt?.toISOString() ?? null,
    };
  }

  const response: SubscriptionStatusResponse = {
    isSubscribed,
    subscriptionTier: tier,
    subscriptionStatus: subscription?.subscription_status ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    store: (subscription?.store as SubscriptionStore) ?? null,
    hasAiFeatures,
    hasMealPlanGeneration,
    freePlansUsed,
    freePlanLimit,
    freePlansRemaining,
    canGeneratePlan,
    canUseAiFeatures,
    isInTrial: trial.isInTrial,
    trialDaysRemaining: trial.trialDaysRemaining,
    trialEndsAt: trial.trialEndsAt,
    isOverride,
    rateLimitStatus,
  };

  return Response.json(response);
}
