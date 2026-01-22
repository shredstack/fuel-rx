import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SubscriptionTier, SubscriptionStatus } from '@/lib/types';

/**
 * RevenueCat REST API response types
 */
interface RevenueCatSubscription {
  expires_date: string | null;
  purchase_date: string;
  original_purchase_date: string;
  product_identifier: string;
  is_sandbox: boolean;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
  grace_period_expires_date: string | null;
  refunded_at: string | null;
  auto_resume_date: string | null;
}

interface RevenueCatEntitlement {
  expires_date: string | null;
  product_identifier: string;
  purchase_date: string;
}

interface RevenueCatSubscriberResponse {
  request_date: string;
  request_date_ms: number;
  subscriber: {
    entitlements: {
      [key: string]: RevenueCatEntitlement;
    };
    first_seen: string;
    original_app_user_id: string;
    subscriptions: {
      [key: string]: RevenueCatSubscription;
    };
  };
}

/**
 * Determine subscription tier from product identifier
 */
function getTierFromProductId(productId: string): SubscriptionTier | null {
  const lowerProductId = productId.toLowerCase();

  if (lowerProductId.includes('basic')) {
    return 'basic_yearly';
  }

  if (lowerProductId.includes('pro_monthly') || lowerProductId.includes('monthly')) {
    return 'pro_monthly';
  }
  if (lowerProductId.includes('pro_yearly') || lowerProductId.includes('yearly') || lowerProductId.includes('annual')) {
    return 'pro_yearly';
  }

  return null;
}

/**
 * Get feature access flags based on subscription tier
 */
function getFeatureAccess(tier: SubscriptionTier | null, isActive: boolean): {
  hasAiFeatures: boolean;
  hasMealPlanGeneration: boolean;
} {
  if (!isActive || !tier) {
    return { hasAiFeatures: false, hasMealPlanGeneration: false };
  }

  if (tier === 'basic_yearly') {
    return { hasAiFeatures: true, hasMealPlanGeneration: false };
  }

  return { hasAiFeatures: true, hasMealPlanGeneration: true };
}

/**
 * POST /api/subscription/sync
 *
 * Manually syncs subscription status from RevenueCat.
 * This is useful when the webhook fails or for troubleshooting.
 *
 * Requires REVENUECAT_API_KEY environment variable to be set.
 */
export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.REVENUECAT_API_SECRET;
  if (!apiKey) {
    console.error('[Subscription Sync] REVENUECAT_API_SECRET not configured');
    return Response.json(
      { error: 'Subscription sync not available. Please try again later.' },
      { status: 503 }
    );
  }

  try {
    // Fetch subscriber info from RevenueCat REST API
    // The app_user_id is the Supabase user.id
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // User not found in RevenueCat - they haven't made any purchases
        console.log(`[Subscription Sync] User ${user.id} not found in RevenueCat`);
        return Response.json({
          synced: true,
          message: 'No subscription found',
          isSubscribed: false,
        });
      }

      const errorText = await response.text();
      console.error(`[Subscription Sync] RevenueCat API error: ${response.status}`, errorText);
      return Response.json(
        { error: 'Failed to fetch subscription status from payment provider' },
        { status: 502 }
      );
    }

    const data: RevenueCatSubscriberResponse = await response.json();
    const subscriber = data.subscriber;

    // Check if user has the FuelRx Pro entitlement
    const fuelRxProEntitlement = subscriber.entitlements['FuelRx Pro'];
    const now = new Date();

    let isActive = false;
    let tier: SubscriptionTier | null = null;
    let status: SubscriptionStatus = 'expired';
    let currentPeriodEnd: string | null = null;
    let currentPeriodStart: string | null = null;
    let originalPurchaseDate: string | null = null;

    if (fuelRxProEntitlement) {
      const expiresDate = fuelRxProEntitlement.expires_date
        ? new Date(fuelRxProEntitlement.expires_date)
        : null;

      isActive = expiresDate === null || expiresDate > now;
      tier = getTierFromProductId(fuelRxProEntitlement.product_identifier);
      currentPeriodEnd = fuelRxProEntitlement.expires_date;
      currentPeriodStart = fuelRxProEntitlement.purchase_date;

      // Get more details from the subscription object
      const subscription = subscriber.subscriptions[fuelRxProEntitlement.product_identifier];
      if (subscription) {
        originalPurchaseDate = subscription.original_purchase_date;

        if (subscription.billing_issues_detected_at) {
          status = 'billing_retry';
        } else if (subscription.grace_period_expires_date) {
          status = 'grace_period';
        } else if (subscription.unsubscribe_detected_at) {
          status = isActive ? 'cancelled' : 'expired';
        } else if (isActive) {
          status = 'active';
        } else {
          status = 'expired';
        }
      } else if (isActive) {
        status = 'active';
      }
    }

    // Get feature access
    const { hasAiFeatures, hasMealPlanGeneration } = getFeatureAccess(tier, isActive);

    // Update the database using service role client
    const serviceClient = createServiceRoleClient();
    const { error: updateError } = await serviceClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        revenuecat_customer_id: subscriber.original_app_user_id,
        is_subscribed: isActive,
        subscription_tier: isActive ? tier : null,
        subscription_status: status,
        has_ai_features: hasAiFeatures,
        has_meal_plan_generation: hasMealPlanGeneration,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        original_purchase_date: originalPurchaseDate,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[Subscription Sync] Database update failed:', updateError);
      return Response.json(
        { error: 'Failed to update subscription status' },
        { status: 500 }
      );
    }

    console.log(`[Subscription Sync] Successfully synced subscription for user ${user.id}`, {
      isActive,
      tier,
      status,
    });

    return Response.json({
      synced: true,
      isSubscribed: isActive,
      subscriptionTier: tier,
      subscriptionStatus: status,
      currentPeriodEnd,
      hasAiFeatures,
      hasMealPlanGeneration,
    });
  } catch (error) {
    console.error('[Subscription Sync] Unexpected error:', error);
    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
