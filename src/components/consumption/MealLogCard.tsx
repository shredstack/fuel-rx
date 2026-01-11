'use client';

import type { MealToLog } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';

interface MealLogCardProps {
  meal: MealToLog;
  onLog: (meal: MealToLog) => Promise<void>;
  onUndo: (entryId: string, meal: MealToLog) => Promise<void>;
  compact?: boolean;
}

export default function MealLogCard({ meal, onLog, onUndo, compact = false }: MealLogCardProps) {
  const handleClick = async () => {
    if (meal.is_logged && meal.logged_entry_id) {
      await onUndo(meal.logged_entry_id, meal);
    } else {
      await onLog(meal);
    }
  };

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        meal.is_logged ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-gray-300'
      } transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Meal Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{meal.name}</h4>
          {meal.meal_type && (
            <span className="inline-block px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs mt-1">
              {MEAL_TYPE_LABELS[meal.meal_type]}
            </span>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {meal.calories} cal | {meal.protein}g P | {meal.carbs}g C | {meal.fat}g F
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleClick}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            meal.is_logged
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
          }`}
        >
          {meal.is_logged ? (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Logged
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
