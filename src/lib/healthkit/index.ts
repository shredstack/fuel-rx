import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  NutritionRecord,
  HealthKitWriteResult,
  HealthKitPermissionResult,
} from '@/lib/types';

// ─── Native Plugin Interface ─────────────────────────────────────────────────

interface HealthKitNutritionPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{
    granted: boolean;
    permissions: Record<string, boolean>;
  }>;
  writeNutritionCorrelation(options: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    startDate: string;
    mealName: string;
    fuelrxEntryId: string;
  }): Promise<{
    success: boolean;
    healthKitSampleIds: string[];
  }>;
  deleteSamples(options: {
    sampleIds: string[];
  }): Promise<{
    success: boolean;
    deletedCount: number;
  }>;
  readNutritionSamples(options: {
    date: string;
  }): Promise<{
    samples: Array<{
      correlationId: string;
      startDate: string;
      endDate: string;
      mealName: string;
      fuelrxEntryId: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      sampleIds: string[];
    }>;
  }>;
}

// Lazy-register the native plugin only when needed
let pluginInstance: HealthKitNutritionPlugin | null = null;

function getPlugin(): HealthKitNutritionPlugin {
  if (!pluginInstance) {
    pluginInstance = registerPlugin<HealthKitNutritionPlugin>('HealthKitNutrition');
  }
  return pluginInstance;
}

// ─── Platform Detection ──────────────────────────────────────────────────────

/**
 * Returns true only on iOS native platform where the HealthKit plugin is registered.
 * Returns false on old native builds that don't have the plugin.
 */
export function isHealthKitAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'ios' &&
    Capacitor.isPluginAvailable('HealthKitNutrition')
  );
}

// ─── Permission Management ───────────────────────────────────────────────────

/**
 * Requests HealthKit permissions for nutrition data.
 * Returns no-op result on non-iOS platforms.
 */
export async function requestHealthKitPermissions(): Promise<HealthKitPermissionResult> {
  if (!isHealthKitAvailable()) {
    return {
      granted: false,
      permissions: {
        calories: false,
        protein: false,
        carbs: false,
        fat: false,
        fiber: false,
      },
    };
  }

  try {
    const plugin = getPlugin();
    const result = await plugin.requestAuthorization();

    return {
      granted: result.granted,
      permissions: {
        calories: result.permissions?.calories ?? false,
        protein: result.permissions?.protein ?? false,
        carbs: result.permissions?.carbs ?? false,
        fat: result.permissions?.fat ?? false,
        fiber: result.permissions?.fiber ?? false,
      },
    };
  } catch (error) {
    console.error('[HealthKit] Permission request failed:', error);
    return {
      granted: false,
      permissions: {
        calories: false,
        protein: false,
        carbs: false,
        fat: false,
        fiber: false,
      },
    };
  }
}

// ─── Write Nutrition Data ────────────────────────────────────────────────────

/**
 * Writes a nutrition record to Apple Health as a correlated food entry.
 * Returns no-op result on non-iOS platforms.
 * Never throws — failures are returned in the result object.
 */
export async function writeNutritionRecord(
  record: NutritionRecord
): Promise<HealthKitWriteResult> {
  if (!isHealthKitAvailable()) {
    return { success: false, error: 'HealthKit not available on this platform' };
  }

  try {
    const plugin = getPlugin();
    const result = await plugin.writeNutritionCorrelation({
      calories: record.calories,
      protein: record.protein,
      carbs: record.carbs,
      fat: record.fat,
      fiber: record.fiber,
      startDate: record.consumedAt.toISOString(),
      mealName: record.mealName,
      fuelrxEntryId: record.fuelrxEntryId,
    });

    return {
      success: result.success,
      healthKitSampleIds: result.healthKitSampleIds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HealthKit] Write failed:', error);
    return { success: false, error: message };
  }
}

// ─── Delete Nutrition Data ───────────────────────────────────────────────────

/**
 * Deletes previously written nutrition samples from Apple Health.
 * Used when a user un-logs a meal.
 */
export async function deleteNutritionRecord(
  sampleIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!isHealthKitAvailable()) {
    return { success: false, error: 'HealthKit not available on this platform' };
  }

  if (!sampleIds.length) {
    return { success: true };
  }

  try {
    const plugin = getPlugin();
    const result = await plugin.deleteSamples({ sampleIds });
    return { success: result.success };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HealthKit] Delete failed:', error);
    return { success: false, error: message };
  }
}

// ─── Read Nutrition Data ─────────────────────────────────────────────────────

/**
 * Reads FuelRx-authored nutrition records for a given date.
 * Used for duplicate detection and sync status display.
 */
export async function getRecentNutritionRecords(date: string) {
  if (!isHealthKitAvailable()) {
    return [];
  }

  try {
    const plugin = getPlugin();
    const result = await plugin.readNutritionSamples({ date });
    return result.samples;
  } catch (error) {
    console.error('[HealthKit] Read failed:', error);
    return [];
  }
}
