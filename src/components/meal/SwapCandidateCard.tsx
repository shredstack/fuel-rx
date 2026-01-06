'use client';

import type { MealEntity, Macros } from '@/lib/types';

interface SwapCandidateCardProps {
  meal: MealEntity;
  source: 'custom' | 'community' | 'previous';
  currentMealMacros?: Macros;
  onSelect: (meal: MealEntity) => void;
  isLoading?: boolean;
}

/**
 * Card displaying a swap candidate meal with macro comparison.
 */
export function SwapCandidateCard({
  meal,
  source,
  currentMealMacros,
  onSelect,
  isLoading,
}: SwapCandidateCardProps) {
  // Calculate macro differences if we have current meal macros
  const showDiff = !!currentMealMacros;
  const calDiff = currentMealMacros ? meal.calories - currentMealMacros.calories : 0;
  const proteinDiff = currentMealMacros ? meal.protein - currentMealMacros.protein : 0;

  const formatDiff = (diff: number) => {
    if (diff === 0) return null;
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getDiffColor = (diff: number, isProtein: boolean) => {
    if (diff === 0) return 'text-gray-400';
    if (isProtein) {
      return diff > 0 ? 'text-green-600' : 'text-red-600';
    }
    return diff > 0 ? 'text-red-600' : 'text-green-600';
  };

  const sourceLabels = {
    custom: { label: 'My Meal', color: 'bg-blue-100 text-blue-700' },
    community: { label: 'Community', color: 'bg-purple-100 text-purple-700' },
    previous: { label: 'Previous', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{meal.name}</h4>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${sourceLabels[source].color}`}>
            {sourceLabels[source].label}
          </span>
        </div>
        <button
          onClick={() => onSelect(meal)}
          disabled={isLoading}
          className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Swapping...' : 'Swap'}
        </button>
      </div>

      {/* Macros */}
      <div className="flex gap-4 text-sm mt-3">
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Cal</span>
          <span className="font-medium">{meal.calories}</span>
          {showDiff && formatDiff(calDiff) && (
            <span className={`text-xs ${getDiffColor(calDiff, false)}`}>
              {formatDiff(calDiff)}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Protein</span>
          <span className="font-medium">{Math.round(meal.protein)}g</span>
          {showDiff && formatDiff(proteinDiff) && (
            <span className={`text-xs ${getDiffColor(proteinDiff, true)}`}>
              {formatDiff(proteinDiff)}g
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Carbs</span>
          <span className="font-medium">{Math.round(meal.carbs)}g</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs">Fat</span>
          <span className="font-medium">{Math.round(meal.fat)}g</span>
        </div>
      </div>

      {/* Prep time */}
      <p className="text-xs text-gray-500 mt-2">
        {meal.prep_time_minutes} min prep
      </p>
    </div>
  );
}
