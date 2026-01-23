import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { MealEntity } from '@/lib/types';

/**
 * Fetch a meal's full details including ingredients.
 * Used by the ingredient editor when logging meals with portion adjustments.
 */
export function useMealIngredients(mealId: string | null) {
  return useQuery({
    queryKey: queryKeys.meals.detail(mealId!),
    queryFn: async (): Promise<MealEntity> => {
      const response = await fetch(`/api/meals/${mealId}`);
      if (!response.ok) throw new Error('Failed to fetch meal ingredients');
      const data = await response.json();
      return data.meal;
    },
    enabled: !!mealId,
    staleTime: 5 * 60 * 1000, // 5 minutes - meal data rarely changes
  });
}
