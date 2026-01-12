'use client';

import { useState } from 'react';
import type { MealToLog } from '@/lib/types';
import MealLogCard from './MealLogCard';

interface MealSourceSectionProps {
  title: string;
  subtitle?: string;
  icon: 'calendar' | 'calendar-week' | 'utensils' | 'bolt';
  meals: MealToLog[];
  onLogMeal: (meal: MealToLog) => Promise<void>;
  onUndoLog: (entryId: string, meal: MealToLog) => Promise<void>;
  collapsible?: boolean;
  initialCollapsed?: boolean;
  showMealSource?: boolean;  // Show "Recipe" or "Quick Cook" badge on each meal
}

const icons = {
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  'calendar-week': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  utensils: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  ),
  bolt: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

export default function MealSourceSection({
  title,
  subtitle,
  icon,
  meals,
  onLogMeal,
  onUndoLog,
  collapsible = false,
  initialCollapsed = false,
  showMealSource = false,
}: MealSourceSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  if (meals.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        className={`flex items-center justify-between w-full text-left mb-3 ${collapsible ? 'cursor-pointer' : ''}`}
        disabled={!collapsible}
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-gray-400">{icons[icon]}</span>
            {title}
            <span className="text-sm font-normal text-gray-500">({meals.length})</span>
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-500 ml-7">{subtitle}</p>
          )}
        </div>
        {collapsible && (
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {!isCollapsed && (
        <div className="grid gap-3">
          {meals.map((meal) => (
            <MealLogCard
              key={meal.id}
              meal={meal}
              onLog={onLogMeal}
              onUndo={onUndoLog}
              showMealSource={showMealSource}
            />
          ))}
        </div>
      )}
    </div>
  );
}
