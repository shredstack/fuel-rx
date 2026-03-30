'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { HealthKitSyncStatus } from '@/lib/types';

/**
 * Fetches HealthKit sync statistics for display in settings.
 * Only enabled when the user is on iOS native and has sync enabled.
 */
export function useHealthKitSyncStatus(enabled: boolean) {
  return useQuery<HealthKitSyncStatus>({
    queryKey: queryKeys.healthkit.status(),
    queryFn: async () => {
      const response = await fetch('/api/healthkit/status');
      if (!response.ok) {
        throw new Error('Failed to fetch HealthKit sync status');
      }
      return response.json();
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}
