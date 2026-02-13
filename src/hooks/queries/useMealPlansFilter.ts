import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { MealPlanFilterOption } from '@/app/api/consumption/meal-plans-for-filter/route';

export interface MealPlansFilterResponse {
  plans: MealPlanFilterOption[];
  latestPlanId: string | null;
}

/**
 * Hook for fetching user's meal plans for the filter UI.
 * Returns a lightweight list of recent and favorited plans.
 */
export function useMealPlansFilter() {
  return useQuery<MealPlansFilterResponse>({
    queryKey: queryKeys.mealPlans.forFilter(),
    queryFn: async () => {
      const response = await fetch('/api/consumption/meal-plans-for-filter');
      if (!response.ok) throw new Error('Failed to fetch meal plans');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
