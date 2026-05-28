'use client';

/**
 * Full-page Food Journal history — a date-grouped feed of all journal entries.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';
import FoodJournalEntryRow from '@/components/reminders/FoodJournalEntryRow';
import { useFoodJournalRange } from '@/hooks/queries/useFoodJournal';
import { getLocalDateString } from '@/lib/meal-reminders/fire-times';
import type { FoodJournalEntry } from '@/lib/meal-reminders/types';

const JournalPhotoModal = dynamic(() => import('@/components/reminders/JournalPhotoModal'), {
  ssr: false,
});
const FoodJournalEntryDetail = dynamic(
  () => import('@/components/reminders/FoodJournalEntryDetail'),
  { ssr: false }
);

const HISTORY_DAYS = 90;

function dateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today';
  const [y, m, d] = dateStr.split('-').map(Number);
  const yesterday = getLocalDateString(new Date(Date.now() - 86_400_000));
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function FoodJournalHistoryClient() {
  const today = getLocalDateString();
  const from = getLocalDateString(new Date(Date.now() - HISTORY_DAYS * 86_400_000));

  const { data: entries, isLoading } = useFoodJournalRange(from, today);
  const [showSnap, setShowSnap] = useState(false);
  const [detailEntry, setDetailEntry] = useState<FoodJournalEntry | null>(null);

  // Group entries (already sorted newest-first by the API) by local date.
  const grouped = useMemo(() => {
    const map = new Map<string, FoodJournalEntry[]>();
    for (const entry of entries ?? []) {
      const key = getLocalDateString(new Date(entry.journaled_at));
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/log-meal" className="text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">📔 Food Journal</h1>
          </div>
          <button
            onClick={() => setShowSnap(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200"
            aria-label="Add journal entry"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="card text-center text-gray-500">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="card py-12 text-center">
            <div className="mb-2 text-4xl">📔</div>
            <p className="text-gray-500">
              Your journal is empty. Snap a meal to dismiss a reminder, or log one anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([date, dayEntries]) => (
              <div key={date}>
                <h2 className="mb-2 text-sm font-semibold text-gray-500">
                  {dateLabel(date, today)}
                </h2>
                <div className="card divide-y divide-gray-50">
                  {dayEntries.map((entry) => (
                    <FoodJournalEntryRow
                      key={entry.id}
                      entry={entry}
                      onClick={() => setDetailEntry(entry)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showSnap && (
        <JournalPhotoModal
          isOpen
          onClose={() => setShowSnap(false)}
          source="manual"
          onJournaled={() => {
            /* modal shows its own success state then closes */
          }}
        />
      )}
      {detailEntry && (
        <FoodJournalEntryDetail entry={detailEntry} onClose={() => setDetailEntry(null)} />
      )}

      <MobileTabBar />
    </div>
  );
}
