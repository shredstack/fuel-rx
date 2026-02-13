'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MealPlanMealToLog, MealToLog, MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePlatform } from '@/hooks/usePlatform';
import { useMealPlansFilter } from '@/hooks/queries/useMealPlansFilter';

interface Props {
  latestPlanMeals: MealPlanMealToLog[];
  latestPlanWeekStart?: string;
  latestPlanTitle?: string;
  onLogMeal: (meal: MealToLog) => Promise<void>;
  onUndoLog: (entryId: string, meal: MealToLog) => Promise<void>;
}

// Main meal types for filtering (excluding workout meals for simplicity)
const FILTER_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealPlanMealsSection({
  latestPlanMeals,
  latestPlanWeekStart,
  latestPlanTitle,
  onLogMeal,
  onUndoLog,
}: Props) {
  // Keyboard handling for mobile
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const { isNative } = usePlatform();

  // Fetch available plans for filter
  const { data: plansData, isLoading: plansLoading } = useMealPlansFilter();

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MealPlanMealToLog[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter state - start with 'pending' until we know the latest plan
  const [selectedPlanId, setSelectedPlanId] = useState<string | 'all' | 'pending'>('pending');
  const [selectedMealType, setSelectedMealType] = useState<MealType | 'all'>('all');

  // Set the latest plan as default once plansData loads
  useEffect(() => {
    if (selectedPlanId === 'pending' && plansData?.latestPlanId) {
      setSelectedPlanId(plansData.latestPlanId);
    } else if (selectedPlanId === 'pending' && !plansLoading && !plansData?.latestPlanId) {
      // No plans available, default to 'all'
      setSelectedPlanId('all');
    }
  }, [plansData?.latestPlanId, plansLoading, selectedPlanId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPlanDropdownOpen(false);
      }
    };

    if (isPlanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPlanDropdownOpen]);

  // Format week label for display
  const formatWeekLabel = (weekStart: string) => {
    return `Week of ${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`;
  };

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

  // Client-side filtering of meals
  const filteredMeals = useMemo(() => {
    // If search is active, show search results
    if (searchQuery.length >= 2) {
      return searchResults;
    }

    // Don't filter until we have a selection
    if (selectedPlanId === 'pending') {
      return [];
    }

    let meals = latestPlanMeals;

    // Filter by plan
    if (selectedPlanId !== 'all') {
      meals = meals.filter((m) => m.plan_id === selectedPlanId);
    }

    // Filter by meal type
    if (selectedMealType !== 'all') {
      meals = meals.filter((m) => m.meal_type === selectedMealType);
    }

    return meals;
  }, [latestPlanMeals, selectedPlanId, selectedMealType, searchQuery, searchResults]);

  // Get unique plans from the meals data for the filter (fallback)
  const plansFromMeals = useMemo(() => {
    const planMap = new Map<string, { id: string; title?: string; weekStart: string }>();
    for (const meal of latestPlanMeals) {
      if (meal.plan_id && !planMap.has(meal.plan_id)) {
        planMap.set(meal.plan_id, {
          id: meal.plan_id,
          title: meal.plan_title,
          weekStart: meal.plan_week_start,
        });
      }
    }
    return Array.from(planMap.values());
  }, [latestPlanMeals]);

  // Combine API plans with plans from meals data
  const displayPlans = useMemo(() => {
    if (plansData?.plans) {
      return plansData.plans;
    }
    // Fallback to plans derived from meals (mark first one as latest)
    return plansFromMeals.map((p, index) => ({
      id: p.id,
      title: p.title || null,
      week_start_date: p.weekStart,
      is_favorite: false,
      is_latest: index === 0,
    }));
  }, [plansData?.plans, plansFromMeals]);

  // Get the selected plan for display
  const selectedPlan = useMemo(() => {
    if (selectedPlanId === 'all' || selectedPlanId === 'pending') return null;
    return displayPlans.find((p) => p.id === selectedPlanId);
  }, [displayPlans, selectedPlanId]);

  // Get available meal types for the selected plan
  const availableMealTypes = useMemo(() => {
    const types = new Set<MealType>();
    const mealsToCheck = selectedPlanId === 'all' || selectedPlanId === 'pending'
      ? latestPlanMeals
      : latestPlanMeals.filter((m) => m.plan_id === selectedPlanId);

    for (const meal of mealsToCheck) {
      if (meal.meal_type) {
        types.add(meal.meal_type);
      }
    }
    return FILTER_MEAL_TYPES.filter((t) => types.has(t));
  }, [latestPlanMeals, selectedPlanId]);

  const handleMealClick = async (meal: MealPlanMealToLog) => {
    if (meal.is_logged && meal.logged_entry_id) {
      await onUndoLog(meal.logged_entry_id, meal);
    } else {
      await onLogMeal(meal);
    }
  };

  const handleSearchFocus = () => {
    // Scroll input into view when keyboard opens
    setTimeout(() => {
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleSearchToggle = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (!isSearchExpanded) {
      // Clear filters when opening search
      setSearchQuery('');
      // Focus the input after it appears
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // Clear search when closing
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handlePlanSelect = (planId: string | 'all') => {
    setSelectedPlanId(planId);
    setSelectedMealType('all');
    setIsPlanDropdownOpen(false);
  };

  // Keyboard-aware max height for results
  const resultsMaxHeight = isNative && isKeyboardVisible && keyboardHeight > 0
    ? `calc(100vh - ${keyboardHeight}px - 320px)`
    : '20rem';

  // Get display text for the plan selector
  const getPlanSelectorText = () => {
    if (selectedPlanId === 'pending') return 'Loading...';
    if (selectedPlanId === 'all') return 'All Plans';
    if (selectedPlan) {
      const label = selectedPlan.title || formatWeekLabel(selectedPlan.week_start_date);
      return selectedPlan.is_latest ? `${label} (Latest)` : label;
    }
    return 'Select Plan';
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
            ({latestPlanMeals.length})
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
        <div className="space-y-3">
          {/* Plan Selector Dropdown + Search Toggle */}
          {!isSearchExpanded && (
            <div className="flex items-center gap-2">
              {/* Plan Dropdown */}
              <div className="relative flex-1" ref={dropdownRef}>
                <button
                  onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300
                             rounded-lg text-left text-sm font-medium text-gray-700 hover:bg-gray-50
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <span className="truncate">{getPlanSelectorText()}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ml-2 flex-shrink-0
                               ${isPlanDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isPlanDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg
                                  max-h-64 overflow-y-auto">
                    {/* All Plans option */}
                    <button
                      onClick={() => handlePlanSelect('all')}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center justify-between
                        ${selectedPlanId === 'all' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                    >
                      <span>All Plans</span>
                      {selectedPlanId === 'all' && (
                        <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Plan options */}
                    {displayPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => handlePlanSelect(plan.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center justify-between
                          ${selectedPlanId === plan.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">
                            {plan.title || formatWeekLabel(plan.week_start_date)}
                          </span>
                          {plan.is_latest && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded flex-shrink-0">
                              Latest
                            </span>
                          )}
                          {plan.is_favorite && (
                            <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )}
                        </div>
                        {selectedPlanId === plan.id && (
                          <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search toggle button */}
              <button
                onClick={handleSearchToggle}
                className="p-2.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50
                           hover:text-gray-700 transition-colors flex-shrink-0"
                title="Search all meals"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          )}

          {/* Meal Type Filter Chips */}
          {!isSearchExpanded && selectedPlanId !== 'all' && selectedPlanId !== 'pending' && availableMealTypes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedMealType('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${selectedMealType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
              >
                All
              </button>
              {availableMealTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedMealType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${selectedMealType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                >
                  {MEAL_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}

          {/* Expandable Search Bar */}
          {isSearchExpanded && (
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Search all meal plan meals..."
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearching ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent
                                 rounded-full animate-spin" />
                </div>
              ) : (
                <button
                  onClick={handleSearchToggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Results Count */}
          {selectedPlanId !== 'pending' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {searchQuery.length >= 2
                  ? `Search results (${searchResults.length})`
                  : `${filteredMeals.length} meal${filteredMeals.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}

          {/* Meal Chips / Cards */}
          {selectedPlanId === 'pending' ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMeals.length > 0 ? (
            <div
              className="flex flex-wrap gap-2 overflow-y-auto"
              style={{ maxHeight: resultsMaxHeight }}
            >
              {filteredMeals.map((meal) => (
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
                      {/* Show plan tag when viewing all plans or in search */}
                      {(selectedPlanId === 'all' || searchQuery.length >= 2) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                          {meal.plan_title || formatWeekLabel(meal.plan_week_start)}
                        </span>
                      )}
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
                : 'No meals match the selected filters'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
