'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';
import {
  useMealReminderSettings,
  useUpdateMealReminderSettings,
} from '@/hooks/queries/useMealReminders';
import {
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  validateSettings,
} from '@/lib/meal-reminders/settings';
import {
  fireTestReminder,
  requestNotificationPermission,
  checkNotificationPermission,
  type NotificationPermission,
} from '@/lib/meal-reminders/scheduler';
import {
  REMINDER_MEAL_TYPES,
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type MealReminderConfig,
  type MealReminderSettings,
  type ReminderMealType,
} from '@/lib/meal-reminders/types';

const PaywallModal = dynamic(() => import('@/components/PaywallModal'), { ssr: false });

interface Props {
  hasAccess: boolean;
}

/** A small accessible on/off switch. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function ReminderMealCard({
  mealType,
  config,
  onChange,
}: {
  mealType: ReminderMealType;
  config: MealReminderConfig;
  onChange: (patch: Partial<MealReminderConfig>) => void;
}) {
  const { enabled } = config;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <span aria-hidden="true">{REMINDER_MEAL_EMOJI[mealType]}</span>
          {REMINDER_MEAL_LABELS[mealType]} reminders
        </h3>
        <Toggle
          checked={enabled}
          onChange={(v) => onChange({ enabled: v })}
          label={`Enable ${REMINDER_MEAL_LABELS[mealType]} reminders`}
        />
      </div>

      {enabled && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">Start reminding at</label>
            <input
              type="time"
              value={config.start_time}
              onChange={(e) => onChange({ start_time: e.target.value })}
              className="input-field w-auto"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">Stop reminding at</label>
            <input
              type="time"
              value={config.stop_time}
              onChange={(e) => onChange({ stop_time: e.target.value })}
              className="input-field w-auto"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">Beep every</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_INTERVAL_MINUTES}
                max={MAX_INTERVAL_MINUTES}
                step={5}
                value={config.interval_minutes}
                onChange={(e) =>
                  onChange({ interval_minutes: Number(e.target.value) || MIN_INTERVAL_MINUTES })
                }
                className="input-field w-20 text-center"
              />
              <span className="text-sm text-gray-500">min</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">Sound</label>
            <Toggle
              checked={config.sound_enabled}
              onChange={(v) => onChange({ sound_enabled: v })}
              label={`${REMINDER_MEAL_LABELS[mealType]} sound`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">Haptics</label>
            <Toggle
              checked={config.haptics_enabled}
              onChange={(v) => onChange({ haptics_enabled: v })}
              label={`${REMINDER_MEAL_LABELS[mealType]} haptics`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MealRemindersClient({ hasAccess }: Props) {
  const { data: loadedSettings, isLoading } = useMealReminderSettings();
  const updateMutation = useUpdateMealReminderSettings();

  const [draft, setDraft] = useState<MealReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Seed the editable draft once settings load.
  useEffect(() => {
    if (loadedSettings && !draft) setDraft(loadedSettings);
  }, [loadedSettings, draft]);

  // Surface current notification permission (no-op / 'unsupported' on web).
  useEffect(() => {
    void checkNotificationPermission().then(setPermission);
  }, []);

  const updateMeal = (mealType: ReminderMealType, patch: Partial<MealReminderConfig>) => {
    setSaved(false);
    setError(null);
    setDraft((prev) =>
      prev ? { ...prev, [mealType]: { ...prev[mealType], ...patch } } : prev
    );
    // First time a user enables a reminder, ask for notification permission.
    if (patch.enabled === true) {
      void requestNotificationPermission().then(setPermission);
    }
  };

  const isDirty = useMemo(
    () => !!draft && !!loadedSettings && JSON.stringify(draft) !== JSON.stringify(loadedSettings),
    [draft, loadedSettings]
  );

  const handleSave = async () => {
    if (!draft) return;
    const validationError = validateSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync(draft);
      setSaved(true);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 402) {
        setShowPaywall(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save settings');
      }
    }
  };

  const handleTest = async () => {
    setTestStatus(null);
    const result = await fireTestReminder(true);
    if (result === 'granted') {
      setTestStatus('Test reminder scheduled — watch for it in ~5 seconds.');
    } else if (result === 'denied') {
      setTestStatus('Notifications are turned off. Enable them in iOS Settings → FuelRx.');
    } else {
      setTestStatus('Test reminders only work in the FuelRx mobile app.');
    }
  };

  const showPermissionWarning =
    permission === 'denied' &&
    !!draft &&
    REMINDER_MEAL_TYPES.some((m) => draft[m].enabled);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/profile" className="text-gray-600 hover:text-gray-900">
            ← Profile
          </Link>
          <h1 className="text-2xl font-bold text-primary-600">Meal Reminders</h1>
        </div>

        <p className="mb-6 text-sm text-gray-600">
          Persistent nudges that keep reminding you until you log a meal or snap a photo —
          built for the days it&apos;s easy to forget to eat.
        </p>

        {isLoading || !draft ? (
          <div className="card text-center text-gray-500">Loading…</div>
        ) : (
          <div className="relative">
            {/* Paywall overlay for non-subscribers */}
            {!hasAccess && (
              <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
                <div className="mt-12 max-w-xs rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg">
                  <div className="mb-2 text-3xl">🔔</div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Meal reminders are a premium feature
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Subscribe to unlock persistent reminders that keep you on track.
                  </p>
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="btn-primary mt-4 w-full"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            )}

            <div
              className={
                !hasAccess ? 'pointer-events-none select-none opacity-60' : undefined
              }
            >
              {showPermissionWarning && (
                <div className="card mb-4 border-amber-200 bg-amber-50">
                  <p className="text-sm font-medium text-amber-900">
                    Notifications are turned off
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Reminders need notification permission. Open iOS Settings → FuelRx →
                    Notifications to turn them on.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {REMINDER_MEAL_TYPES.map((mealType) => (
                  <ReminderMealCard
                    key={mealType}
                    mealType={mealType}
                    config={draft[mealType]}
                    onChange={(patch) => updateMeal(mealType, patch)}
                  />
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              {saved && !isDirty && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Reminders saved.
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || !isDirty}
                className="btn-primary mt-4 w-full"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save reminders'}
              </button>

              {/* Footer: test + Focus mode info */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleTest}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Test reminder now
                </button>
                {testStatus && (
                  <p className="text-center text-xs text-gray-500">{testStatus}</p>
                )}
                <div className="card bg-blue-50 text-sm text-blue-800">
                  <p className="font-medium">📵 Using a Focus mode?</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Your iPhone&apos;s Focus modes can silence FuelRx. To make sure reminders
                    get through, add FuelRx to your allowed apps in Settings → Focus.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showPaywall && <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />}
      <MobileTabBar />
    </div>
  );
}
