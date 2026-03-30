'use client';

import { useCallback, useRef } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  writeNutritionRecord,
  deleteNutritionRecord,
} from '@/lib/healthkit';
import type {
  ConsumptionEntry,
  NutritionRecord,
  HealthKitWriteResult,
  HealthKitPermissionResult,
  MealType,
} from '@/lib/types';

interface UseHealthKitOptions {
  /** Whether the user has enabled HealthKit nutrition sync in their profile */
  syncEnabled: boolean;
}

interface UseHealthKitReturn {
  /** True only on iOS native platform */
  isAvailable: boolean;
  /** Whether the user has enabled sync */
  isEnabled: boolean;
  /** Request HealthKit permissions. Returns permission result. */
  requestPermissions: () => Promise<HealthKitPermissionResult>;
  /** Write a consumption entry to Apple Health. Never throws. */
  writeMealToHealth: (entry: ConsumptionEntry) => Promise<HealthKitWriteResult>;
  /** Delete samples from Apple Health by their IDs. Never throws. */
  deleteMealFromHealth: (sampleIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Central hook for HealthKit interaction.
 * All methods are no-ops on web/Android.
 */
export function useHealthKit({ syncEnabled }: UseHealthKitOptions): UseHealthKitReturn {
  const { isIOS, isNative } = usePlatform();
  const isAvailable = isIOS && isNative;
  const permissionCacheRef = useRef<HealthKitPermissionResult | null>(null);

  const requestPermissions = useCallback(async (): Promise<HealthKitPermissionResult> => {
    if (!isAvailable) {
      return {
        granted: false,
        permissions: { calories: false, protein: false, carbs: false, fat: false, fiber: false },
      };
    }

    const result = await requestHealthKitPermissions();
    permissionCacheRef.current = result;
    return result;
  }, [isAvailable]);

  const writeMealToHealth = useCallback(
    async (entry: ConsumptionEntry): Promise<HealthKitWriteResult> => {
      if (!isAvailable || !syncEnabled) {
        return { success: false, error: 'HealthKit sync not available or not enabled' };
      }

      // Check if already synced
      if (entry.healthkit_synced && entry.healthkit_sample_ids?.length) {
        return { success: true, healthKitSampleIds: entry.healthkit_sample_ids };
      }

      const record: NutritionRecord = {
        mealName: entry.display_name,
        mealType: (entry.meal_type as MealType) || 'snack',
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        consumedAt: new Date(entry.consumed_at),
        fuelrxEntryId: entry.id,
      };

      return writeNutritionRecord(record);
    },
    [isAvailable, syncEnabled]
  );

  const deleteMealFromHealth = useCallback(
    async (sampleIds: string[]): Promise<{ success: boolean; error?: string }> => {
      if (!isAvailable || !sampleIds.length) {
        return { success: true };
      }

      return deleteNutritionRecord(sampleIds);
    },
    [isAvailable]
  );

  return {
    isAvailable,
    isEnabled: syncEnabled,
    requestPermissions,
    writeMealToHealth,
    deleteMealFromHealth,
  };
}
