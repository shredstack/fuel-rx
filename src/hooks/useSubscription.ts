'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SubscriptionStatusResponse } from '@/lib/types';
import {
  isRevenueCatAvailable,
  isRevenueCatInitialized,
  initializeRevenueCat,
  presentPaywall,
  restorePurchases,
} from '@/lib/revenuecat';
import { createClient } from '@/lib/supabase/client';

interface UseSubscriptionReturn {
  // Subscription status
  status: SubscriptionStatusResponse | null;
  loading: boolean;
  error: string | null;

  // Computed helpers
  isSubscribed: boolean;
  canGeneratePlan: boolean;
  canUseAiFeatures: boolean;
  hasMealPlanGeneration: boolean;
  freePlansRemaining: number;
  isOverride: boolean;

  // Actions
  refresh: () => Promise<void>;
  showPaywall: () => Promise<{ success: boolean; purchased?: boolean; cancelled?: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; error?: string }>;

  // Platform check
  canPurchase: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);

  // Initialize RevenueCat when hook mounts (if on native platform)
  useEffect(() => {
    async function initRevenueCat() {
      // Only initialize on native platforms and if not already initialized
      if (!isRevenueCatAvailable() || isRevenueCatInitialized() || initializingRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          await initializeRevenueCat(user.id);
        }
      } catch (err) {
        console.error('[useSubscription] Failed to initialize RevenueCat:', err);
      } finally {
        initializingRef.current = false;
      }
    }

    initRevenueCat();
  }, []);

  // Fetch subscription status from API
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscription/status');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const data: SubscriptionStatusResponse = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Show the RevenueCat native paywall
  const showPaywall = useCallback(async () => {
    const result = await presentPaywall();

    // Refresh status after paywall closes (successful purchase or not)
    // The webhook will update the database
    if (result.purchased) {
      // Wait a short time for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchStatus();
    }

    return result;
  }, [fetchStatus]);

  // Restore previous purchases
  const restore = useCallback(async () => {
    const result = await restorePurchases();

    if (result.success) {
      // Wait for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchStatus();
    }

    return result;
  }, [fetchStatus]);

  // Computed values
  const isSubscribed = status?.isSubscribed ?? false;
  const canGeneratePlan = status?.canGeneratePlan ?? true;
  const canUseAiFeatures = status?.canUseAiFeatures ?? false;
  const hasMealPlanGeneration = status?.hasMealPlanGeneration ?? false;
  const freePlansRemaining = status?.freePlansRemaining ?? 3;
  const isOverride = status?.isOverride ?? false;
  const canPurchase = isRevenueCatAvailable();

  return {
    status,
    loading,
    error,
    isSubscribed,
    canGeneratePlan,
    canUseAiFeatures,
    hasMealPlanGeneration,
    freePlansRemaining,
    isOverride,
    refresh: fetchStatus,
    showPaywall,
    restore,
    canPurchase,
  };
}
