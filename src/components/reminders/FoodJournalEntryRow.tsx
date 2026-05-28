'use client';

/**
 * A single Food Journal entry row — thumbnail, time, meal type, note, and
 * badges for reminder-dismissal / promoted state. Used by the journal panel and
 * the full-page history.
 */

import {
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type FoodJournalEntry,
} from '@/lib/meal-reminders/types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FoodJournalEntryRow({
  entry,
  onClick,
}: {
  entry: FoodJournalEntry;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0"
    >
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {entry.photo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={entry.photo_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <span>{formatTime(entry.journaled_at)}</span>
          {entry.meal_type && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                {REMINDER_MEAL_EMOJI[entry.meal_type]}{' '}
                {REMINDER_MEAL_LABELS[entry.meal_type]}
              </span>
            </>
          )}
          {entry.source === 'reminder_dismiss' && (
            <span title="Created from a reminder" aria-label="From a reminder">
              🔔
            </span>
          )}
          {entry.promoted_consumption_log_id && (
            <span className="text-green-600" title="Tracked as a meal" aria-label="Tracked">
              ✓
            </span>
          )}
        </div>
        {entry.note && <p className="truncate text-sm text-gray-500">{entry.note}</p>}
      </div>
      <svg
        className="h-4 w-4 flex-shrink-0 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
