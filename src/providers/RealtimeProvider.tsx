'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type { RealtimeChannel, User } from '@supabase/supabase-js';

/**
 * RealtimeProvider sets up Supabase Realtime subscriptions for cross-device synchronization.
 *
 * When data changes on one device (or from the server), this provider automatically
 * invalidates the relevant React Query caches, causing the UI to refetch and update.
 *
 * Tables subscribed to:
 * - meal_consumption_log: Consumption tracking
 * - meal_plans: Meal plan data
 * - meal_plan_meals: Individual meals within plans
 * - social_feed_posts: Community posts
 * - user_grocery_staples: Grocery staples
 * - user_subscriptions: Subscription status (updated via RevenueCat webhooks)
 * - ingredients: Admin ingredient updates
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function setupSubscriptions() {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in, no subscriptions needed
        return;
      }

      userIdRef.current = user.id;

      // Create a single channel with all subscriptions
      const channel = supabase
        .channel(`user-realtime-${user.id}`)
        // Consumption log changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_consumption_log',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.consumption.all,
            });
          }
        )
        // Meal plan changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_plans',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.mealPlans.all,
            });
            // Also invalidate consumption since available meals may change
            queryClient.invalidateQueries({
              queryKey: queryKeys.consumption.all,
            });
          }
        )
        // Meal plan meals changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_plan_meals',
          },
          () => {
            // meal_plan_meals doesn't have user_id, so we invalidate broadly
            // The query will filter appropriately
            queryClient.invalidateQueries({
              queryKey: queryKeys.mealPlans.all,
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.consumption.all,
            });
          }
        )
        // Social feed post changes (all posts, not just user's)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'social_feed_posts',
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.socialFeed.all,
            });
          }
        )
        // User grocery staples changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_grocery_staples',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.groceryStaples.all,
            });
          }
        )
        // User subscription changes (from RevenueCat webhooks)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.user.subscription(),
            });
          }
        )
        // Ingredients changes (admin updates)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ingredients',
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.ingredients.all,
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    setupSubscriptions();

    // Listen for auth state changes to setup/teardown subscriptions
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clean up subscriptions on sign out
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          userIdRef.current = null;
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Set up subscriptions on sign in
        if (!channelRef.current) {
          setupSubscriptions();
        }
      }
    });

    // Cleanup on unmount
    return () => {
      authSubscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return <>{children}</>;
}
