'use client';

/**
 * React Query hook for the on-time meal celebrations feed used by the
 * consumption screen badges.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { MealOnTimeCelebration } from '@/lib/meal-reminders/types';

interface CelebrationsResponse {
  date: string;
  celebrations: MealOnTimeCelebration[];
}

export function useMealOnTimeCelebrations(date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.celebrations.onDate(date),
    queryFn: async (): Promise<MealOnTimeCelebration[]> => {
      const res = await fetch(`/api/meal-on-time-celebrations?date=${date}`);
      if (!res.ok) throw new Error('Failed to load celebrations');
      const data = (await res.json()) as CelebrationsResponse;
      return data.celebrations;
    },
    enabled,
    staleTime: 30 * 1000,
  });
}
