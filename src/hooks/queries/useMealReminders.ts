'use client';

/**
 * React Query hooks for meal reminders (settings, status, resolution).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { mergeWithDefaults } from '@/lib/meal-reminders/settings';
import type {
  MealReminderSettings,
  MealReminderStatusMap,
  ReminderMealType,
  ResolutionSource,
} from '@/lib/meal-reminders/types';

export function useMealReminderSettings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reminders.settings(),
    queryFn: async (): Promise<MealReminderSettings> => {
      const res = await fetch('/api/meal-reminders/settings');
      if (!res.ok) throw new Error('Failed to load reminder settings');
      const data = await res.json();
      return mergeWithDefaults(data.settings);
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateMealReminderSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: MealReminderSettings): Promise<MealReminderSettings> => {
      const res = await fetch('/api/meal-reminders/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || 'Failed to save reminder settings');
        // Surface the 402 paywall case to callers.
        (error as Error & { status?: number }).status = res.status;
        throw error;
      }
      const data = await res.json();
      return mergeWithDefaults(data.settings);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.reminders.settings(), settings);
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });
}

export function useMealReminderStatus(
  date: string,
  enabled = true,
  options?: {
    /**
     * Poll the server at this interval, even in a backgrounded tab. Used while
     * the alarm modal is open so it self-dismisses after the meal is logged on
     * another device — realtime alone isn't reliable there (idle tabs and
     * backgrounded WebViews drop the socket).
     */
    refetchIntervalMs?: number;
  }
) {
  return useQuery({
    queryKey: queryKeys.reminders.status(date),
    queryFn: async (): Promise<MealReminderStatusMap> => {
      const res = await fetch(`/api/meal-reminders/status?date=${date}`);
      if (!res.ok) throw new Error('Failed to load reminder status');
      const data = await res.json();
      return data.status as MealReminderStatusMap;
    },
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: options?.refetchIntervalMs ?? false,
    refetchIntervalInBackground: true,
  });
}

export interface ResolveReminderParams {
  mealType: ReminderMealType;
  date: string;
  source: ResolutionSource;
  consumptionLogId?: string;
  foodJournalEntryId?: string;
}

export function useResolveMealReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResolveReminderParams) => {
      const res = await fetch('/api/meal-reminders/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: params.mealType,
          date: params.date,
          source: params.source,
          consumption_log_id: params.consumptionLogId,
          food_journal_entry_id: params.foodJournalEntryId,
        }),
      });
      if (!res.ok) throw new Error('Failed to resolve reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });
}
