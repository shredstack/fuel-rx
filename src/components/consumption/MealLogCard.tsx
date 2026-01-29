'use client';

import { useState, useRef, memo } from 'react';
import type { MealToLog } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';

interface MealLogCardProps {
  meal: MealToLog;
  onLog: (meal: MealToLog) => Promise<void>;
  onUndo: (entryId: string, meal: MealToLog) => Promise<void>;
  compact?: boolean;
  showMealSource?: boolean;  // Show "Recipe" or "Quick Cook" badge
}

export default memo(function MealLogCard({ meal, onLog, onUndo, compact = false, showMealSource = false }: MealLogCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef(false);

  const handleClick = async () => {
    if (meal.is_logged && meal.logged_entry_id) {
      await onUndo(meal.logged_entry_id, meal);
    } else {
      await onLog(meal);
    }
  };

  // Swipe-to-log handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (meal.is_logged) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = false;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || meal.is_logged) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Determine if this is a horizontal swipe (only on first significant movement)
    if (!isHorizontalSwipe.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }

    // Only allow horizontal swipe
    if (isHorizontalSwipe.current && deltaX > 0) {
      setSwipeOffset(Math.min(deltaX, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (!isSwiping || meal.is_logged) return;

    // If swiped far enough (>60px), log the meal
    if (swipeOffset > 60) {
      await onLog(meal);
    }

    setSwipeOffset(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = false;
  };

  // Get source badge text
  const getSourceBadge = () => {
    if (!showMealSource) return null;
    if (meal.source === 'custom_meal') {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-600">
          Custom Meal
        </span>
      );
    }
    if (meal.source === 'quick_cook') {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-600">
          Quick Cook
        </span>
      );
    }
    if (meal.source === 'meal_plan') {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">
          Meal Plan
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${
        meal.is_logged ? '' : 'touch-pan-y'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe reveal background */}
      {swipeOffset > 0 && (
        <div
          className="absolute inset-y-0 left-0 bg-green-500 flex items-center px-4"
          style={{ width: swipeOffset }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Card content */}
      <div
        className={`bg-white border p-4 ${
          meal.is_logged ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-gray-300'
        } transition-all`}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Meal Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">{meal.name}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {meal.meal_type && (
                <span className="inline-block px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                  {MEAL_TYPE_LABELS[meal.meal_type]}
                </span>
              )}
              {getSourceBadge()}
            </div>
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
    </div>
  );
});
