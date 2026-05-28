'use client';

/**
 * React Query hooks for the Food Journal.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getLocalDateString } from '@/lib/meal-reminders/fire-times';
import type {
  FoodJournalEntry,
  FoodJournalSource,
  ReminderMealType,
} from '@/lib/meal-reminders/types';

export function useFoodJournalRange(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.foodJournal.range(from, to),
    queryFn: async (): Promise<FoodJournalEntry[]> => {
      const res = await fetch(`/api/food-journal?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to load food journal');
      const data = await res.json();
      return (data.entries as FoodJournalEntry[]) ?? [];
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

/** Today's journal entries. */
export function useFoodJournalToday(enabled = true) {
  const today = getLocalDateString();
  return useFoodJournalRange(today, today, enabled);
}

export interface CreateFoodJournalParams {
  mealPhotoId: string;
  mealType?: ReminderMealType;
  note?: string;
  source: FoodJournalSource;
  /** Required when source is 'reminder_dismiss'. */
  reminderDate?: string;
}

export function useCreateFoodJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateFoodJournalParams): Promise<FoodJournalEntry> => {
      const res = await fetch('/api/food-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_photo_id: params.mealPhotoId,
          meal_type: params.mealType,
          note: params.note,
          source: params.source,
          reminder_date: params.reminderDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create journal entry');
      }
      const data = await res.json();
      return data.entry as FoodJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodJournal.all });
      // A reminder_dismiss entry also resolves a reminder.
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });
}

export interface UpdateFoodJournalParams {
  id: string;
  note?: string | null;
  mealType?: ReminderMealType | null;
  promotedConsumptionLogId?: string | null;
}

export function useUpdateFoodJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateFoodJournalParams): Promise<FoodJournalEntry> => {
      const payload: Record<string, unknown> = {};
      if ('note' in params) payload.note = params.note;
      if ('mealType' in params) payload.meal_type = params.mealType;
      if ('promotedConsumptionLogId' in params) {
        payload.promoted_consumption_log_id = params.promotedConsumptionLogId;
      }

      const res = await fetch(`/api/food-journal/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update journal entry');
      }
      const data = await res.json();
      return data.entry as FoodJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodJournal.all });
    },
  });
}

export function useDeleteFoodJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/food-journal/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete journal entry');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodJournal.all });
    },
  });
}

/** Promote a journal entry to a tracked meal (runs AI analysis — paywalled). */
export function usePromoteFoodJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      mealType?: ReminderMealType;
      consumedAt?: string;
    }): Promise<{ consumption_log_id: string }> => {
      const res = await fetch(`/api/food-journal/${params.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: params.mealType,
          consumed_at: params.consumedAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || 'Failed to promote entry');
        (error as Error & { status?: number }).status = res.status;
        throw error;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodJournal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });
}
