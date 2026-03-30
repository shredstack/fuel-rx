'use client';

import { useState } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useHealthKitSyncStatus } from '@/hooks/queries/useHealthKitSyncStatus';
import { useSubscription } from '@/hooks/useSubscription';
import { presentPaywall } from '@/lib/revenuecat';
import { createClient } from '@/lib/supabase/client';
import { isHealthKitAvailable } from '@/lib/healthkit';
import type { UserProfile } from '@/lib/types';


interface AppleHealthSettingsProps {
  profile: UserProfile;
}

export default function AppleHealthSettings({ profile }: AppleHealthSettingsProps) {
  const { isIOS, isNative } = usePlatform();
  const { isSubscribed } = useSubscription();
  const [syncEnabled, setSyncEnabled] = useState(
    profile.healthkit_nutrition_sync_enabled ?? false
  );
  const { requestPermissions } = useHealthKit({ syncEnabled });
  const { data: syncStatus } = useHealthKitSyncStatus(syncEnabled);

  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Don't render unless on iOS native with the HealthKit plugin available.
  // This also hides the toggle on old native builds that lack the plugin.
  if (!isIOS || !isNative || !isHealthKitAvailable()) {
    return null;
  }

  const updateProfileSyncPref = async (enabled: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({ healthkit_nutrition_sync_enabled: enabled })
      .eq('id', profile.id);

    if (error) throw error;
  };

  const handleToggle = async () => {
    setError(null);
    setToggling(true);

    try {
      if (!syncEnabled) {
        // Enabling sync — check subscription first
        if (!isSubscribed) {
          const result = await presentPaywall();
          if (!result.purchased) {
            setToggling(false);
            return;
          }
        }

        // Request HealthKit permissions
        const permResult = await requestPermissions();
        if (!permResult.granted) {
          setError(
            'HealthKit access was not granted. You can enable it in iPhone Settings > Privacy & Security > Health > FuelRx.'
          );
          setToggling(false);
          return;
        }

        await updateProfileSyncPref(true);
        setSyncEnabled(true);
        setShowBackfill(true);
      } else {
        // Disabling sync
        await updateProfileSyncPref(false);
        setSyncEnabled(false);
      }
    } catch (err) {
      console.error('[AppleHealth] Toggle error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setShowBackfill(false);

    try {
      // Fetch recent entries for backfill
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const supabase = createClient();
      const { data: entries } = await supabase
        .from('meal_consumption_log')
        .select('id, display_name, meal_type, calories, protein, carbs, fat, consumed_at')
        .eq('user_id', profile.id)
        .eq('healthkit_synced', false)
        .gte('consumed_date', sevenDaysAgo)
        .lte('consumed_date', today)
        .order('consumed_at', { ascending: true });

      if (!entries?.length) {
        setBackfilling(false);
        return;
      }

      setBackfillProgress({ current: 0, total: entries.length });

      const { writeNutritionRecord } = await import('@/lib/healthkit');

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const result = await writeNutritionRecord({
          mealName: entry.display_name,
          mealType: entry.meal_type || 'snack',
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          consumedAt: new Date(entry.consumed_at),
          fuelrxEntryId: entry.id,
        });

        if (result.success && result.healthKitSampleIds?.length) {
          await fetch(`/api/consumption/${entry.id}/healthkit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              healthkit_synced: true,
              healthkit_sample_ids: result.healthKitSampleIds,
              healthkit_synced_at: new Date().toISOString(),
            }),
          });
        }

        setBackfillProgress({ current: i + 1, total: entries.length });

        // Small delay between writes
        if (i < entries.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      console.error('[AppleHealth] Backfill error:', err);
    } finally {
      setBackfilling(false);
      setBackfillProgress(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Apple Health
      </h2>

      {/* Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex-1 mr-4">
          <h3 className="font-medium text-gray-900">Nutrition Sync</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatically write meal nutrition data to Apple Health when you log
            meals.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            syncEnabled ? 'bg-green-500' : 'bg-gray-200'
          } ${toggling ? 'opacity-50' : ''}`}
          aria-label="Toggle Apple Health nutrition sync"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              syncEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Info when enabled */}
      {syncEnabled && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-400">
            This lets apps like Oura Ring see your meal data alongside sleep and
            recovery. Only FuelRx-logged meals are synced. We don&apos;t read or
            modify other health data.
          </p>

          {/* Sync status */}
          {syncStatus && syncStatus.totalSynced > 0 && (
            <p className="text-sm text-gray-500">
              {syncStatus.totalSynced} meal
              {syncStatus.totalSynced !== 1 ? 's' : ''} synced this month
            </p>
          )}

          {/* Oura help tip */}
          <details className="text-sm">
            <summary className="text-gray-500 cursor-pointer">
              How to see meals in Oura
            </summary>
            <ol className="mt-2 ml-4 list-decimal text-gray-500 space-y-1 text-xs">
              <li>Open the Oura app</li>
              <li>
                Go to{' '}
                <span className="font-medium">Settings &gt; Integrations</span>
              </li>
              <li>Connect Apple Health</li>
              <li>
                Make sure <span className="font-medium">Nutrition</span> is
                enabled
              </li>
            </ol>
          </details>
        </div>
      )}

      {/* Backfill prompt */}
      {showBackfill && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">
            Want to sync your recent meals from the past 7 days to Apple Health?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBackfill}
              className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-sm font-medium rounded-lg"
            >
              Sync Recent Meals
            </button>
            <button
              onClick={() => setShowBackfill(false)}
              className="flex-1 py-1.5 px-3 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300"
            >
              Just Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Backfill progress */}
      {backfilling && backfillProgress && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Syncing meals... {backfillProgress.current}/{backfillProgress.total}
          </p>
          <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{
                width: `${(backfillProgress.current / backfillProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
