'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  UserOnboardingState,
  OnboardingTipId,
  FeatureDiscoveryId,
  OnboardingMilestone,
} from '@/lib/types';

interface UseOnboardingStateReturn {
  state: UserOnboardingState | null;
  loading: boolean;
  error: string | null;

  // Milestone actions
  markMilestone: (milestone: OnboardingMilestone) => Promise<void>;

  // Tip actions
  dismissTip: (tipId: OnboardingTipId) => Promise<void>;
  isTipDismissed: (tipId: OnboardingTipId) => boolean;
  shouldShowTip: (tipId: OnboardingTipId) => boolean;

  // Feature discovery actions
  discoverFeature: (featureId: FeatureDiscoveryId) => Promise<void>;
  isFeatureDiscovered: (featureId: FeatureDiscoveryId) => boolean;

  // Tour actions
  advanceTourStep: () => Promise<void>;
  completeTour: () => Promise<void>;
  skipTour: () => Promise<void>;
  replayTutorial: () => Promise<void>;

  // Tour state helpers
  shouldShowTour: boolean;
  currentTourStep: number;

  // Refresh
  refresh: () => Promise<void>;
}

export function useOnboardingState(): UseOnboardingStateReturn {
  const [state, setState] = useState<UserOnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch onboarding state
  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/onboarding/state');
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding state');
      }

      const data = await response.json();
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Update helper
  const updateState = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/onboarding/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update onboarding state');
      }

      const data = await response.json();
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      throw err;
    }
  }, []);

  // Mark milestone (only if not already marked)
  const markMilestone = useCallback(
    async (milestone: OnboardingMilestone) => {
      if (state?.[milestone]) return; // Already marked
      await updateState({ [milestone]: true });
    },
    [state, updateState]
  );

  // Dismiss tip
  const dismissTip = useCallback(
    async (tipId: OnboardingTipId) => {
      await updateState({ dismiss_tip: tipId });
    },
    [updateState]
  );

  // Check if tip is dismissed
  const isTipDismissed = useCallback(
    (tipId: OnboardingTipId) => {
      return state?.tips_dismissed?.includes(tipId) ?? false;
    },
    [state]
  );

  // Should show tip (not dismissed and first plan viewed)
  const shouldShowTip = useCallback(
    (tipId: OnboardingTipId) => {
      if (!state) return false;
      if (isTipDismissed(tipId)) return false;
      // Only show tips after first plan is viewed
      if (!state.first_plan_viewed) return false;
      return true;
    },
    [state, isTipDismissed]
  );

  // Discover feature
  const discoverFeature = useCallback(
    async (featureId: FeatureDiscoveryId) => {
      if (state?.features_discovered?.includes(featureId)) return;
      await updateState({ discover_feature: featureId });
    },
    [state, updateState]
  );

  // Check if feature is discovered
  const isFeatureDiscovered = useCallback(
    (featureId: FeatureDiscoveryId) => {
      return state?.features_discovered?.includes(featureId) ?? false;
    },
    [state]
  );

  // Tour actions
  const advanceTourStep = useCallback(async () => {
    const nextStep = (state?.first_plan_tour_current_step ?? 0) + 1;
    await updateState({ first_plan_tour_current_step: nextStep });
  }, [state, updateState]);

  const completeTour = useCallback(async () => {
    await updateState({ first_plan_tour_completed: true });
  }, [updateState]);

  const skipTour = useCallback(async () => {
    await updateState({ first_plan_tour_skipped: true, first_plan_tour_completed: true });
  }, [updateState]);

  const replayTutorial = useCallback(async () => {
    await updateState({ replay_tutorial: true });
  }, [updateState]);

  // Computed tour state
  const shouldShowTour =
    state !== null &&
    state.first_plan_viewed &&
    !state.first_plan_tour_completed &&
    !state.first_plan_tour_skipped;

  const currentTourStep = state?.first_plan_tour_current_step ?? 0;

  return {
    state,
    loading,
    error,
    markMilestone,
    dismissTip,
    isTipDismissed,
    shouldShowTip,
    discoverFeature,
    isFeatureDiscovered,
    advanceTourStep,
    completeTour,
    skipTour,
    replayTutorial,
    shouldShowTour,
    currentTourStep,
    refresh: fetchState,
  };
}
