/**
 * Curated celebration messages for the on-time meal celebration feature.
 *
 * Server-side picker — keeping it on the server lets us evolve the pool
 * centrally and guarantees the in-app toast and the OS notification body
 * always match (the picked message is stored on the row).
 */

import type { CelebrationMealType } from '@/lib/meal-reminders/types';

const POOL: Record<CelebrationMealType, readonly string[]> = {
  breakfast: [
    '🎉 Breakfast champion!',
    '🥞 Crushed it before the morning got away.',
    '🌅 Morning win — keep it rolling.',
    '☀️ On the board early. Nice work.',
  ],
  lunch: [
    '🥗 Lunch logged like a boss.',
    '🍱 Midday checkmark — done.',
    '⏰ On-time lunch. Future-you thanks you.',
    '🎯 Bullseye on lunch.',
  ],
  dinner: [
    '🍝 Dinner in the books.',
    '🌙 Wrapped before bed — perfect.',
    '🏁 Three for three? Look at you.',
    '✨ Closing the day strong.',
  ],
};

/** Pick a celebration message uniformly at random. */
export function pickCelebrationMessage(mealType: CelebrationMealType): string {
  const pool = POOL[mealType];
  return pool[Math.floor(Math.random() * pool.length)];
}
