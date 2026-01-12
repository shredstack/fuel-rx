'use client';

import { useState, useEffect } from 'react';
import type { MealPlanMealToLog, MealToLog } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';

interface Props {
  latestPlanMeals: MealPlanMealToLog[];
  latestPlanWeekStart?: string;
  latestPlanTitle?: string;
  onLogMeal: (meal: MealToLog) => Promise<void>;
  onUndoLog: (entryId: string, meal: MealToLog) => Promise<void>;
}

export default function MealPlanMealsSection({
  latestPlanMeals,
  latestPlanWeekStart,
  latestPlanTitle,
  onLogMeal,
  onUndoLog,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MealPlanMealToLog[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Format week label
  const weekLabel = latestPlanWeekStart
    ? `Week of ${new Date(latestPlanWeekStart + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    : 'Latest Plan';

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/consumption/meal-plan-meals/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.meals);
        }
      } catch (error) {
        console.error('Search error:', error);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayMeals = searchQuery.length >= 2 ? searchResults : latestPlanMeals;

  const handleMealClick = async (meal: MealPlanMealToLog) => {
    if (meal.is_logged && meal.logged_entry_id) {
      await onUndoLog(meal.logged_entry_id, meal);
    } else {
      await onLogMeal(meal);
    }
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left mb-3"
      >
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          Meal Plan Meals
          <span className="text-sm font-normal text-gray-500">
            ({latestPlanMeals.length} in latest)
          </span>
        </h3>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all meal plan meals..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent
                               rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Section Label */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {searchQuery.length >= 2
                ? `Search results (${searchResults.length})`
                : weekLabel}
            </span>
            {latestPlanTitle && searchQuery.length < 2 && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                {latestPlanTitle}
              </span>
            )}
          </div>

          {/* Meal Chips / Cards */}
          {displayMeals.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {displayMeals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => handleMealClick(meal)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border
                    transition-colors text-left
                    ${meal.is_logged
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{meal.name}</span>
                      {meal.is_logged && (
                        <span className="text-green-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Meal type tag */}
                      {meal.meal_type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700">
                          {MEAL_TYPE_LABELS[meal.meal_type]}
                        </span>
                      )}
                      {/* Meal Plan tag with title */}
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                        Meal Plan{meal.plan_title ? ` ${meal.plan_title}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{meal.calories} cal</span>
                      <span>-</span>
                      <span>{meal.day_label}</span>
                      {searchQuery.length >= 2 && meal.plan_week_start && (
                        <>
                          <span>-</span>
                          <span>
                            {new Date(meal.plan_week_start + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {searchQuery.length >= 2
                ? 'No meals found matching your search'
                : 'No meal plan meals available'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
