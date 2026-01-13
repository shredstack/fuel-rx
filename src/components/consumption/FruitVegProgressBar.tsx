'use client';

import { useState } from 'react';

interface FruitVegProgressBarProps {
  currentGrams: number;
  goalGrams: number;  // 800 by default
  goalCelebrated: boolean;
}

// Categories that count toward the 800g goal
export const FRUIT_VEG_CATEGORIES = ['fruit', 'vegetable'] as const;

export function countsToward800g(category: string | null | undefined): boolean {
  if (!category) return false;
  return FRUIT_VEG_CATEGORIES.includes(category.toLowerCase() as typeof FRUIT_VEG_CATEGORIES[number]);
}

export default function FruitVegProgressBar({
  currentGrams,
  goalGrams,
}: FruitVegProgressBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const percentage = goalGrams > 0 ? Math.round((currentGrams / goalGrams) * 100) : 0;
  const cappedPercentage = Math.min(percentage, 100);
  const goalReached = percentage >= 100;

  return (
    <div className="mb-6">
      {/* Header with label and info tooltip */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🥬</span>
          <span className="font-medium text-gray-700">Fruits & Veggies</span>
          {/* Info tooltip */}
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Learn about the 800g Challenge"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                <p className="font-semibold mb-1">#800gChallenge</p>
                <p>
                  Eat 800g of fruits and vegetables daily for better health!
                  This science-backed goal is associated with lower disease risk.
                </p>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
              </div>
            )}
          </div>
        </div>
        <span className="text-gray-500 text-sm">{percentage}%</span>
      </div>

      {/* Progress values */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-2xl font-bold text-gray-900">
          {Math.round(currentGrams)}g
        </span>
        <span className="text-gray-500">/ {goalGrams}g</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${goalReached ? 'animate-rainbow' : 'bg-green-500'}`}
          style={{
            width: `${cappedPercentage}%`,
            ...(goalReached && {
              background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)',
              backgroundSize: '200% 100%',
            }),
          }}
        />
      </div>

      {/* Status text */}
      <p className="text-sm text-gray-500 mt-1">
        {goalReached ? (
          <span className="text-green-600 font-medium">
            🎉 800g+ Goal Reached!
          </span>
        ) : (
          `${Math.round(goalGrams - currentGrams)}g to go`
        )}
      </p>
    </div>
  );
}
