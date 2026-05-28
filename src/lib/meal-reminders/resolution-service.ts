/**
 * Meal reminder resolution service.
 *
 * A reminder is "resolved" for a (user, date, meal_type) by exactly one action.
 * This helper is shared by the resolve API route, the food-journal route, and
 * the server-side hook on POST /api/consumption.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MealReminderResolution, ReminderMealType, ResolutionSource } from './types';

export interface UpsertResolutionParams {
  userId: string;
  /** User's local date as "YYYY-MM-DD". */
  reminderDate: string;
  mealType: ReminderMealType;
  source: ResolutionSource;
  consumptionLogId?: string | null;
  foodJournalEntryId?: string | null;
}

/**
 * Idempotently record that a meal reminder was resolved.
 *
 * Relies on the (user_id, reminder_date, meal_type) unique constraint: if a
 * resolution already exists it is left untouched and returned as-is.
 */
export async function upsertResolution(
  supabase: SupabaseClient,
  params: UpsertResolutionParams
): Promise<MealReminderResolution> {
  const row = {
    user_id: params.userId,
    reminder_date: params.reminderDate,
    meal_type: params.mealType,
    resolution_source: params.source,
    consumption_log_id: params.consumptionLogId ?? null,
    food_journal_entry_id: params.foodJournalEntryId ?? null,
  };

  // ignoreDuplicates: leave any existing resolution intact (the first action
  // that resolved the meal wins — we don't overwrite a snap with a later log).
  const { data: inserted, error: insertError } = await supabase
    .from('meal_reminder_resolutions')
    .upsert(row, {
      onConflict: 'user_id,reminder_date,meal_type',
      ignoreDuplicates: true,
    })
    .select('*')
    .maybeSingle();

  if (insertError) {
    throw new Error(`Failed to record reminder resolution: ${insertError.message}`);
  }
  if (inserted) return inserted as MealReminderResolution;

  // Conflict — a resolution already existed. Return it.
  const { data: existing, error: selectError } = await supabase
    .from('meal_reminder_resolutions')
    .select('*')
    .eq('user_id', params.userId)
    .eq('reminder_date', params.reminderDate)
    .eq('meal_type', params.mealType)
    .single();

  if (selectError || !existing) {
    throw new Error(
      `Failed to load existing reminder resolution: ${selectError?.message ?? 'not found'}`
    );
  }
  return existing as MealReminderResolution;
}

/** Reminder meal types are a subset of the app's full MealType union. */
export function isReminderMealType(value: string | null | undefined): value is ReminderMealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}
