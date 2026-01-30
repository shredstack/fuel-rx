import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import type {
  DailyConsumptionSummary,
  AvailableMealsToLog,
  ConsumptionEntry,
  MealType,
  PeriodConsumptionSummary,
  ConsumptionSummaryData,
} from '@/lib/types';

/** Get user's local today as YYYY-MM-DD string */
function getLocalTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Type for previous entries by meal type (matches LogMealClient)
export type PreviousEntriesByMealType = Record<
  MealType,
  { entries: ConsumptionEntry[]; sourceDate: string } | null
>;

/**
 * Fetch daily consumption summary for a specific date
 * @param date - Date string in YYYY-MM-DD format
 * @param hasInitialData - If true, skip refetch on initial mount (data already seeded from server)
 */
export function useDailyConsumption(date: string, hasInitialData = false) {
  const hasHydratedRef = useRef(hasInitialData);

  return useQuery({
    queryKey: queryKeys.consumption.daily(date),
    queryFn: async (): Promise<DailyConsumptionSummary> => {
      const response = await fetch(`/api/consumption/daily?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch daily consumption');
      return response.json();
    },
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    // Only refetch on mount if we don't have initial data from SSR
    // After first fetch, always refetch on navigation to ensure fresh data
    refetchOnMount: hasHydratedRef.current ? false : 'always',
  });
}

/**
 * Fetch available meals to log for a specific date
 * @param date - Date string in YYYY-MM-DD format
 * @param hasInitialData - If true, skip refetch on initial mount (data already seeded from server)
 */
export function useAvailableMeals(date: string, hasInitialData = false) {
  const hasHydratedRef = useRef(hasInitialData);

  return useQuery({
    queryKey: queryKeys.consumption.available(date),
    queryFn: async (): Promise<AvailableMealsToLog> => {
      const response = await fetch(`/api/consumption/available?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch available meals');
      return response.json();
    },
    staleTime: 60 * 1000,
    // Only refetch on mount if we don't have initial data from SSR
    refetchOnMount: hasHydratedRef.current ? false : 'always',
  });
}

/**
 * Fetch previous entries by meal type for repeat functionality
 * @param date - Date string in YYYY-MM-DD format
 * @param hasInitialData - If true, skip refetch on initial mount (data already seeded from server)
 */
export function usePreviousEntries(date: string, hasInitialData = false) {
  const hasHydratedRef = useRef(hasInitialData);

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
    // Only refetch on mount if we don't have initial data from SSR
    refetchOnMount: hasHydratedRef.current ? false : 'always',
  });
}

/**
 * Fetch weekly consumption summary
 * @param date - Any date within the target week (YYYY-MM-DD format)
 * @param enabled - Whether to enable the query
 */
export function useWeeklyConsumption(date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.consumption.weekly(date),
    queryFn: async (): Promise<PeriodConsumptionSummary> => {
      const today = getLocalTodayStr();
      const response = await fetch(`/api/consumption/weekly?date=${date}&today=${today}`);
      if (!response.ok) throw new Error('Failed to fetch weekly consumption');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - period data changes less frequently
    enabled,
  });
}

/**
 * Fetch monthly consumption summary
 * @param year - Year number
 * @param month - Month number (1-12)
 * @param enabled - Whether to enable the query
 */
export function useMonthlyConsumption(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.consumption.monthly(year, month),
    queryFn: async (): Promise<PeriodConsumptionSummary> => {
      const today = getLocalTodayStr();
      const response = await fetch(`/api/consumption/monthly?year=${year}&month=${month}&today=${today}`);
      if (!response.ok) throw new Error('Failed to fetch monthly consumption');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled,
  });
}

/**
 * Fetch rolling-year summary data for the Summary tab.
 * @param enabled - Only fetch when the Summary tab is selected
 */
export function useConsumptionSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.consumption.summary(),
    queryFn: async (): Promise<ConsumptionSummaryData> => {
      const today = getLocalTodayStr();
      const response = await fetch(`/api/consumption/summary?today=${today}`);
      if (!response.ok) throw new Error('Failed to fetch consumption summary');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - summary data changes infrequently
    enabled,
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
  // Track if this is the initial date we received from server
  const isInitialDateRef = useRef(initialData ? date === initialData.initialDate : false);

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

  // Pass hasInitialData only for the initial date from server
  const hasInitialData = isInitialDateRef.current && !!initialData;
  const dailyQuery = useDailyConsumption(date, hasInitialData);
  const availableQuery = useAvailableMeals(date, hasInitialData);
  const previousQuery = usePreviousEntries(date, hasInitialData);

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
