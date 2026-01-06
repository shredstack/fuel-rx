'use client';

import { useState, useEffect, useCallback } from 'react';
import { SwapCandidateCard } from './SwapCandidateCard';
import type { MealEntity, MealType, SwapCandidatesResponse, SwapCandidate, SwapResponse } from '@/lib/types';

type TabType = 'custom' | 'community' | 'previous';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlanId: string;
  mealPlanMealId: string;
  mealType: MealType;
  currentMeal: MealEntity;
  onSwapComplete: (response: SwapResponse) => void;
}

/**
 * Modal for selecting a replacement meal.
 * Shows tabs for custom meals, community meals, and previous meals.
 */
export function SwapModal({
  isOpen,
  onClose,
  mealPlanId,
  mealPlanMealId,
  mealType,
  currentMeal,
  onSwapComplete,
}: SwapModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch candidates when modal opens or filters change
  const fetchCandidates = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        mealPlanId,
        mealType,
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/swap-candidates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch candidates');

      const data: SwapCandidatesResponse = await res.json();
      setCandidates(data.candidates);
    } catch (err) {
      setError('Failed to load meals. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, mealPlanId, mealType, searchQuery]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Handle swap
  const handleSwap = async (meal: MealEntity) => {
    setSwapping(meal.id);
    setError(null);

    try {
      const res = await fetch(`/api/meal-plans/${mealPlanId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealPlanMealId,
          newMealId: meal.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to swap meal');
      }

      const response: SwapResponse = await res.json();
      onSwapComplete(response);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to swap meal');
    } finally {
      setSwapping(null);
    }
  };

  // Filter candidates by active tab
  const filteredCandidates = candidates.filter(c => c.source === activeTab);

  // Count by source for tab badges
  const counts = {
    custom: candidates.filter(c => c.source === 'custom').length,
    community: candidates.filter(c => c.source === 'community').length,
    previous: candidates.filter(c => c.source === 'previous').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-white w-full sm:max-w-lg sm:rounded-xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-4 py-3 sm:rounded-t-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Swap Meal</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                {/* X close icon */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current meal reference */}
            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500">Replacing: </span>
              <span className="font-medium">{currentMeal.name}</span>
              <span className="text-gray-400 ml-2">
                ({currentMeal.calories} cal, {currentMeal.protein}g P)
              </span>
            </div>

            {/* Search */}
            <div className="mt-3 relative">
              {/* Magnifying glass icon */}
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search meals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Tabs */}
            <div className="mt-3 flex gap-2">
              {(['custom', 'community', 'previous'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'custom' && 'My Meals'}
                  {tab === 'community' && 'Community'}
                  {tab === 'previous' && 'Previous'}
                  {counts[tab] > 0 && (
                    <span className="ml-1 text-xs opacity-70">({counts[tab]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {activeTab === 'custom' && 'No custom meals yet. Create one in My Meals!'}
                {activeTab === 'community' && 'No community meals available for this meal type.'}
                {activeTab === 'previous' && 'No previous meals found.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCandidates.map((candidate) => (
                  <SwapCandidateCard
                    key={candidate.meal.id}
                    meal={candidate.meal}
                    source={candidate.source}
                    currentMealMacros={{
                      calories: currentMeal.calories,
                      protein: currentMeal.protein,
                      carbs: currentMeal.carbs,
                      fat: currentMeal.fat,
                    }}
                    onSelect={handleSwap}
                    isLoading={swapping === candidate.meal.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
