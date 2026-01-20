import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

interface RealtimeSubscriptionConfig {
  /**
   * The database table to subscribe to
   */
  table: string;
  /**
   * Optional filter for the subscription (e.g., 'user_id=eq.123')
   * Use this to only receive changes relevant to the current user
   */
  filter?: string;
  /**
   * Query keys to invalidate when a change is received
   * Can be a single key or array of keys
   */
  queryKeys: readonly unknown[] | (readonly unknown[])[];
  /**
   * Whether the subscription is enabled. Defaults to true.
   * Use this to conditionally enable/disable subscriptions
   */
  enabled?: boolean;
}

/**
 * Hook for subscribing to Supabase Realtime changes and auto-invalidating React Query cache.
 *
 * This enables cross-device synchronization - when data changes on one device,
 * other devices will automatically refetch and update their UI.
 *
 * @example
 * // Subscribe to consumption log changes for the current user
 * useRealtimeSubscription({
 *   table: 'meal_consumption_log',
 *   filter: `user_id=eq.${userId}`,
 *   queryKeys: queryKeys.consumption.all,
 * });
 *
 * @example
 * // Subscribe to multiple query key invalidations
 * useRealtimeSubscription({
 *   table: 'meal_plans',
 *   filter: `user_id=eq.${userId}`,
 *   queryKeys: [queryKeys.mealPlans.all, queryKeys.consumption.all],
 * });
 */
export function useRealtimeSubscription({
  table,
  filter,
  queryKeys,
  enabled = true,
}: RealtimeSubscriptionConfig) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = createClient();

    // Create a unique channel name
    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*' as const,
          schema: 'public',
          table,
          filter,
        },
        (
          _payload: RealtimePostgresChangesPayload<Record<string, unknown>>
        ) => {
          // Invalidate the specified query keys
          const keysToInvalidate = Array.isArray(queryKeys[0])
            ? (queryKeys as (readonly unknown[])[])
            : [queryKeys as readonly unknown[]];

          keysToInvalidate.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, queryKeys, enabled, queryClient]);
}

/**
 * Hook for subscribing to multiple tables at once.
 * More efficient than multiple useRealtimeSubscription calls.
 *
 * @example
 * useRealtimeSubscriptions([
 *   { table: 'meal_consumption_log', filter: `user_id=eq.${userId}`, queryKeys: queryKeys.consumption.all },
 *   { table: 'meal_plans', filter: `user_id=eq.${userId}`, queryKeys: queryKeys.mealPlans.all },
 * ]);
 */
export function useRealtimeSubscriptions(
  configs: RealtimeSubscriptionConfig[]
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const enabledConfigs = configs.filter((c) => c.enabled !== false);

    if (enabledConfigs.length === 0) {
      return;
    }

    const supabase = createClient();

    // Create a single channel with multiple listeners
    const channelName = `realtime-multi-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Add all listeners to the channel
    for (const { table, filter, queryKeys } of enabledConfigs) {
      channel.on(
        'postgres_changes',
        {
          event: '*' as const,
          schema: 'public',
          table,
          filter,
        },
        (
          _payload: RealtimePostgresChangesPayload<Record<string, unknown>>
        ) => {
          const keysToInvalidate = Array.isArray(queryKeys[0])
            ? (queryKeys as (readonly unknown[])[])
            : [queryKeys as readonly unknown[]];

          keysToInvalidate.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [configs, queryClient]);
}
