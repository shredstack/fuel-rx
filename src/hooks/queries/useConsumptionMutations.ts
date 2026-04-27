import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  isHealthKitAvailable,
  writeNutritionRecord,
  deleteNutritionRecord,
} from '@/lib/healthkit';
import { createClient } from '@/lib/supabase/client';
import type {
  ConsumptionEntry,
  DailyConsumptionSummary,
  AvailableMealsToLog,
  MealType,
  MealToLog,
  MealPlanMealToLog,
  WaterProgress,
} from '@/lib/types';

// ─── HealthKit Sync Helpers ─────────────────────────────────────────────────
// Fire-and-forget: these never block the core meal logging UX.

let _syncEnabledCache: boolean | null = null;

async function isHealthKitSyncEnabled(): Promise<boolean> {
  if (_syncEnabledCache != null) return _syncEnabledCache;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('user_profiles')
    .select('healthkit_nutrition_sync_enabled')
    .eq('id', user.id)
    .single();
  const enabled = data?.healthkit_nutrition_sync_enabled ?? false;
  _syncEnabledCache = enabled;
  return enabled;
}

/** Call when the user toggles sync on/off so the cache stays fresh. */
export function resetHealthKitSyncCache() {
  _syncEnabledCache = null;
}

async function syncEntryToHealthKit(entry: ConsumptionEntry) {
  if (!isHealthKitAvailable()) return;
  try {
    const enabled = await isHealthKitSyncEnabled();
    if (!enabled) return;

    const result = await writeNutritionRecord({
      mealName: entry.display_name,
      mealType: entry.meal_type || 'snack',
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      consumedAt: new Date(entry.consumed_at),
      fuelrxEntryId: entry.id,
    });

    if (result.success && result.healthKitSampleIds?.length) {
      await fetch(`/api/consumption/${entry.id}/healthkit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthkit_synced: true,
          healthkit_sample_ids: result.healthKitSampleIds,
          healthkit_synced_at: new Date().toISOString(),
        }),
      });
    }
  } catch (error) {
    console.error('[HealthKit] Sync failed (non-blocking):', error);
  }
}

async function deleteEntryFromHealthKit(sampleIds: string[]) {
  if (!isHealthKitAvailable() || !sampleIds.length) return;
  try {
    await deleteNutritionRecord(sampleIds);
  } catch (error) {
    console.error('[HealthKit] Delete failed (non-blocking):', error);
  }
}

interface LogMealParams {
  type: 'meal_plan' | 'custom_meal' | 'quick_cook';
  source_id: string;
  meal_id?: string;
  meal_type: MealType;
  consumed_at: string;
}

interface LogIngredientParams {
  type: 'ingredient';
  ingredient_name: string;
  amount: number;
  unit: string;
  meal_type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed_at: string;
  grams?: number;
  category?: string;
}

type LogConsumptionParams = LogMealParams | LogIngredientParams;

interface OptimisticContext {
  previousSummary: DailyConsumptionSummary | undefined;
  previousAvailable: AvailableMealsToLog | undefined;
}

/**
 * Mutation hook for logging a meal or ingredient.
 * Invalidates all consumption queries on success to ensure cross-date sync.
 */
export function useLogMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogConsumptionParams): Promise<ConsumptionEntry> => {
      const response = await fetch('/api/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to log meal');
      }
      return response.json();
    },

    onSuccess: (entry) => {
      // Invalidate all consumption data to ensure cross-date consistency
      // This handles the case where logging a meal affects multiple views
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });

      // Fire-and-forget: sync to Apple Health on iOS native
      syncEntryToHealthKit(entry);
    },

    onError: (error) => {
      console.error('Error logging meal:', error);
    },
  });
}

/**
 * Mutation hook for deleting a consumption entry.
 */
export function useDeleteConsumptionEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string): Promise<string[]> => {
      const response = await fetch(`/api/consumption/${entryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }
      const { healthkit_sample_ids } = await response.json();
      return healthkit_sample_ids ?? [];
    },

    onSuccess: (healthkitSampleIds) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });

      // Fire-and-forget: remove from Apple Health on iOS native
      deleteEntryFromHealthKit(healthkitSampleIds);
    },

    onError: (error) => {
      console.error('Error deleting entry:', error);
    },
  });
}

/**
 * Mutation hook for updating an entry's meal type.
 */
export function useUpdateEntryMealType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      mealType,
    }: {
      entryId: string;
      mealType: MealType;
    }): Promise<ConsumptionEntry> => {
      const response = await fetch(`/api/consumption/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_type: mealType }),
      });
      if (!response.ok) {
        throw new Error('Failed to update entry');
      }
      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });
    },

    onError: (error) => {
      console.error('Error updating entry meal type:', error);
    },
  });
}

/**
 * Mutation hook for updating an entry's amount and macros.
 */
export function useUpdateEntryAmount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      amount,
      calories,
      protein,
      carbs,
      fat,
      grams,
    }: {
      entryId: string;
      amount: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      grams?: number;
    }): Promise<ConsumptionEntry> => {
      const response = await fetch(`/api/consumption/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, calories, protein, carbs, fat, grams }),
      });
      if (!response.ok) {
        throw new Error('Failed to update entry amount');
      }
      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });
    },

    onError: (error) => {
      console.error('Error updating entry amount:', error);
    },
  });
}

/**
 * Mutation hook for repeating a meal type from a previous day.
 */
export function useRepeatMealType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mealType,
      sourceDate,
      targetDate,
    }: {
      mealType: MealType;
      sourceDate: string;
      targetDate: string;
    }): Promise<{ entries: ConsumptionEntry[] }> => {
      const response = await fetch('/api/consumption/repeat-meal-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealType, sourceDate, targetDate }),
      });
      if (!response.ok) {
        throw new Error('Failed to repeat meal type');
      }
      return response.json();
    },

    onSuccess: ({ entries }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });

      // Fire-and-forget: sync repeated meals to Apple Health
      for (const entry of entries) {
        syncEntryToHealthKit(entry);
      }
    },

    onError: (error) => {
      console.error('Error repeating meal type:', error);
    },
  });
}

/**
 * Mutation hook for repeating all meals from yesterday.
 */
export function useRepeatYesterday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceDate,
      targetDate,
    }: {
      sourceDate: string;
      targetDate: string;
    }): Promise<void> => {
      const response = await fetch('/api/consumption/repeat-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate, targetDate }),
      });
      if (!response.ok) {
        throw new Error('Failed to repeat yesterday');
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });
    },

    onError: (error) => {
      console.error('Error repeating yesterday:', error);
    },
  });
}

/**
 * Helper function to optimistically update the summary when logging a meal.
 * Call this before the mutation to provide instant feedback.
 */
export function optimisticallyAddEntry(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
  entry: ConsumptionEntry
) {
  queryClient.setQueryData<DailyConsumptionSummary>(
    queryKeys.consumption.daily(date),
    (old) => {
      if (!old) return old;
      return {
        ...old,
        consumed: {
          calories: old.consumed.calories + entry.calories,
          protein: old.consumed.protein + entry.protein,
          carbs: old.consumed.carbs + entry.carbs,
          fat: old.consumed.fat + entry.fat,
        },
        entries: [...old.entries, entry],
        entry_count: old.entry_count + 1,
      };
    }
  );
}

/**
 * Helper function to optimistically remove an entry from the summary.
 */
export function optimisticallyRemoveEntry(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
  entryId: string
) {
  queryClient.setQueryData<DailyConsumptionSummary>(
    queryKeys.consumption.daily(date),
    (old) => {
      if (!old) return old;
      const entry = old.entries.find((e) => e.id === entryId);
      if (!entry) return old;
      return {
        ...old,
        consumed: {
          calories: old.consumed.calories - entry.calories,
          protein: old.consumed.protein - entry.protein,
          carbs: old.consumed.carbs - entry.carbs,
          fat: old.consumed.fat - entry.fat,
        },
        entries: old.entries.filter((e) => e.id !== entryId),
        entry_count: old.entry_count - 1,
      };
    }
  );
}

/**
 * Helper function to update meal logged status in available meals.
 */
export function updateMealLoggedStatusInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
  mealId: string,
  source: string,
  isLogged: boolean,
  entryId?: string,
  loggedAt?: string
) {
  queryClient.setQueryData<AvailableMealsToLog>(
    queryKeys.consumption.available(date),
    (old) => {
      if (!old) return old;

      const updateList = (list: MealToLog[]) =>
        list.map((m) =>
          m.id === mealId
            ? { ...m, is_logged: isLogged, logged_entry_id: entryId, logged_at: loggedAt }
            : m
        );

      const updatePlanList = (list: MealPlanMealToLog[]) =>
        list.map((m) =>
          m.id === mealId
            ? { ...m, is_logged: isLogged, logged_entry_id: entryId, logged_at: loggedAt }
            : m
        );

      return {
        ...old,
        from_todays_plan: source === 'meal_plan' ? updateList(old.from_todays_plan) : old.from_todays_plan,
        from_week_plan: source === 'meal_plan' ? updateList(old.from_week_plan) : old.from_week_plan,
        latest_plan_meals: source === 'meal_plan' ? updatePlanList(old.latest_plan_meals || []) : (old.latest_plan_meals || []),
        custom_meals: source === 'custom_meal' ? updateList(old.custom_meals) : old.custom_meals,
        quick_cook_meals: source === 'quick_cook' ? updateList(old.quick_cook_meals) : old.quick_cook_meals,
        recent_meals: old.recent_meals,
        frequent_ingredients: old.frequent_ingredients,
        pinned_ingredients: old.pinned_ingredients || [],
      };
    }
  );
}

/**
 * Mutation hook for adding water intake.
 * Uses optimistic updates for instant feedback.
 */
export function useAddWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      ounces,
    }: {
      date: string;
      ounces: number;
    }): Promise<WaterProgress> => {
      const response = await fetch('/api/consumption/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ounces }),
      });
      if (!response.ok) {
        throw new Error('Failed to add water');
      }
      return response.json();
    },

    // Optimistic update for instant feedback
    onMutate: async ({ date, ounces }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.consumption.daily(date) });

      // Snapshot the previous value
      const previousSummary = queryClient.getQueryData<DailyConsumptionSummary>(
        queryKeys.consumption.daily(date)
      );

      // Optimistically update the water progress
      if (previousSummary) {
        const currentWater = previousSummary.water || {
          currentOunces: 0,
          goalOunces: 100,
          percentage: 0,
          goalCelebrated: false,
        };

        const newOunces = currentWater.currentOunces + ounces;
        const newPercentage = Math.round((newOunces / currentWater.goalOunces) * 100);

        queryClient.setQueryData<DailyConsumptionSummary>(
          queryKeys.consumption.daily(date),
          {
            ...previousSummary,
            water: {
              ...currentWater,
              currentOunces: newOunces,
              percentage: newPercentage,
            },
          }
        );
      }

      return { previousSummary };
    },

    onError: (error, { date }, context) => {
      // Roll back on error
      if (context?.previousSummary) {
        queryClient.setQueryData(
          queryKeys.consumption.daily(date),
          context.previousSummary
        );
      }
      console.error('Error adding water:', error);
    },

    onSettled: (_, __, { date }) => {
      // Refetch to ensure server state is in sync
      queryClient.invalidateQueries({ queryKey: queryKeys.consumption.daily(date) });
    },
  });
}
