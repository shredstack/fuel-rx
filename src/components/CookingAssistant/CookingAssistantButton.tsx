'use client';

import { useState } from 'react';
import { CookingAssistantDrawer } from './CookingAssistantDrawer';
import { useResolvedMealId } from '@/components/prep/MealIdContext';

interface CookingAssistantButtonProps {
  mealId: string; // Can be either a UUID or a composite ID like "meal_monday_breakfast_0"
  mealName: string;
  batchContext?: {
    totalServings: number;
    days: string[];
  };
}

export function CookingAssistantButton({
  mealId,
  mealName,
  batchContext,
}: CookingAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Try to resolve composite ID to actual UUID using context
  const resolvedMeal = useResolvedMealId(mealId);

  // Use resolved ID if available, otherwise use the original (might already be a UUID)
  const actualMealId = resolvedMeal?.id || mealId;
  const actualMealName = resolvedMeal?.name || mealName;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full hover:bg-teal-200 transition-colors"
        aria-label="Open cooking assistant"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Ask
      </button>

      {isOpen && (
        <CookingAssistantDrawer
          mealId={actualMealId}
          mealName={actualMealName}
          onClose={() => setIsOpen(false)}
          batchContext={batchContext}
        />
      )}
    </>
  );
}
