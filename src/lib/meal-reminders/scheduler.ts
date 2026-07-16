/**
 * Local notification scheduler for meal reminders.
 *
 * iOS allows at most 64 scheduled local notifications per app and gives us no
 * way to cancel one while backgrounded. So we pre-schedule a *finite batch* of
 * notifications between start_time and stop_time for each enabled, unresolved
 * meal, and cancel-and-replace whenever config or resolution state changes.
 *
 * Notification ids are deterministic per (meal_type, slot index) so a specific
 * meal's batch can be cancelled precisely:
 *   breakfast 10000-10015 | lunch 20000-20015 | dinner 30000-30015 | snack 40000-40015
 *
 * Every function is a safe no-op on web / when the plugin is unavailable, so
 * callers never need their own platform guard.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { computeFireTimes, getLocalDateString } from './fire-times';
import { MAX_SLOTS_PER_MEAL } from './settings';
import { isReminderMealType } from './resolution-service';
import {
  REMINDER_MEAL_TYPES,
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type MealReminderSettings,
  type MealReminderStatusMap,
  type ReminderMealType,
} from './types';

export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface ReminderDiagnostics {
  isNative: boolean;
  pluginAvailable: boolean;
  permission: NotificationPermission;
  lastError: string | null;
}

const MEAL_ID_BASE: Record<ReminderMealType, number> = {
  breakfast: 10000,
  lunch: 20000,
  dinner: 30000,
  snack: 40000,
};
const TEST_NOTIFICATION_ID = 99999;
const SOUND_FILE = 'reminder.wav';
const REMINDER_BODY = "Tap to log it or snap a pic — I won't stop until you do.";

// Last error from any plugin call — surfaced via getDiagnostics() so the
// Meal Reminders page can show *why* notifications aren't working instead of a
// generic "unsupported" state.
let lastError: string | null = null;

function recordError(where: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  lastError = `${where}: ${message}`;
  console.error(`[reminder-scheduler] ${where} failed:`, err);
}

/**
 * Plugin is only callable on a native platform AND when the native side
 * actually registered the LocalNotifications class. The JS import always
 * succeeds (it's a Capacitor proxy), so `isPluginAvailable` is the only
 * reliable signal that the native binary has the plugin baked in.
 */
function getPlugin(): typeof LocalNotifications | null {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return null;
  if (!Capacitor.isPluginAvailable('LocalNotifications')) {
    lastError =
      'LocalNotifications plugin is not registered in this native build. The App Store binary needs `npx cap sync ios` + a rebuild.';
    return null;
  }
  return LocalNotifications;
}

function mapPermission(display: string): NotificationPermission {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'prompt';
}

/**
 * Snapshot of the notification subsystem state for the UI. Safe to call on web
 * or native — never throws.
 */
export async function getDiagnostics(): Promise<ReminderDiagnostics> {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const pluginAvailable = isNative && Capacitor.isPluginAvailable('LocalNotifications');
  const permission = await checkNotificationPermission();
  return { isNative, pluginAvailable, permission, lastError };
}

/** Is this notification id one we manage? */
function isReminderId(id: number): boolean {
  if (id === TEST_NOTIFICATION_ID) return true;
  return REMINDER_MEAL_TYPES.some((m) => {
    const base = MEAL_ID_BASE[m];
    return id >= base && id < base + MAX_SLOTS_PER_MEAL;
  });
}

export async function checkNotificationPermission(): Promise<NotificationPermission> {
  const plugin = getPlugin();
  if (!plugin) return 'unsupported';
  try {
    const res = await plugin.checkPermissions();
    return mapPermission(res.display);
  } catch (err) {
    recordError('checkPermissions', err);
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const plugin = getPlugin();
  if (!plugin) return 'unsupported';
  try {
    const res = await plugin.requestPermissions();
    return mapPermission(res.display);
  } catch (err) {
    recordError('requestPermissions', err);
    return 'unsupported';
  }
}

/** Cancel every reminder notification we may have scheduled. */
export async function cancelAllReminders(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    const pending = await plugin.getPending();
    const ids = pending.notifications.filter((n) => isReminderId(n.id)).map((n) => ({ id: n.id }));
    if (ids.length > 0) {
      await plugin.cancel({ notifications: ids });
    }
  } catch (err) {
    recordError('cancelAllReminders', err);
  }
}

/** Cancel the full scheduled batch for a single meal type. */
export async function cancelMealReminders(mealType: ReminderMealType): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  const base = MEAL_ID_BASE[mealType];
  const ids = Array.from({ length: MAX_SLOTS_PER_MEAL }, (_, i) => ({ id: base + i }));
  try {
    // Cancelling ids that aren't actually scheduled is harmless.
    await plugin.cancel({ notifications: ids });
  } catch (err) {
    recordError(`cancelMealReminders(${mealType})`, err);
  }
}

// syncSchedule is a read-modify-write (getPending -> cancel -> schedule); two
// overlapping invalidations could interleave those steps. Serialize runs.
let syncChain: Promise<void> = Promise.resolve();

/**
 * Cancel-and-replace the entire scheduled batch for today.
 *
 * Top-level entry point: schedules notifications for every enabled, unresolved
 * meal between now and its stop_time. A no-op without notification permission.
 * Concurrent calls are queued so batches never interleave.
 */
export function syncSchedule(
  settings: MealReminderSettings,
  status: MealReminderStatusMap,
  dateStr: string = getLocalDateString()
): Promise<void> {
  const run = () => doSyncSchedule(settings, status, dateStr);
  syncChain = syncChain.then(run, run);
  return syncChain;
}

async function doSyncSchedule(
  settings: MealReminderSettings,
  status: MealReminderStatusMap,
  dateStr: string
): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;

  const permission = await checkNotificationPermission();
  if (permission !== 'granted') {
    // Without permission nothing can fire — make sure nothing lingers.
    await cancelAllReminders();
    return;
  }

  await cancelAllReminders();

  const now = new Date();
  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    sound?: string;
    extra: Record<string, unknown>;
  }> = [];

  for (const mealType of REMINDER_MEAL_TYPES) {
    const config = settings[mealType];
    if (!config.enabled) continue;
    if (status[mealType] === 'resolved') continue;

    const fireTimes = computeFireTimes(config, dateStr);
    fireTimes.forEach((at, slotIndex) => {
      if (at <= now) return; // Past times can't be scheduled.
      notifications.push({
        id: MEAL_ID_BASE[mealType] + slotIndex,
        title: `${REMINDER_MEAL_EMOJI[mealType]} ${REMINDER_MEAL_LABELS[mealType]} reminder`,
        body: REMINDER_BODY,
        schedule: { at },
        sound: config.sound_enabled ? SOUND_FILE : undefined,
        extra: { type: 'meal_reminder', meal_type: mealType, date: dateStr },
      });
    });
  }

  if (notifications.length > 0) {
    try {
      await plugin.schedule({ notifications });
    } catch (err) {
      recordError('schedule', err);
    }
  }
}

/**
 * Schedule a single test notification ~5s out so users can verify that
 * permissions and sound are working. Returns the resulting permission state.
 */
export async function fireTestReminder(soundEnabled = true): Promise<NotificationPermission> {
  const plugin = getPlugin();
  if (!plugin) return 'unsupported';

  let permission = await checkNotificationPermission();
  if (permission === 'prompt') {
    permission = await requestNotificationPermission();
  }
  if (permission !== 'granted') return permission;

  try {
    await plugin.schedule({
      notifications: [
        {
          id: TEST_NOTIFICATION_ID,
          title: '🔔 Test reminder',
          body: 'If you can see and hear this, FuelRx reminders are working!',
          schedule: { at: new Date(Date.now() + 5000) },
          sound: soundEnabled ? SOUND_FILE : undefined,
          extra: { type: 'meal_reminder_test' },
        },
      ],
    });
  } catch (err) {
    recordError('fireTestReminder.schedule', err);
  }
  return 'granted';
}

/**
 * Register a handler for notification taps. Resolves to a cleanup function.
 * No-op (returns a no-op cleanup) on web or if the plugin rejects — important
 * for older installed iOS builds that don't have the plugin registered yet.
 */
export async function addReminderTapListener(
  handler: (mealType: ReminderMealType, date: string) => void
): Promise<() => void> {
  const plugin = getPlugin();
  if (!plugin) return () => {};

  try {
    const listener = await plugin.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra as
        | { type?: string; meal_type?: string; date?: string }
        | undefined;
      if (extra?.type === 'meal_reminder' && isReminderMealType(extra.meal_type)) {
        handler(extra.meal_type, extra.date ?? getLocalDateString());
      }
    });

    return () => {
      try {
        listener.remove();
      } catch {
        // Removing a listener that's already gone is harmless.
      }
    };
  } catch (err) {
    recordError('addReminderTapListener', err);
    return () => {};
  }
}
