import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { BatchPrepStatusResponse } from '@/lib/types';

/**
 * Hook for polling batch prep generation status.
 * Automatically polls every 5 seconds while status is 'pending' or 'generating'.
 * Stops polling when batch prep is 'completed', 'failed', or 'not_started'.
 */
export function useBatchPrepStatus(mealPlanId: string | null) {
  return useQuery<BatchPrepStatusResponse>({
    queryKey: queryKeys.mealPlans.batchPrepStatus(mealPlanId),
    queryFn: async () => {
      if (!mealPlanId) throw new Error('No meal plan ID');

      const response = await fetch(`/api/batch-prep-status/${mealPlanId}`);
      if (!response.ok) throw new Error('Failed to fetch batch prep status');
      return response.json();
    },
    enabled: !!mealPlanId,
    // Poll every 5 seconds while actively generating, stop otherwise
    refetchInterval: (query) => {
      const data = query.state.data;
      // Only poll when there's an active job running
      if (data?.status === 'generating' || data?.status === 'pending') {
        return 5000;
      }
      // Stop polling for not_started, completed, or failed
      return false;
    },
    // Don't refetch on window focus during polling
    refetchOnWindowFocus: false,
    // Keep the data fresh
    staleTime: 0,
  });
}
