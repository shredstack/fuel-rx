'use client';

import { useState } from 'react';
import type { MealTypeBreakdown, Macros, MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS, getMealTypeColorHex, MEAL_TYPE_CONFIG } from '@/lib/types';

type MacroType = 'calories' | 'protein' | 'carbs' | 'fat';

interface MealTypeBreakdownChartProps {
  breakdown: MealTypeBreakdown;
  totalConsumed: Macros;
}

const MACRO_CONFIG: Record<MacroType, { label: string; color: string; unit: string }> = {
  calories: { label: 'Calories', color: '#f97316', unit: 'cal' },
  protein: { label: 'Protein', color: '#3b82f6', unit: 'g' },
  carbs: { label: 'Carbs', color: '#22c55e', unit: 'g' },
  fat: { label: 'Fat', color: '#eab308', unit: 'g' },
};

// Helper to get color for any meal type including 'unassigned'
const getMealTypeColor = (type: string): string => {
  if (type === 'unassigned') return '#9ca3af'; // gray for unassigned
  return getMealTypeColorHex(type as MealType);
};

export default function MealTypeBreakdownChart({ breakdown, totalConsumed }: MealTypeBreakdownChartProps) {
  const [selectedMacro, setSelectedMacro] = useState<MacroType>('calories');

  const config = MACRO_CONFIG[selectedMacro];

  // Get meal types that have data (excluding unassigned if empty)
  const mealTypes = (['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner', 'unassigned'] as const).filter(
    (type) => breakdown[type][selectedMacro] > 0
  );

  // Calculate total for selected macro
  const total = totalConsumed[selectedMacro];

  // Sort by value descending
  const sortedMealTypes = [...mealTypes].sort(
    (a, b) => breakdown[b][selectedMacro] - breakdown[a][selectedMacro]
  );

  // If no data, show empty state
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-4">By Meal Type</h3>
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No consumption data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700 mb-3">By Meal Type</h3>

      {/* Macro Toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {(Object.keys(MACRO_CONFIG) as MacroType[]).map((macro) => (
          <button
            key={macro}
            onClick={() => setSelectedMacro(macro)}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
              selectedMacro === macro
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {MACRO_CONFIG[macro].label}
          </button>
        ))}
      </div>

      {/* Stacked Bar */}
      <div className="mb-4">
        <div className="h-8 rounded-lg overflow-hidden flex">
          {sortedMealTypes.map((type) => {
            const value = breakdown[type][selectedMacro];
            const percentage = (value / total) * 100;
            if (percentage < 1) return null; // Skip tiny segments
            return (
              <div
                key={type}
                className="h-full transition-all duration-300"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: getMealTypeColor(type),
                }}
                title={`${type === 'unassigned' ? 'Other' : MEAL_TYPE_CONFIG[type as MealType]?.label || type}: ${value.toLocaleString()} ${config.unit}`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend and Values */}
      <div className="space-y-2">
        {sortedMealTypes.map((type) => {
          const value = breakdown[type][selectedMacro];
          const percentage = Math.round((value / total) * 100);
          const label = type === 'unassigned' ? 'Other' : MEAL_TYPE_CONFIG[type as MealType]?.label || type;

          return (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getMealTypeColor(type) }}
                />
                <span className="text-sm text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {value.toLocaleString()} {config.unit}
                </span>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Total</span>
        <span className="text-sm font-bold text-gray-900">
          {total.toLocaleString()} {config.unit}
        </span>
      </div>
    </div>
  );
}
