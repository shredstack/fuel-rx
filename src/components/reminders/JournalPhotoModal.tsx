'use client';

/**
 * Photo-to-journal modal.
 *
 * Reuses MealPhotoCapture (upload + food validation) and adds a lightweight
 * review step — meal type + optional note — before creating a Food Journal
 * entry. Used both for manual journal snaps and for resolving a reminder by
 * snapping a verified food photo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import MealPhotoCapture from '@/components/consumption/MealPhotoCapture';
import { useCreateFoodJournalEntry } from '@/hooks/queries/useFoodJournal';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';
import {
  REMINDER_MEAL_TYPES,
  REMINDER_MEAL_EMOJI,
  REMINDER_MEAL_LABELS,
  type FoodJournalEntry,
  type FoodJournalSource,
  type ReminderMealType,
} from '@/lib/meal-reminders/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Prefilled meal type. */
  mealType?: ReminderMealType;
  /** Lock the meal type (true for reminder dismissals). */
  lockMealType?: boolean;
  source: FoodJournalSource;
  /** Required when source is 'reminder_dismiss'. */
  reminderDate?: string;
  onJournaled: (entry: FoodJournalEntry) => void;
}

type Step = 'capture' | 'review' | 'success';

export default function JournalPhotoModal({
  isOpen,
  onClose,
  mealType,
  lockMealType = false,
  source,
  reminderDate,
  onJournaled,
}: Props) {
  const { isNative } = usePlatform();
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const createEntry = useCreateFoodJournalEntry();

  const [step, setStep] = useState<Step>('capture');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<ReminderMealType | undefined>(mealType);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset everything whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setPhotoId(null);
      setPhotoUrl(null);
      setSelectedMealType(mealType);
      setNote('');
      setError(null);
    }
  }, [isOpen, mealType]);

  // Keep the focused note field visible above the keyboard (web fallback).
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

  const handlePhotoUploaded = useCallback((id: string, url: string) => {
    setPhotoId(id);
    setPhotoUrl(url);
    setError(null);
    setStep('review');
  }, []);

  const handleSave = useCallback(async () => {
    if (!photoId) return;
    setError(null);
    try {
      const entry = await createEntry.mutateAsync({
        mealPhotoId: photoId,
        mealType: selectedMealType,
        note: note.trim() || undefined,
        source,
        reminderDate: source === 'reminder_dismiss' ? reminderDate : undefined,
      });
      onJournaled(entry);
      setStep('success');
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    }
  }, [photoId, selectedMealType, note, source, reminderDate, createEntry, onJournaled, onClose]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      style={isNative && isKeyboardVisible ? { paddingBottom: keyboardHeight } : undefined}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'capture' && '📔 Snap for journal'}
            {step === 'review' && 'Add to journal'}
            {step === 'success' && 'Saved!'}
          </h2>
          {step !== 'success' && (
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {step === 'capture' && (
            <div>
              <p className="mb-4 text-sm text-gray-600">
                Snap a quick photo of your meal. It&apos;ll be saved to your Food Journal —
                no macro tracking required.
              </p>
              <MealPhotoCapture onPhotoUploaded={handlePhotoUploaded} onError={setError} />
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {photoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoUrl}
                  alt="Journal meal"
                  className="max-h-56 w-full rounded-lg object-contain bg-gray-100"
                />
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Meal</label>
                {lockMealType && selectedMealType ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
                    <span>{REMINDER_MEAL_EMOJI[selectedMealType]}</span>
                    {REMINDER_MEAL_LABELS[selectedMealType]}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_MEAL_TYPES.map((mt) => (
                      <button
                        key={mt}
                        onClick={() => setSelectedMealType(mt)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selectedMealType === mt
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{REMINDER_MEAL_EMOJI[mt]}</span>
                        {REMINDER_MEAL_LABELS[mt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="journal-note" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Note <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="journal-note"
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onFocus={handleFocus}
                  placeholder="e.g. leftover stir fry"
                  rows={2}
                  maxLength={280}
                  className="w-full resize-none overflow-y-auto rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  style={{ maxHeight: '96px' }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={createEntry.isPending}
                className="w-full rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {createEntry.isPending ? 'Saving…' : 'Save to journal'}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Added to your journal</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
