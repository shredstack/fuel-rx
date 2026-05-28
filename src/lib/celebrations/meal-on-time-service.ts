/**
 * Meal on-time celebration service.
 *
 * Server-side hook invoked from POST /api/consumption after a successful meal
 * log. Decides whether the log qualifies for a celebration, inserts the
 * (idempotent) celebration row, and returns it so the API response can carry
 * the celebration payload back to the client for an inline confetti burst.
 *
 * Treats every internal error as "no celebration" — a celebration failure must
 * never break the meal log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isCelebrationMealType,
  type MealOnTimeCelebration,
  type MealReminderSettings,
} from '@/lib/meal-reminders/types';
import { mergeWithDefaults, timeToMinutes } from '@/lib/meal-reminders/settings';
import { pickCelebrationMessage } from './meal-on-time-messages';

export interface CelebrationContext {
  userId: string;
  mealType: string | null | undefined;
  /** consumed_at as the client sent it. Local-time format preferred (no Z). */
  consumedAt: string;
  /** consumed_date as stored on the meal_consumption_log row. */
  consumedDate: string;
  consumptionLogId: string;
}

/**
 * Extract the local "HH:MM" time-of-day from a consumed_at string.
 *
 * The client sends consumed_at as either:
 *   1. `YYYY-MM-DDTHH:MM:SS`        (local-time, no offset — preferred)
 *   2. `YYYY-MM-DDTHH:MM:SS.sssZ`   (UTC ISO from `new Date().toISOString()`)
 *
 * For (1) we can read the time portion directly and avoid any TZ math. For (2)
 * we fall back to extracting the substring — server-side `getHours()` would
 * give UTC hours which is wrong for everyone outside UTC. Reading the substring
 * is at least correct for users in UTC and a small over/under-count elsewhere.
 *
 * Returns null if the string is unparseable.
 */
export function extractLocalTime(consumedAt: string): string | null {
  // Match the time portion straight out of the ISO-like string.
  const match = consumedAt.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

/**
 * Decide whether a freshly logged meal qualifies for an on-time celebration
 * and, if so, insert the row.
 *
 * The unique constraint on (user_id, celebration_date, meal_type) makes the
 * insert idempotent: a second log on the same day swallows the conflict and
 * returns null (the client sees no `celebration` payload and skips confetti).
 *
 * Returns the inserted row, or null when there's no celebration to fire.
 */
export async function celebrateIfOnTime(
  supabase: SupabaseClient,
  ctx: CelebrationContext,
  hasReminderAccess: boolean
): Promise<MealOnTimeCelebration | null> {
  if (!hasReminderAccess) return null;
  if (!isCelebrationMealType(ctx.mealType)) return null;

  // Load this user's settings to check the per-meal target + toggle.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('meal_reminder_settings')
    .eq('id', ctx.userId)
    .single();

  const settings: MealReminderSettings = mergeWithDefaults(profile?.meal_reminder_settings);
  const mealConfig = settings[ctx.mealType];
  if (!mealConfig.celebrate_on_time || !mealConfig.on_time_target) return null;

  const loggedLocalTime = extractLocalTime(ctx.consumedAt);
  if (!loggedLocalTime) return null;

  // The target time counts as on-time. Inclusive comparison.
  if (timeToMinutes(loggedLocalTime) > timeToMinutes(mealConfig.on_time_target)) {
    return null;
  }

  const message = pickCelebrationMessage(ctx.mealType);

  const { data: inserted, error: insertError } = await supabase
    .from('meal_on_time_celebrations')
    .insert({
      user_id: ctx.userId,
      celebration_date: ctx.consumedDate,
      meal_type: ctx.mealType,
      logged_at: ctx.consumedAt,
      target_time: mealConfig.on_time_target,
      message,
      consumption_log_id: ctx.consumptionLogId,
    })
    .select('*')
    .maybeSingle();

  // Unique-constraint conflict (already celebrated today) returns null with no
  // error from .maybeSingle(). Other errors fall through to null too — a
  // failed celebration write must not block the meal log response.
  if (insertError || !inserted) {
    if (insertError && !isConflict(insertError)) {
      console.error('[meal-on-time] insert failed:', insertError);
    }
    return null;
  }

  return inserted as MealOnTimeCelebration;
}

interface PostgrestError {
  code?: string;
}

function isConflict(error: unknown): boolean {
  return (error as PostgrestError | null)?.code === '23505';
}
