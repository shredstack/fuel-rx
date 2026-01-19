import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export type JobStatus =
  | 'pending'
  | 'generating_ingredients'
  | 'generating_meals'
  | 'generating_prep'
  | 'saving'
  | 'completed'
  | 'failed';

interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progressMessage?: string;
  mealPlanId?: string;
  errorMessage?: string;
  error?: string;
}

/**
 * Hook for polling job status during meal plan generation.
 * Automatically polls every 3 seconds until job completes or fails.
 */
export function useJobStatus(
  jobId: string | null,
  options?: {
    enabled?: boolean;
    onSuccess?: (data: JobStatusResponse) => void;
  }
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.jobs.status(jobId || ''),
    queryFn: async (): Promise<JobStatusResponse> => {
      const response = await fetch(`/api/job-status/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch job status');
      return response.json();
    },
    enabled: !!jobId && options?.enabled !== false,
    // Poll every 3 seconds while job is in progress
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false; // Stop polling when job is done
      }
      return 3000; // Poll every 3 seconds
    },
    // Don't refetch on window focus during polling
    refetchOnWindowFocus: false,
    // Keep the data fresh
    staleTime: 0,
  });
}

/**
 * Helper to clear job status from cache.
 * Call this when starting a new job to ensure fresh state.
 */
export function useClearJobStatus() {
  const queryClient = useQueryClient();

  return (jobId: string) => {
    queryClient.removeQueries({ queryKey: queryKeys.jobs.status(jobId) });
  };
}
