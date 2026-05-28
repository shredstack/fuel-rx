/**
 * Fire an on-time meal celebration on the client.
 *
 * In foreground: two staggered confetti bursts (full rainbow palette). The
 * toast UI is handled by the consumer via showCelebrationToast — this module
 * only owns the visual/native side-effects.
 *
 * In background (rare — the user just tapped Log Meal): schedules a fire-now
 * local notification so iOS surfaces the celebration on lock screen / Apple
 * Watch via standard notification mirroring.
 *
 * Safe no-op on web for the notification path; confetti always fires.
 */

import { Capacitor } from '@capacitor/core';
import type { CelebrationMealType } from '@/lib/meal-reminders/types';

export interface CelebrationPayload {
  meal_type: CelebrationMealType;
  message: string;
}

export type AppState = 'foreground' | 'background';

// Rainbow palette — joyful ROYGBIV burst with an extra pink.
const RAINBOW = [
  '#FF595E', // red
  '#FF924C', // orange
  '#FFCA3A', // yellow
  '#8AC926', // green
  '#1982C4', // blue
  '#6A4C93', // violet
  '#FF6FB5', // pink
];

type LocalNotificationsPlugin = typeof import('@capacitor/local-notifications').LocalNotifications;

let pluginPromise: Promise<LocalNotificationsPlugin | null> | null = null;

async function getLocalNotifications(): Promise<LocalNotificationsPlugin | null> {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return null;
  if (!pluginPromise) {
    pluginPromise = import('@capacitor/local-notifications')
      .then((m) => m.LocalNotifications)
      .catch((err) => {
        console.warn('[celebration] local-notifications unavailable:', err);
        return null;
      });
  }
  return pluginPromise;
}

// canvas-confetti is loaded lazily on first use — matches the existing pattern
// in LogMealClient.tsx (~10KB kept out of the initial bundle).
async function fireConfettiBurst(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const confetti = (await import('canvas-confetti')).default;

    // Two staggered bursts feel more like a shower than a single pop.
    confetti({
      particleCount: 80,
      spread: 90,
      startVelocity: 45,
      origin: { y: 0.6 },
      colors: RAINBOW,
      ticks: 250,
    });
    window.setTimeout(() => {
      void confetti({
        particleCount: 60,
        spread: 110,
        startVelocity: 35,
        origin: { y: 0.65 },
        colors: RAINBOW,
        scalar: 0.9,
        ticks: 200,
      });
    }, 180);
  } catch (err) {
    console.warn('[celebration] canvas-confetti unavailable:', err);
  }
}

async function fireBackgroundNotification(payload: CelebrationPayload): Promise<void> {
  const plugin = await getLocalNotifications();
  if (!plugin) return;
  try {
    await plugin.schedule({
      notifications: [
        {
          // Any unique int that fits in a 32-bit signed slot.
          id: Math.floor(Date.now() / 1000) & 0x7fffffff,
          title: payload.message,
          body: 'Logged on time. Apple Watch high-fives you 🙌',
          schedule: { at: new Date(Date.now() + 100) },
          extra: {
            type: 'meal_on_time_celebration',
            meal_type: payload.meal_type,
          },
        },
      ],
    });
  } catch (err) {
    console.warn('[celebration] schedule failed:', err);
  }
}

/**
 * Fire a celebration's visual + native side-effects. Returns once the burst is
 * dispatched (confetti continues animating after this resolves).
 */
export async function fireMealCelebration(
  payload: CelebrationPayload,
  appState: AppState
): Promise<void> {
  if (appState === 'foreground') {
    await fireConfettiBurst();
  } else {
    await fireBackgroundNotification(payload);
  }
}
