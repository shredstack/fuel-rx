'use client';

/**
 * Food Journal panel for the consumption tracking screen.
 *
 * A collapsible section below the meal log showing the selected day's journal
 * entries. Tap [+] to snap a journal-only photo; tap an entry for its detail
 * sheet; "View all" opens the full history.
 */

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useFoodJournalRange } from '@/hooks/queries/useFoodJournal';
import FoodJournalEntryRow from '@/components/reminders/FoodJournalEntryRow';
import type { FoodJournalEntry } from '@/lib/meal-reminders/types';

const JournalPhotoModal = dynamic(() => import('@/components/reminders/JournalPhotoModal'), {
  ssr: false,
});
const FoodJournalEntryDetail = dynamic(
  () => import('@/components/reminders/FoodJournalEntryDetail'),
  { ssr: false }
);

export default function FoodJournalPanel({ selectedDate }: { selectedDate: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showSnap, setShowSnap] = useState(false);
  const [detailEntry, setDetailEntry] = useState<FoodJournalEntry | null>(null);

  const { data: entries, isLoading } = useFoodJournalRange(selectedDate, selectedDate);
  const count = entries?.length ?? 0;

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span>📔</span>
            Food Journal
            <span className="text-sm font-normal text-gray-500">({count})</span>
          </h3>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${
              collapsed ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
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

      {!collapsed && (
        <div className="card">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
          ) : count === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-500">
                Your journal is empty. Snap a meal to dismiss a reminder, or log one
                anytime from here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {entries!.map((entry) => (
                <FoodJournalEntryRow
                  key={entry.id}
                  entry={entry}
                  onClick={() => setDetailEntry(entry)}
                />
              ))}
            </div>
          )}

          <div className="mt-2 border-t border-gray-100 pt-2 text-center">
            <Link
              href="/food-journal"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          </div>
        </div>
      )}

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
    </div>
  );
}
