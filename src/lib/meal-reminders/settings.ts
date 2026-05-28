/**
 * Meal reminder settings: defaults, defensive merging, and validation.
 *
 * Validation is enforced here (in the API route) rather than in SQL so we can
 * return friendly error messages. `mergeWithDefaults` never throws — a malformed
 * JSON blob in the DB falls back to defaults field-by-field.
 */

import {
  REMINDER_MEAL_TYPES,
  type MealReminderConfig,
  type MealReminderSettings,
  type ReminderMealType,
} from './types';

export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 120;
/**
 * Max scheduled notifications per meal. Four meals × 16 = 64, the iOS
 * per-app local-notification cap.
 */
export const MAX_SLOTS_PER_MEAL = 16;

/** Matches the column default in the migration. */
export const DEFAULT_REMINDER_SETTINGS: MealReminderSettings = {
  breakfast: { enabled: false, start_time: '08:00', stop_time: '10:00', interval_minutes: 15, sound_enabled: true, haptics_enabled: true },
  lunch: { enabled: false, start_time: '12:00', stop_time: '14:00', interval_minutes: 15, sound_enabled: true, haptics_enabled: true },
  dinner: { enabled: false, start_time: '18:00', stop_time: '20:00', interval_minutes: 15, sound_enabled: true, haptics_enabled: true },
  snack: { enabled: false, start_time: '15:00', stop_time: '16:00', interval_minutes: 30, sound_enabled: true, haptics_enabled: true },
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Minutes since midnight for a "HH:MM" string. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Merge an unknown value (e.g. a DB JSONB blob) into a fully-formed settings
 * object, applying defaults field-by-field. Never throws.
 */
export function mergeWithDefaults(raw: unknown): MealReminderSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result = {} as MealReminderSettings;

  for (const mealType of REMINDER_MEAL_TYPES) {
    const fallback = DEFAULT_REMINDER_SETTINGS[mealType];
    const partial = (source[mealType] && typeof source[mealType] === 'object'
      ? source[mealType]
      : {}) as Record<string, unknown>;

    result[mealType] = {
      enabled: typeof partial.enabled === 'boolean' ? partial.enabled : fallback.enabled,
      start_time: isValidTime(partial.start_time) ? partial.start_time : fallback.start_time,
      stop_time: isValidTime(partial.stop_time) ? partial.stop_time : fallback.stop_time,
      interval_minutes:
        typeof partial.interval_minutes === 'number' && Number.isFinite(partial.interval_minutes)
          ? partial.interval_minutes
          : fallback.interval_minutes,
      sound_enabled:
        typeof partial.sound_enabled === 'boolean' ? partial.sound_enabled : fallback.sound_enabled,
      haptics_enabled:
        typeof partial.haptics_enabled === 'boolean'
          ? partial.haptics_enabled
          : fallback.haptics_enabled,
    };
  }

  return result;
}

/** Number of notification slots a meal config would schedule for one day. */
export function countSlots(config: MealReminderConfig): number {
  const start = timeToMinutes(config.start_time);
  const stop = timeToMinutes(config.stop_time);
  if (config.interval_minutes <= 0 || stop <= start) return 0;
  return Math.floor((stop - start) / config.interval_minutes) + 1;
}

/**
 * Validate a single meal config. Returns an error message, or null if valid.
 * Disabled meals are not validated (the form may hold partial values).
 */
export function validateMealConfig(
  mealType: ReminderMealType,
  config: MealReminderConfig
): string | null {
  if (!config.enabled) return null;

  if (!isValidTime(config.start_time) || !isValidTime(config.stop_time)) {
    return `${mealType}: start and stop times must be valid HH:MM values`;
  }
  if (
    !Number.isInteger(config.interval_minutes) ||
    config.interval_minutes < MIN_INTERVAL_MINUTES ||
    config.interval_minutes > MAX_INTERVAL_MINUTES
  ) {
    return `${mealType}: interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes`;
  }
  if (timeToMinutes(config.stop_time) <= timeToMinutes(config.start_time)) {
    return `${mealType}: stop time must be after start time`;
  }
  if (countSlots(config) > MAX_SLOTS_PER_MEAL) {
    return `${mealType}: that schedule produces too many reminders — widen the interval or shorten the window (max ${MAX_SLOTS_PER_MEAL})`;
  }
  return null;
}

/** Validate the whole settings object. Returns an error message, or null. */
export function validateSettings(settings: MealReminderSettings): string | null {
  for (const mealType of REMINDER_MEAL_TYPES) {
    const error = validateMealConfig(mealType, settings[mealType]);
    if (error) return error;
  }
  return null;
}

/** True if at least one meal reminder is enabled. */
export function hasAnyEnabled(settings: MealReminderSettings): boolean {
  return REMINDER_MEAL_TYPES.some((m) => settings[m].enabled);
}
