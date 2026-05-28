'use client';

/**
 * App-level provider for the on-time meal celebration UX.
 *
 * Owns the in-app toast and exposes a `showCelebration()` function via context.
 * Also subscribes to Supabase Realtime on `meal_on_time_celebrations` so a
 * confetti burst on phone also fires on iPad — gated by a recent-fire ref so
 * the device that originated the log doesn't double-celebrate.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import {
  fireMealCelebration,
  type AppState,
  type CelebrationPayload,
} from '@/lib/celebrations/fire-meal-celebration';
import {
  isCelebrationMealType,
  type MealOnTimeCelebration,
} from '@/lib/meal-reminders/types';
import MealCelebrationToast from '@/components/celebrations/MealCelebrationToast';

interface CelebrationContextValue {
  /**
   * Fire confetti + the in-app toast. Call from mutation `onSuccess` when the
   * POST /api/consumption response carries a `celebration` payload.
   *
   * Pass the celebration's row `id` so cross-device realtime can deduplicate.
   */
  showCelebration: (
    celebration: MealOnTimeCelebration,
    appState?: AppState
  ) => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/** Hook to fire a celebration from anywhere in the tree. */
export function useCelebration(): CelebrationContextValue {
  const ctx = useContext(CelebrationContext);
  if (!ctx) {
    // Defensive: a missing provider returns a no-op so a mis-mount never
    // breaks a meal log.
    return {
      showCelebration: () => {
        console.warn('[CelebrationProvider] not mounted; ignoring showCelebration');
      },
    };
  }
  return ctx;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<MealOnTimeCelebration | null>(null);

  // Deduplicate the realtime echo against the local POST response. We keep a
  // small LRU of recently-handled celebration ids — a row id appears in here
  // either because we just received it from the mutation response, or because
  // realtime delivered it. Either way, the second observation is a no-op.
  const seenIdsRef = useRef<Set<string>>(new Set());

  const markSeen = useCallback((id: string) => {
    const set = seenIdsRef.current;
    set.add(id);
    // Keep the cache small — celebrations are at most three per user per day.
    if (set.size > 64) {
      const first = set.values().next().value;
      if (first) set.delete(first);
    }
  }, []);

  const showCelebration = useCallback(
    (celebration: MealOnTimeCelebration, appState: AppState = 'foreground') => {
      if (!isCelebrationMealType(celebration.meal_type)) return;
      if (seenIdsRef.current.has(celebration.id)) return;
      markSeen(celebration.id);

      const payload: CelebrationPayload = {
        meal_type: celebration.meal_type,
        message: celebration.message,
      };

      void fireMealCelebration(payload, appState);
      if (appState === 'foreground') {
        setActive(celebration);
      }

      // Keep the celebration feed (consumption-screen badges) in sync.
      void queryClient.invalidateQueries({ queryKey: queryKeys.celebrations.all });
    },
    [markSeen, queryClient]
  );

  // Cross-device realtime: a log on phone should show on iPad too.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return null;

      const channel = supabase
        .channel(`celebrations-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'meal_on_time_celebrations',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as MealOnTimeCelebration | undefined;
            if (!row) return;
            // The originating device already showed the burst inline from the
            // POST response. Skip if we've seen this id.
            if (seenIdsRef.current.has(row.id)) return;
            // Don't surprise users mid-grocery-list — skip when tab is hidden.
            if (typeof document !== 'undefined' && document.hidden) {
              markSeen(row.id);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.celebrations.all,
              });
              return;
            }
            showCelebration(row, 'foreground');
          }
        )
        .subscribe();

      return channel;
    }

    const channelPromise = subscribe();

    return () => {
      cancelled = true;
      void channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [markSeen, queryClient, showCelebration]);

  return (
    <CelebrationContext.Provider value={{ showCelebration }}>
      {children}
      {active && (
        <MealCelebrationToast
          key={active.id}
          mealType={active.meal_type}
          message={active.message}
          onDismiss={() => setActive(null)}
        />
      )}
    </CelebrationContext.Provider>
  );
}
