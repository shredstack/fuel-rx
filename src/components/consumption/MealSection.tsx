'use client';

import { useState, useEffect } from 'react';
import type { ConsumptionEntry, MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS, MEAL_TYPE_CONFIG } from '@/lib/types';
import LoggedEntryRow from './LoggedEntryRow';

interface PreviousEntriesInfo {
  entries: ConsumptionEntry[];
  sourceDate: string;
}

interface MealSectionProps {
  mealType: MealType;
  entries: ConsumptionEntry[];
  previousEntries: PreviousEntriesInfo | null;
  initialCollapsed?: boolean;
  forceExpand?: boolean;
  onForceExpandHandled?: () => void;
  onAddEntry: (mealType: MealType) => void;
  onRemoveEntry: (entryId: string) => void;
  onMoveEntry: (entryId: string, newMealType: MealType) => void;
  onEditAmount: (entryId: string, newAmount: number, newMacros: { calories: number; protein: number; carbs: number; fat: number }, newGrams?: number) => void;
  onRepeatFromPrevious: (mealType: MealType, sourceDate: string) => void;
}

// Format date for display (e.g., "Yesterday" or "Sat, Jan 18")
function formatSourceDate(sourceDate: string, today: string): string {
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const todayDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay, 12, 0, 0));

  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  if (sourceDate === yesterdayStr) {
    return 'Yesterday';
  }

  // Format as "Sat, Jan 18"
  const [year, month, day] = sourceDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${dayNames[date.getUTCDay()]}, ${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

// Get today's date string
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function MealSection({
  mealType,
  entries,
  previousEntries,
  initialCollapsed = false,
  forceExpand,
  onForceExpandHandled,
  onAddEntry,
  onRemoveEntry,
  onMoveEntry,
  onEditAmount,
  onRepeatFromPrevious,
}: MealSectionProps) {
  // Start expanded if there are entries OR if there are previous entries to show the "Log same" hint
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed && entries.length === 0 && !previousEntries);
  const [isRepeating, setIsRepeating] = useState(false);
  // Store today's date in state to avoid hydration mismatch
  const [today, setToday] = useState<string>('');

  // Set today's date after mount to avoid hydration mismatch
  useEffect(() => {
    setToday(getTodayString());
  }, []);

  // Auto-expand when forceExpand is true (e.g., when an item was just logged to this section)
  useEffect(() => {
    if (forceExpand && isCollapsed) {
      setIsCollapsed(false);
      onForceExpandHandled?.();
    }
  }, [forceExpand, isCollapsed, onForceExpandHandled]);

  const config = MEAL_TYPE_CONFIG[mealType];
  const label = MEAL_TYPE_LABELS[mealType];
  const isEmpty = entries.length === 0;

  // Calculate totals for the section
  const totals = entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Format previous entries summary for hint
  const previousSummary = previousEntries
    ? previousEntries.entries
        .map((e) => e.display_name)
        .slice(0, 2)
        .join(', ') + (previousEntries.entries.length > 2 ? `, +${previousEntries.entries.length - 2} more` : '')
    : null;

  const previousCalories = previousEntries
    ? previousEntries.entries.reduce((sum, e) => sum + e.calories, 0)
    : 0;

  const handleRepeat = async () => {
    if (!previousEntries) return;
    setIsRepeating(true);
    try {
      await onRepeatFromPrevious(mealType, previousEntries.sourceDate);
    } finally {
      setIsRepeating(false);
    }
  };

  return (
    <div className="card mb-4">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <h4 className="font-medium text-gray-900">{label}</h4>
          {!isEmpty && (
            <span className="text-xs text-gray-400">({entries.length})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isEmpty && (
            <span className="text-sm text-gray-500">{totals.calories} cal</span>
          )}
          {isEmpty && (
            <span className="text-xs text-gray-400">(empty)</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddEntry(mealType);
            }}
            className="text-primary-600 hover:text-primary-700 p-1"
            title={`Add ${label.toLowerCase()}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {/* Logged entries */}
          {entries.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <LoggedEntryRow
                  key={entry.id}
                  entry={entry}
                  onRemove={onRemoveEntry}
                  onMove={onMoveEntry}
                  onEditAmount={onEditAmount}
                  currentMealType={mealType}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">No items logged</p>
          )}

          {/* Previous entries hint (only show when empty and has previous, after today is set) */}
          {isEmpty && previousEntries && previousSummary && today && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-yellow-500 mt-0.5">💡</span>
                <div className="flex-1">
                  <p className="text-gray-600">
                    <span className="font-medium">{formatSourceDate(previousEntries.sourceDate, today)}:</span>{' '}
                    {previousSummary} ({previousCalories} cal)
                  </p>
                  <button
                    onClick={handleRepeat}
                    disabled={isRepeating}
                    className="mt-1 text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-50"
                  >
                    {isRepeating ? 'Logging...' : `Log same ${label.toLowerCase()}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
