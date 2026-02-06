'use client';

import { useState, useMemo } from 'react';
import type { TopContributorsData, ContributorItem } from '@/lib/types';

type ViewMode = 'ingredient' | 'meal';
type MacroType = 'calories' | 'protein' | 'carbs' | 'fat';

const MACRO_CONFIG: Record<MacroType, { label: string; color: string; unit: string }> = {
  calories: { label: 'Calories', color: '#f97316', unit: 'cal' },
  protein: { label: 'Protein', color: '#3b82f6', unit: 'g P' },
  carbs: { label: 'Carbs', color: '#22c55e', unit: 'g C' },
  fat: { label: 'Fat', color: '#eab308', unit: 'g F' },
};

const RANK_BADGES = ['🥇', '🥈', '🥉'];

interface TopContributorsProps {
  data: TopContributorsData;
  periodLabel: string;
}

function ContributorRow({
  item,
  rank,
  maxValue,
  color,
  unit,
  viewMode,
}: {
  item: ContributorItem;
  rank: number;
  maxValue: number;
  color: string;
  unit: string;
  viewMode: ViewMode;
}) {
  const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
  const rankDisplay = rank < 3 ? RANK_BADGES[rank] : `${rank + 1}.`;

  // Context line for "in X meals" or "logged X times"
  const contextText = useMemo(() => {
    if (item.isAggregate) return null;
    if (viewMode === 'ingredient') {
      return item.entryCount === 1 ? 'in 1 meal' : `in ${item.entryCount} meals`;
    } else {
      return item.entryCount === 1 ? 'logged 1 time' : `logged ${item.entryCount} times`;
    }
  }, [item, viewMode]);

  return (
    <div className="py-2.5">
      {/* Top row: rank + name + value + percentage */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm w-6 flex-shrink-0">{rankDisplay}</span>
          <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-sm font-semibold text-gray-700">
            {Math.round(item.value)}
            {unit}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {item.percentage}%
          </span>
        </div>
      </div>

      {/* Progress bar - only for non-aggregate items */}
      {!item.isAggregate && (
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden ml-8">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
      )}

      {/* Context line */}
      {contextText && <p className="text-xs text-gray-400 mt-1 ml-8">{contextText}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-8 text-center">
      <span className="text-3xl mb-2 block">🍽️</span>
      <p className="text-gray-600 font-medium">No meals logged yet</p>
      <p className="text-gray-400 text-sm mt-1">Start logging to see what&apos;s fueling your training!</p>
    </div>
  );
}

export default function TopContributors({ data, periodLabel }: TopContributorsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('ingredient');
  const [activeMacro, setActiveMacro] = useState<MacroType>('calories');

  // Get the current data based on view mode
  const contributors = viewMode === 'ingredient' ? data.byIngredient : data.byMeal;
  const items = contributors[activeMacro];
  const macroConfig = MACRO_CONFIG[activeMacro];

  // Get max value for bar scaling (first item is always the max since sorted)
  const maxValue = items.length > 0 && !items[0].isAggregate ? items[0].value : 0;

  // Check if there's any data
  const hasData = items.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-colors border-b border-orange-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⛽</span>
          <h3 className="text-base font-semibold text-gray-900">Top Contributors</h3>
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
            Tap to explore
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-orange-400 transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Animated Body */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          isExpanded ? 'max-h-[700px]' : 'max-h-0'
        }`}
      >
        <div className="px-4 pb-4">
          {/* View Toggle */}
          <div className="mb-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('ingredient')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'ingredient'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                By Ingredient
              </button>
              <button
                onClick={() => setViewMode('meal')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'meal'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                By Meal
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 transition-opacity">
              {viewMode === 'ingredient'
                ? 'See which ingredients drive your macros across all meals'
                : 'See which meals contribute most to your totals'}
            </p>
          </div>

          {/* Macro Tabs */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {(Object.keys(MACRO_CONFIG) as MacroType[]).map((macro) => {
              const config = MACRO_CONFIG[macro];
              const isActive = activeMacro === macro;
              return (
                <button
                  key={macro}
                  onClick={() => setActiveMacro(macro)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors min-h-[36px] ${
                    isActive ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: config.color } : undefined}
                >
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Contributors List - scrollable after ~6 items */}
          {hasData ? (
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {items.map((item, index) => (
                <ContributorRow
                  key={item.isAggregate ? 'others' : item.name}
                  item={item}
                  rank={index}
                  maxValue={maxValue}
                  color={macroConfig.color}
                  unit={macroConfig.unit}
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
