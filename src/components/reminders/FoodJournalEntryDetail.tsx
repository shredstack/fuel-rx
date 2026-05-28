'use client';

/**
 * Detail sheet for a single Food Journal entry: view the photo, edit the note
 * and meal type, delete, or promote it to a macro-tracked meal.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  useUpdateFoodJournalEntry,
  useDeleteFoodJournalEntry,
  usePromoteFoodJournalEntry,
} from '@/hooks/queries/useFoodJournal';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';
import {
  REMINDER_MEAL_TYPES,
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type FoodJournalEntry,
  type ReminderMealType,
} from '@/lib/meal-reminders/types';

const PaywallModal = dynamic(() => import('@/components/PaywallModal'), { ssr: false });

interface Props {
  entry: FoodJournalEntry;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FoodJournalEntryDetail({ entry, onClose }: Props) {
  const { isNative } = usePlatform();
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const updateEntry = useUpdateFoodJournalEntry();
  const deleteEntry = useDeleteFoodJournalEntry();
  const promoteEntry = usePromoteFoodJournalEntry();

  const [mealType, setMealType] = useState<ReminderMealType | null>(entry.meal_type);
  const [note, setNote] = useState(entry.note ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPromoted = !!entry.promoted_consumption_log_id;
  const isDirty = mealType !== entry.meal_type || note !== (entry.note ?? '');

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const handleResize = () => {
      if (document.activeElement === textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };
    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  const handleSave = async () => {
    setError(null);
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        note: note.trim() || null,
        mealType: mealType,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteEntry.mutateAsync(entry.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const handlePromote = async () => {
    setError(null);
    try {
      await promoteEntry.mutateAsync({
        id: entry.id,
        mealType: mealType ?? undefined,
        consumedAt: entry.journaled_at,
      });
      onClose();
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 402) {
        setShowPaywall(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to promote entry');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4"
      style={isNative && isKeyboardVisible ? { paddingBottom: keyboardHeight } : undefined}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">Journal entry</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entry.photo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entry.photo_url}
              alt="Journal meal"
              className="mb-4 max-h-64 w-full rounded-lg bg-gray-100 object-contain"
            />
          )}

          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
            <span>{formatTimestamp(entry.journaled_at)}</span>
            {entry.source === 'reminder_dismiss' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-600">
                🔔 From a reminder
              </span>
            )}
            {isPromoted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
                ✓ Tracked
              </span>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Meal</label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMealType(mealType === mt ? null : mt)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    mealType === mt
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{REMINDER_MEAL_EMOJI[mt]}</span>
                  {REMINDER_MEAL_LABELS[mt]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="detail-note" className="mb-1.5 block text-sm font-medium text-gray-700">
              Note
            </label>
            <textarea
              id="detail-note"
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={handleFocus}
              placeholder="Add a note…"
              rows={2}
              maxLength={280}
              className="w-full resize-none overflow-y-auto rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              style={{ maxHeight: '96px' }}
            />
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={updateEntry.isPending}
                className="btn-primary w-full"
              >
                {updateEntry.isPending ? 'Saving…' : 'Save changes'}
              </button>
            )}

            {!isPromoted && (
              <button
                onClick={handlePromote}
                disabled={promoteEntry.isPending}
                className="w-full rounded-lg border-2 border-primary-500 px-4 py-2.5 text-sm font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
              >
                {promoteEntry.isPending ? 'Analyzing…' : '✨ Promote to logged meal'}
              </button>
            )}

            {confirmingDelete ? (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-sm font-medium text-red-900">Delete this entry?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteEntry.isPending}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleteEntry.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete entry
              </button>
            )}
          </div>
        </div>
      </div>

      {showPaywall && (
        <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      )}
    </div>
  );
}
