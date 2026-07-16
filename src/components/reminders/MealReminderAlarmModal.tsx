'use client';

/**
 * The blocking, "cannot be ignored" foreground meal reminder modal.
 *
 * It cannot be closed by tapping the backdrop or pressing back — only by one of
 * three actions: Log meal, Snap photo, or (buried, with a confirm) Skip today.
 * While open it pulses sound + haptics.
 */

import { useEffect, useRef, useState } from 'react';
import { AlarmSound } from '@/lib/meal-reminders/alarm-sound';
import {
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type ReminderMealType,
} from '@/lib/meal-reminders/types';

interface Props {
  mealType: ReminderMealType;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** When to give up for the day. Null disables the auto-expiry. */
  expiresAt: Date | null;
  onLogMeal: () => void;
  onSnapPhoto: () => void;
  onSkipToday: () => void;
  /** Called when expiresAt passes while the modal is still open. */
  onExpire: () => void;
}

export default function MealReminderAlarmModal({
  mealType,
  soundEnabled,
  hapticsEnabled,
  expiresAt,
  onLogMeal,
  onSnapPhoto,
  onSkipToday,
  onExpire,
}: Props) {
  const [showOverflow, setShowOverflow] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const alarmRef = useRef<AlarmSound | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  // Start the alarm while the modal is mounted.
  useEffect(() => {
    const alarm = new AlarmSound();
    alarmRef.current = alarm;
    alarm.start(soundEnabled, hapticsEnabled);
    return () => {
      alarm.stop();
      alarmRef.current = null;
    };
  }, [soundEnabled, hapticsEnabled]);

  // Give up when the reminder window has passed — an unattended modal must not
  // keep pulsing sound all night.
  useEffect(() => {
    if (!expiresAt) return;
    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      onExpire();
      return;
    }
    const timeoutId = setTimeout(onExpire, remainingMs);
    return () => clearTimeout(timeoutId);
  }, [expiresAt, onExpire]);

  useEffect(() => {
    if (!showOverflow) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showOverflow]);

  const label = REMINDER_MEAL_LABELS[mealType];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={`${label} reminder`}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Overflow menu trigger */}
        <div ref={overflowRef} className="absolute right-2 top-2">
          <button
            onClick={() => setShowOverflow((v) => !v)}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="More options"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showOverflow && (
            <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  setShowOverflow(false);
                  setConfirmingSkip(true);
                }}
                className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Skip this meal today
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            {REMINDER_MEAL_EMOJI[mealType]}
          </div>
          <h2 className="text-xl font-bold text-gray-900">Time for {label.toLowerCase()}!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Log it or snap a quick pic — I won&apos;t stop reminding you until you do.
          </p>

          {confirmingSkip ? (
            <div className="mt-6 rounded-lg bg-amber-50 p-4 text-left">
              <p className="text-sm font-medium text-amber-900">
                Skip {label.toLowerCase()} for today?
              </p>
              <p className="mt-1 text-xs text-amber-700">
                You won&apos;t be reminded about this meal again until tomorrow.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirmingSkip(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Keep nagging
                </button>
                <button
                  onClick={onSkipToday}
                  className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Skip today
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <button
                onClick={onLogMeal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-4 font-semibold text-white shadow-md transition-all hover:from-primary-600 hover:to-primary-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Log {label.toLowerCase()}
              </button>
              <button
                onClick={onSnapPhoto}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-500 px-4 py-4 font-semibold text-primary-600 transition-all hover:bg-primary-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Snap a photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
