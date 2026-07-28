/**
 * HealthKit sync service — the single place that decides WHEN a meal is
 * written to Apple Health and WHAT start date it gets.
 *
 * Reliability model:
 * 1. Fire-and-forget sync at log time (fast path, can fail silently — e.g.
 *    HealthKit rejects writes while the iPhone is locked, or the WebView is
 *    suspended before the write completes).
 * 2. A sweep (`syncPendingEntries`) that runs on app launch/foreground and
 *    retries every entry still marked `healthkit_synced = false`, with
 *    duplicate protection via the FuelRxEntryId metadata already stored on
 *    each HealthKit sample.
 */

import { createClient } from '@/lib/supabase/client';
import {
  isHealthKitAvailable,
  writeNutritionRecord,
  getRecentNutritionRecords,
} from '@/lib/healthkit';
import { getLocalDateString } from '@/lib/date-utils';
import type { ConsumptionEntry, MealType } from '@/lib/types';

// ─── Sync-Enabled Preference Cache ───────────────────────────────────────────

let _syncEnabledCache: { userId: string; enabled: boolean } | null = null;

export async function isHealthKitSyncEnabled(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  if (_syncEnabledCache?.userId === user.id) return _syncEnabledCache.enabled;
  const { data } = await supabase
    .from('user_profiles')
    .select('healthkit_nutrition_sync_enabled')
    .eq('id', user.id)
    .single();
  const enabled = data?.healthkit_nutrition_sync_enabled ?? false;
  _syncEnabledCache = { userId: user.id, enabled };
  return enabled;
}

/** Call when the user toggles sync on/off so the cache stays fresh. */
export function resetHealthKitSyncCache() {
  _syncEnabledCache = null;
}

// ─── Start Date Resolution ───────────────────────────────────────────────────

/**
 * Resolves the instant a HealthKit sample should be written at, guaranteeing
 * its LOCAL calendar day equals the entry's `consumed_date`.
 *
 * Apple Health groups daily nutrition totals by the device's local day, so an
 * entry logged in FuelRx for date X must land on local day X — regardless of
 * how `consumed_at` was stored (legacy rows contain local wall-clock times
 * mislabeled as UTC, and some server-created rows contain true UTC instants
 * whose local day differs from `consumed_date`).
 */
export function resolveHealthKitStartDate(
  consumedAt: string,
  consumedDate?: string | null
): Date {
  let start = new Date(consumedAt);
  if (isNaN(start.getTime())) {
    start = new Date();
  }

  if (consumedDate && getLocalDateString(start) !== consumedDate) {
    const [year, month, day] = consumedDate.split('-').map(Number);
    if (year && month && day) {
      // Keep the parsed time-of-day, but pin the local calendar day.
      start = new Date(year, month - 1, day, start.getHours(), start.getMinutes(), start.getSeconds());
    }
  }

  // HealthKit rejects future-dated samples. Only clamp same-day overshoots —
  // moving a genuinely future-dated entry would silently file it under the
  // wrong day, so we leave it alone and log instead (HealthKit rejects it
  // quietly, so this warning is the only diagnosable signal).
  const now = new Date();
  if (start.getTime() > now.getTime()) {
    if (getLocalDateString(start) === getLocalDateString(now)) {
      start = now;
    } else {
      console.warn(
        `[HealthKit] Entry is dated ${getLocalDateString(start)}, a future day (today is ${getLocalDateString(now)}). ` +
        'HealthKit will reject this sample; leaving the date unchanged rather than moving it.'
      );
    }
  }

  return start;
}

// ─── Single-Entry Sync ───────────────────────────────────────────────────────

async function markEntrySynced(entryId: string, sampleIds: string[]) {
  await fetch(`/api/consumption/${entryId}/healthkit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      healthkit_synced: true,
      healthkit_sample_ids: sampleIds,
      healthkit_synced_at: new Date().toISOString(),
    }),
  });
}

/** Entries with no macro data (e.g. 800g produce-tracking rows) have nothing to write. */
function hasSyncableMacros(entry: Pick<ConsumptionEntry, 'calories' | 'protein' | 'carbs' | 'fat'>): boolean {
  return entry.calories > 0 || entry.protein > 0 || entry.carbs > 0 || entry.fat > 0;
}

/**
 * Sync a single consumption entry to Apple Health.
 * Fire-and-forget: never throws, never blocks meal logging.
 */
export async function syncEntryToHealthKit(entry: ConsumptionEntry) {
  if (!isHealthKitAvailable()) return;
  if (!hasSyncableMacros(entry)) return;
  if (entry.healthkit_synced && entry.healthkit_sample_ids?.length) return;

  try {
    const enabled = await isHealthKitSyncEnabled();
    if (!enabled) return;

    const result = await writeNutritionRecord({
      mealName: entry.display_name,
      mealType: (entry.meal_type as MealType) || 'snack',
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      consumedAt: resolveHealthKitStartDate(entry.consumed_at, entry.consumed_date),
      fuelrxEntryId: entry.id,
    });

    if (result.success && result.healthKitSampleIds?.length) {
      await markEntrySynced(entry.id, result.healthKitSampleIds);
    }
  } catch (error) {
    console.error('[HealthKit] Sync failed (non-blocking):', error);
  }
}

// ─── Pending-Entry Sweep ─────────────────────────────────────────────────────

interface SyncPendingOptions {
  /** How many days back to look for unsynced entries. Default 7. */
  days?: number;
  /** Bypass the throttle (used by the manual settings backfill). */
  force?: boolean;
  /** Progress callback for UI display. */
  onProgress?: (current: number, total: number) => void;
}

interface SyncPendingResult {
  /** Entries newly written to Apple Health. */
  written: number;
  /** Entries that were already in Apple Health (write succeeded earlier but the DB flag update failed). */
  reconciled: number;
  /** Entries that still failed to write. */
  failed: number;
  total: number;
}

let _lastSweepAt = 0;
let _sweepInFlight = false;
const SWEEP_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Retry-writes every recent consumption entry that never made it into Apple
 * Health. Safe to call often — throttled, deduplicated, and never throws.
 */
export async function syncPendingEntries(
  options: SyncPendingOptions = {}
): Promise<SyncPendingResult | null> {
  const { days = 7, force = false, onProgress } = options;

  if (!isHealthKitAvailable()) return null;
  if (_sweepInFlight) return null;
  if (!force && Date.now() - _lastSweepAt < SWEEP_THROTTLE_MS) return null;

  _sweepInFlight = true;
  try {
    const enabled = await isHealthKitSyncEnabled();
    if (!enabled) return null;
    _lastSweepAt = Date.now();

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const today = getLocalDateString();
    const windowStart = getLocalDateString(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    const { data: entries, error } = await supabase
      .from('meal_consumption_log')
      .select('id, display_name, meal_type, calories, protein, carbs, fat, consumed_at, consumed_date')
      .eq('user_id', user.id)
      .eq('healthkit_synced', false)
      .gte('consumed_date', windowStart)
      .lte('consumed_date', today)
      .order('consumed_at', { ascending: true });

    if (error || !entries?.length) {
      return { written: 0, reconciled: 0, failed: 0, total: 0 };
    }

    const pending = entries.filter(hasSyncableMacros);
    const result: SyncPendingResult = { written: 0, reconciled: 0, failed: 0, total: pending.length };
    if (!pending.length) return result;

    // Duplicate protection: read back what FuelRx already wrote for each
    // involved day. If a write succeeded earlier but the DB flag update
    // failed, we reconcile the flag instead of writing a duplicate.
    const existingByEntryId = new Map<string, string[]>();
    const dates = [...new Set(pending.map((e) => e.consumed_date))];
    for (const date of dates) {
      const samples = await getRecentNutritionRecords(date);
      for (const sample of samples) {
        if (sample.fuelrxEntryId) {
          existingByEntryId.set(sample.fuelrxEntryId, sample.sampleIds);
        }
      }
    }

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];

      const existingSampleIds = existingByEntryId.get(entry.id);
      if (existingSampleIds?.length) {
        await markEntrySynced(entry.id, existingSampleIds);
        result.reconciled++;
      } else {
        const writeResult = await writeNutritionRecord({
          mealName: entry.display_name,
          mealType: (entry.meal_type as MealType) || 'snack',
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          consumedAt: resolveHealthKitStartDate(entry.consumed_at, entry.consumed_date),
          fuelrxEntryId: entry.id,
        });

        if (writeResult.success && writeResult.healthKitSampleIds?.length) {
          await markEntrySynced(entry.id, writeResult.healthKitSampleIds);
          result.written++;
        } else {
          result.failed++;
        }
      }

      onProgress?.(i + 1, pending.length);

      // Small delay between writes to avoid hammering the HealthKit bridge
      if (i < pending.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return result;
  } catch (error) {
    console.error('[HealthKit] Pending sweep failed (non-blocking):', error);
    return null;
  } finally {
    _sweepInFlight = false;
  }
}
