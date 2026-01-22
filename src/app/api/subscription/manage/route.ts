import { createClient } from '@/lib/supabase/server';
import type { SubscriptionStore } from '@/lib/types';

interface RevenueCatSubscriberResponse {
  subscriber: {
    management_url: string | null;
    subscriptions: {
      [key: string]: {
        store: string;
      };
    };
  };
}

/**
 * GET /api/subscription/manage
 *
 * Returns the appropriate subscription management URL based on where
 * the user purchased their subscription:
 * - Stripe (web): Returns RevenueCat's Stripe Customer Portal URL
 * - App Store (iOS): Returns Apple's subscription management URL
 * - Play Store (Android): Returns Google Play's subscription management URL
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // First check the store from our database
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('store, is_subscribed')
    .eq('user_id', user.id)
    .single();

  if (!subscription?.is_subscribed) {
    return Response.json({ error: 'No active subscription' }, { status: 404 });
  }

  const store = subscription.store as SubscriptionStore | null;

  // For App Store subscriptions, return Apple's management URL directly
  if (store === 'APP_STORE') {
    return Response.json({
      managementUrl: 'https://apps.apple.com/account/subscriptions',
      store: 'APP_STORE',
    });
  }

  // For Play Store subscriptions, return Google's management URL
  if (store === 'PLAY_STORE') {
    return Response.json({
      managementUrl: 'https://play.google.com/store/account/subscriptions',
      store: 'PLAY_STORE',
    });
  }

  // For Stripe subscriptions (web purchases), fetch the management URL from RevenueCat
  // RevenueCat provides a Stripe Customer Portal URL for web subscribers
  if (store === 'STRIPE') {
    const apiKey = process.env.REVENUECAT_API_SECRET;
    if (!apiKey) {
      console.error('[Subscription Manage] REVENUECAT_API_SECRET not configured');
      return Response.json(
        { error: 'Subscription management not available' },
        { status: 503 }
      );
    }

    try {
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
        console.error(`[Subscription Manage] RevenueCat API error: ${response.status}`);
        return Response.json(
          { error: 'Failed to fetch management URL' },
          { status: 502 }
        );
      }

      const data: RevenueCatSubscriberResponse = await response.json();
      const managementUrl = data.subscriber.management_url;

      if (managementUrl) {
        return Response.json({
          managementUrl,
          store: 'STRIPE',
        });
      }

      // If no management URL from RevenueCat, provide a fallback message
      return Response.json({
        managementUrl: null,
        store: 'STRIPE',
        message: 'Please contact support to manage your subscription',
        supportEmail: 'shredstacksarah@gmail.com',
      });
    } catch (error) {
      console.error('[Subscription Manage] Error fetching from RevenueCat:', error);
      return Response.json(
        { error: 'Failed to fetch management URL' },
        { status: 500 }
      );
    }
  }

  // For promotional or unknown stores, direct to support
  return Response.json({
    managementUrl: null,
    store: store || 'UNKNOWN',
    message: 'Please contact support to manage your subscription',
    supportEmail: 'shredstacksarah@gmail.com',
  });
}
