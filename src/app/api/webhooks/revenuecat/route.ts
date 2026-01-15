import { createServiceRoleClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import type { SubscriptionTier, SubscriptionStatus } from '@/lib/types';

// RevenueCat webhook event types
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'TRANSFER';

interface RevenueCatEntitlement {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  purchase_date: string;
  original_purchase_date: string;
  product_identifier: string;
  is_sandbox: boolean;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
}

interface RevenueCatSubscriberInfo {
  original_app_user_id: string;
  entitlements: {
    [key: string]: RevenueCatEntitlement;
  };
}

interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: RevenueCatEventType;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    entitlement_id: string | null;
    entitlement_ids: string[] | null;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: 'SANDBOX' | 'PRODUCTION';
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    is_family_share: boolean;
    subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
  };
  subscriber_info?: RevenueCatSubscriberInfo;
}

/**
 * Verify RevenueCat webhook signature using Bearer token authentication
 */
function verifyWebhookAuth(authHeader: string | null): boolean {
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('REVENUECAT_WEBHOOK_SECRET not configured');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(webhookSecret)
    );
  } catch {
    return false;
  }
}

/**
 * Determine subscription tier from product identifier
 * Maps RevenueCat product IDs to our tier system:
 * - basic_yearly: $5.99/year - AI features only
 * - pro_monthly: $3.99/month - All features
 * - pro_yearly: $39.99/year - All features
 */
function getTierFromProductId(productId: string): SubscriptionTier | null {
  const lowerProductId = productId.toLowerCase();

  // Check for basic tier first (AI only, no meal plan generation)
  if (lowerProductId.includes('basic')) {
    return 'basic_yearly';
  }

  // Pro tiers (full access including meal plan generation)
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

  // Basic tier: AI features only
  if (tier === 'basic_yearly') {
    return { hasAiFeatures: true, hasMealPlanGeneration: false };
  }

  // Pro tiers: Full access
  return { hasAiFeatures: true, hasMealPlanGeneration: true };
}

/**
 * Determine subscription status from entitlement data
 */
function getSubscriptionStatus(
  isActive: boolean,
  entitlement: RevenueCatEntitlement | null
): SubscriptionStatus {
  if (!isActive || !entitlement) return 'expired';

  if (entitlement.billing_issues_detected_at) return 'billing_retry';
  if (entitlement.grace_period_expires_date) return 'grace_period';
  if (entitlement.unsubscribe_detected_at) return 'cancelled';

  return 'active';
}

export async function POST(request: Request) {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  // Verify webhook authentication
  if (!verifyWebhookAuth(authHeader)) {
    console.error('RevenueCat webhook: Invalid authorization');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let webhookData: RevenueCatWebhookEvent;
  try {
    webhookData = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = webhookData.event;
  const subscriberInfo = webhookData.subscriber_info;

  // Extract user ID - RevenueCat app_user_id should be set to Supabase user.id
  const userId = event.app_user_id;
  if (!userId) {
    console.error('RevenueCat webhook: Missing app_user_id');
    return Response.json({ error: 'Missing user ID' }, { status: 400 });
  }

  // Skip sandbox events in production (optional - you might want to process them)
  if (event.environment === 'SANDBOX' && process.env.NODE_ENV === 'production') {
    console.log('RevenueCat webhook: Skipping sandbox event in production');
    return Response.json({ success: true, skipped: true });
  }

  console.log(`RevenueCat webhook: Processing ${event.type} for user ${userId}`);

  // Get the FuelRx Pro entitlement from subscriber info
  const premiumEntitlement = subscriberInfo?.entitlements?.['FuelRx Pro'] || null;

  // Determine if subscription is active
  // An entitlement is active if it exists and hasn't expired
  const now = new Date();
  const expiresDate = premiumEntitlement?.expires_date
    ? new Date(premiumEntitlement.expires_date)
    : null;
  const isActive = premiumEntitlement !== null && (expiresDate === null || expiresDate > now);

  // Get tier from product identifier
  const tier = getTierFromProductId(event.product_id);

  // Get detailed status
  const status = getSubscriptionStatus(isActive, premiumEntitlement);

  // Get feature access based on tier
  const { hasAiFeatures, hasMealPlanGeneration } = getFeatureAccess(tier, isActive);

  // Prepare upsert data
  const subscriptionData = {
    user_id: userId,
    revenuecat_customer_id: subscriberInfo?.original_app_user_id || event.original_app_user_id,
    is_subscribed: isActive,
    subscription_tier: isActive ? tier : null,
    subscription_status: status,
    has_ai_features: hasAiFeatures,
    has_meal_plan_generation: hasMealPlanGeneration,
    current_period_start: premiumEntitlement?.purchase_date || null,
    current_period_end: premiumEntitlement?.expires_date || null,
    original_purchase_date: premiumEntitlement?.original_purchase_date || null,
    last_synced_at: new Date().toISOString(),
  };

  // Upsert subscription record
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(subscriptionData, { onConflict: 'user_id' });

  if (error) {
    console.error('RevenueCat webhook: Failed to update subscription:', error);
    return Response.json({ error: 'Database update failed' }, { status: 500 });
  }

  console.log(`RevenueCat webhook: Successfully updated subscription for user ${userId}`, {
    isActive,
    tier,
    status,
  });

  return Response.json({ success: true });
}
