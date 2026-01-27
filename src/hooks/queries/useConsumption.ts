import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import type {
  DailyConsumptionSummary,
  AvailableMealsToLog,
  ConsumptionEntry,
  MealType,
} from '@/lib/types';

// Type for previous entries by meal type (matches LogMealClient)
export type PreviousEntriesByMealType = Record<
  MealType,
  { entries: ConsumptionEntry[]; sourceDate: string } | null
>;

/**
 * Fetch daily consumption summary for a specific date
 */
export function useDailyConsumption(date: string) {
  return useQuery({
    queryKey: queryKeys.consumption.daily(date),
    queryFn: async (): Promise<DailyConsumptionSummary> => {
      const response = await fetch(`/api/consumption/daily?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch daily consumption');
      return response.json();
    },
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    refetchOnMount: 'always', // Ensure fresh data on navigation (fixes stale cache on native app)
  });
}

/**
 * Fetch available meals to log for a specific date
 */
export function useAvailableMeals(date: string) {
  return useQuery({
    queryKey: queryKeys.consumption.available(date),
    queryFn: async (): Promise<AvailableMealsToLog> => {
      const response = await fetch(`/api/consumption/available?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch available meals');
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchOnMount: 'always', // Ensure fresh data on navigation (fixes stale cache on native app)
  });
}

/**
 * Fetch previous entries by meal type for repeat functionality
 */
export function usePreviousEntries(date: string) {
  return useQuery({
    queryKey: queryKeys.consumption.previousByMealType(date),
    queryFn: async (): Promise<PreviousEntriesByMealType> => {
      const response = await fetch(
        `/api/consumption/previous-by-meal-type?date=${date}`
      );
      if (!response.ok) throw new Error('Failed to fetch previous entries');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Less frequently changing - 5 minutes
    refetchOnMount: 'always', // Ensure fresh data on navigation (fixes stale cache on native app)
  });
}

/**
 * Combined hook for the log-meal page that fetches all three data sources.
 * Optionally seeds the cache with server-provided initial data.
 */
export function useLogMealData(
  date: string,
  initialData?: {
    summary: DailyConsumptionSummary;
    available: AvailableMealsToLog;
    previousEntries: PreviousEntriesByMealType;
    initialDate: string;
  }
) {
  const queryClient = useQueryClient();

  // Seed cache with initial data from server (only on mount)
  useEffect(() => {
    if (initialData) {
      queryClient.setQueryData(
        queryKeys.consumption.daily(initialData.initialDate),
        initialData.summary
      );
      queryClient.setQueryData(
        queryKeys.consumption.available(initialData.initialDate),
        initialData.available
      );
      queryClient.setQueryData(
        queryKeys.consumption.previousByMealType(initialData.initialDate),
        initialData.previousEntries
      );
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailyQuery = useDailyConsumption(date);
  const availableQuery = useAvailableMeals(date);
  const previousQuery = usePreviousEntries(date);

  return {
    summary: dailyQuery.data,
    available: availableQuery.data,
    previousEntries: previousQuery.data,
    isLoading:
      dailyQuery.isLoading ||
      availableQuery.isLoading ||
      previousQuery.isLoading,
    isFetching:
      dailyQuery.isFetching ||
      availableQuery.isFetching ||
      previousQuery.isFetching,
    isError:
      dailyQuery.isError || availableQuery.isError || previousQuery.isError,
    error: dailyQuery.error || availableQuery.error || previousQuery.error,
    refetch: async () => {
      await Promise.all([
        dailyQuery.refetch(),
        availableQuery.refetch(),
        previousQuery.refetch(),
      ]);
    },
  };
}
