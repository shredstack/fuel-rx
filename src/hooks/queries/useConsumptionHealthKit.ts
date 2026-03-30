'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useHealthKit } from '@/hooks/useHealthKit';
import { isHealthKitAvailable } from '@/lib/healthkit';
import type { ConsumptionEntry } from '@/lib/types';

/**
 * Provides HealthKit sync callbacks for consumption mutations.
 * These are fire-and-forget: they never block the core meal logging UX.
 *
 * Usage:
 *   const { syncToHealthKit, deleteFromHealthKit } = useConsumptionHealthKit(syncEnabled);
 *   // In onSuccess of useLogMeal:
 *   syncToHealthKit(entry);
 *   // Before or after useDeleteConsumptionEntry:
 *   deleteFromHealthKit(entry);
 */
export function useConsumptionHealthKit(syncEnabled: boolean) {
  const { writeMealToHealth, deleteMealFromHealth } = useHealthKit({
    syncEnabled,
  });
  const queryClient = useQueryClient();

  /**
   * Sync a newly logged consumption entry to Apple Health.
   * Fire-and-forget — never throws or blocks.
   */
  const syncToHealthKit = useCallback(
    async (entry: ConsumptionEntry) => {
      if (!isHealthKitAvailable() || !syncEnabled) return;

      try {
        const result = await writeMealToHealth(entry);

        if (result.success && result.healthKitSampleIds?.length) {
          // Update the entry with HealthKit sample IDs
          await fetch(`/api/consumption/${entry.id}/healthkit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              healthkit_synced: true,
              healthkit_sample_ids: result.healthKitSampleIds,
              healthkit_synced_at: new Date().toISOString(),
            }),
          });

          // Invalidate healthkit status cache
          queryClient.invalidateQueries({
            queryKey: queryKeys.healthkit.all,
          });
        }
      } catch (error) {
        // HealthKit sync failures must NEVER prevent meal logging
        console.error('[HealthKit] Sync failed (non-blocking):', error);
      }
    },
    [writeMealToHealth, syncEnabled, queryClient]
  );

  /**
   * Delete HealthKit samples when a consumption entry is removed.
   * Fire-and-forget — never throws or blocks.
   */
  const deleteFromHealthKit = useCallback(
    async (entry: ConsumptionEntry) => {
      if (!isHealthKitAvailable()) return;
      if (!entry.healthkit_sample_ids?.length) return;

      try {
        await deleteMealFromHealth(entry.healthkit_sample_ids);

        // Invalidate healthkit status cache
        queryClient.invalidateQueries({
          queryKey: queryKeys.healthkit.all,
        });
      } catch (error) {
        // HealthKit delete failures must NEVER prevent meal deletion
        console.error('[HealthKit] Delete failed (non-blocking):', error);
      }
    },
    [deleteMealFromHealth, queryClient]
  );

  return { syncToHealthKit, deleteFromHealthKit };
}
