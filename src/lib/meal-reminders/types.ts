/**
 * Meal Reminder + Food Journal shared types
 *
 * Reminders only cover the four "real" meal types (no pre/post workout), since
 * a reminder is something you respond to by eating something.
 */

export type ReminderMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const REMINDER_MEAL_TYPES: ReminderMealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export const REMINDER_MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const REMINDER_MEAL_EMOJI: Record<ReminderMealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
};

/** Per-meal reminder configuration. */
export interface MealReminderConfig {
  enabled: boolean;
  /** "HH:MM" 24-hour, user's local time. */
  start_time: string;
  /** "HH:MM" 24-hour, user's local time. */
  stop_time: string;
  /** How often to re-fire while unresolved. */
  interval_minutes: number;
  sound_enabled: boolean;
  haptics_enabled: boolean;
}

export type MealReminderSettings = Record<ReminderMealType, MealReminderConfig>;

/** Per-meal status for a given date. */
export type ReminderStatus = 'resolved' | 'pending' | 'disabled';

export type MealReminderStatusMap = Record<ReminderMealType, ReminderStatus>;

/** How a reminder was resolved for the day. */
export type ResolutionSource = 'meal_logged' | 'photo_snapped' | 'manual_dismiss';

/** Where a food journal entry came from. */
export type FoodJournalSource = 'manual' | 'reminder_dismiss';

export interface MealReminderResolution {
  id: string;
  user_id: string;
  reminder_date: string;
  meal_type: ReminderMealType;
  resolved_at: string;
  resolution_source: ResolutionSource;
  consumption_log_id: string | null;
  food_journal_entry_id: string | null;
  created_at: string;
}

export interface FoodJournalEntry {
  id: string;
  user_id: string;
  meal_photo_id: string;
  journaled_at: string;
  meal_type: ReminderMealType | null;
  note: string | null;
  source: FoodJournalSource;
  promoted_consumption_log_id: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from meal_photos — a freshly signed URL. Populated by the API. */
  photo_url?: string | null;
}
