/**
 * Fire-time computation for meal reminders.
 *
 * Pure, dependency-free, and testable in isolation. Both the local-notification
 * scheduler and the in-app ticker depend on this so the two stay consistent.
 */

import { MAX_SLOTS_PER_MEAL, timeToMinutes } from './settings';
import type { MealReminderConfig } from './types';

/**
 * Compute every reminder fire time for a meal on a given local date.
 *
 * @param config  The meal's reminder configuration.
 * @param dateStr The local date as "YYYY-MM-DD".
 * @returns Date objects in local time, in ascending order. Capped at
 *          MAX_SLOTS_PER_MEAL. Empty if the meal is disabled or misconfigured.
 */
export function computeFireTimes(config: MealReminderConfig, dateStr: string): Date[] {
  if (!config.enabled) return [];

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return [];

  const startMin = timeToMinutes(config.start_time);
  const stopMin = timeToMinutes(config.stop_time);
  const interval = config.interval_minutes;

  if (interval <= 0 || stopMin <= startMin) return [];

  const times: Date[] = [];
  for (
    let minutes = startMin;
    minutes <= stopMin && times.length < MAX_SLOTS_PER_MEAL;
    minutes += interval
  ) {
    times.push(new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0));
  }
  return times;
}

/** Today's local date as "YYYY-MM-DD". */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * When an open alarm should give up for the day: one interval past the meal's
 * final fire time. Without a cutoff, an unattended modal (e.g. a forgotten
 * browser tab) would keep pulsing sound all night.
 */
export function getAlarmExpiry(config: MealReminderConfig, dateStr: string): Date | null {
  const times = computeFireTimes(config, dateStr);
  if (times.length === 0) return null;
  const last = times[times.length - 1];
  return new Date(last.getTime() + config.interval_minutes * 60_000);
}

/**
 * True if a meal is inside its active reminder window right now — i.e. at least
 * one fire time has passed and we haven't gone past the final fire time. Used to
 * reconcile on app launch/resume (e.g. the app was killed while a reminder was
 * mid-nag).
 */
export function isMealCurrentlyDue(
  config: MealReminderConfig,
  dateStr: string,
  now: Date = new Date()
): boolean {
  const times = computeFireTimes(config, dateStr);
  if (times.length === 0) return false;
  return now >= times[0] && now <= times[times.length - 1];
}
