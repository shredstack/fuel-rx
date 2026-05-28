'use client';

/**
 * Toast surface for the on-time meal celebration.
 *
 * A full-width card that slides in from the top with the message + emoji,
 * auto-dismisses after ~3.2s. Tap to dismiss earlier. Lives at the layout
 * level (via CelebrationProvider) so any screen can trigger it, not just
 * /log-meal.
 */

import { useEffect } from 'react';
import {
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type CelebrationMealType,
} from '@/lib/meal-reminders/types';

export interface MealCelebrationToastProps {
  mealType: CelebrationMealType;
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. Defaults to 3200. */
  durationMs?: number;
}

export default function MealCelebrationToast({
  mealType,
  message,
  onDismiss,
  durationMs = 3200,
}: MealCelebrationToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[1000] flex justify-center px-4"
      style={{
        // Sit just below the safe area / status bar so notch devices don't clip it.
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss celebration"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left shadow-2xl ring-1 ring-black/5 transition-all animate-slide-down-fade"
      >
        <span className="text-2xl" aria-hidden="true">
          {REMINDER_MEAL_EMOJI[mealType]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{message}</p>
          <p className="text-xs text-gray-500">
            {REMINDER_MEAL_LABELS[mealType]} logged on time
          </p>
        </div>
        <span className="text-xl" aria-hidden="true">
          🎉
        </span>
      </button>
    </div>
  );
}
