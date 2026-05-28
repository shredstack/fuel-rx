'use client';

/**
 * In-app meal reminder ticker.
 *
 * While the app is foregrounded, OS notifications still fire from the
 * pre-scheduled batch, but we also want the blocking in-app modal to appear the
 * moment a fire time is crossed. This hook polls every 30s (fine granularity for
 * minute-level reminders) and invokes `onFire` when a meal crosses a fire time
 * while still unresolved.
 */

import { useEffect, useRef } from 'react';
import { computeFireTimes } from '@/lib/meal-reminders/fire-times';
import { REMINDER_MEAL_TYPES } from '@/lib/meal-reminders/types';
import type {
  MealReminderSettings,
  MealReminderStatusMap,
  ReminderMealType,
} from '@/lib/meal-reminders/types';

const TICK_INTERVAL_MS = 30_000;

interface TickerOptions {
  settings: MealReminderSettings | undefined;
  status: MealReminderStatusMap | undefined;
  /** Local date the settings/status apply to ("YYYY-MM-DD"). */
  dateStr: string;
  /** Called with the meal type when a fire time is crossed. */
  onFire: (mealType: ReminderMealType) => void;
  /** Pause ticking (e.g. while a modal is already open). */
  paused?: boolean;
}

export function useMealReminderTicker({
  settings,
  status,
  dateStr,
  onFire,
  paused = false,
}: TickerOptions): void {
  const lastTickRef = useRef<Date>(new Date());
  // Keep the latest onFire without re-arming the interval each render.
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  useEffect(() => {
    if (!settings || !status || paused) return;

    const check = () => {
      const now = new Date();
      const lastTick = lastTickRef.current;

      for (const mealType of REMINDER_MEAL_TYPES) {
        if (!settings[mealType].enabled) continue;
        if (status[mealType] !== 'pending') continue;

        const fireTimes = computeFireTimes(settings[mealType], dateStr);
        const justCrossed = fireTimes.some((t) => t > lastTick && t <= now);
        if (justCrossed) {
          onFireRef.current(mealType);
          break; // one modal at a time
        }
      }

      lastTickRef.current = now;
    };

    const intervalId = setInterval(check, TICK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [settings, status, dateStr, paused]);
}
