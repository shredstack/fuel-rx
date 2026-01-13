'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DailyDataPoint, Macros, MealType } from '@/lib/types';
import { MEAL_TYPE_LABELS } from '@/lib/types';

type MacroType = 'calories' | 'protein' | 'carbs' | 'fat';
type MealTypeFilter = MealType | 'all';

interface ChartDataPoint {
  label: string;
  fullDate: string;
  total: number;
  entry_count: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

interface TrendChartProps {
  dailyData: DailyDataPoint[];
  dailyTargets: Macros;
  periodType: 'weekly' | 'monthly';
}

const MACRO_CONFIG: Record<MacroType, { label: string; color: string; unit: string }> = {
  calories: { label: 'Calories', color: '#f97316', unit: 'cal' },
  protein: { label: 'Protein', color: '#3b82f6', unit: 'g' },
  carbs: { label: 'Carbs', color: '#22c55e', unit: 'g' },
  fat: { label: 'Fat', color: '#eab308', unit: 'g' },
};

const MEAL_TYPE_COLORS: Record<MealType, string> = {
  breakfast: '#f97316', // orange
  lunch: '#3b82f6',     // blue
  dinner: '#8b5cf6',    // purple
  snack: '#22c55e',     // green
};

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function formatDate(dateStr: string, periodType: 'weekly' | 'monthly'): string {
  const date = new Date(dateStr);
  if (periodType === 'weekly') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.getDate().toString();
}

export default function TrendChart({ dailyData, dailyTargets, periodType }: TrendChartProps) {
  const [selectedMacro, setSelectedMacro] = useState<MacroType>('calories');
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealTypeFilter[]>(['all']);

  const config = MACRO_CONFIG[selectedMacro];
  const targetValue = dailyTargets[selectedMacro];

  // Check if we're showing all data or filtering by meal type
  const showingAll = selectedMealTypes.includes('all');
  const activeMealTypes = showingAll ? [] : (selectedMealTypes as MealType[]);

  // Toggle meal type selection
  const toggleMealType = (type: MealTypeFilter) => {
    if (type === 'all') {
      setSelectedMealTypes(['all']);
    } else {
      // Remove 'all' if selecting specific meal types
      let newSelection = selectedMealTypes.filter((t) => t !== 'all') as MealType[];

      if (newSelection.includes(type)) {
        // Remove this type
        newSelection = newSelection.filter((t) => t !== type);
        // If nothing selected, go back to 'all'
        if (newSelection.length === 0) {
          setSelectedMealTypes(['all']);
          return;
        }
      } else {
        // Add this type
        newSelection = [...newSelection, type];
      }
      setSelectedMealTypes(newSelection);
    }
  };

  // Format data for chart - include per-meal-type values for multi-line display
  const chartData: ChartDataPoint[] = dailyData.map((day) => {
    const getMealTypeValue = (mealType: MealType): number => {
      if (day.byMealType) {
        return Math.round(day.byMealType[mealType][selectedMacro] * 10) / 10;
      }
      return 0;
    };

    return {
      label: formatDate(day.date, periodType),
      fullDate: new Date(day.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      total: day[selectedMacro],
      entry_count: day.entry_count,
      breakfast: getMealTypeValue('breakfast'),
      lunch: getMealTypeValue('lunch'),
      dinner: getMealTypeValue('dinner'),
      snack: getMealTypeValue('snack'),
    };
  });

  // Calculate y-axis domain based on what's being displayed
  let maxValue: number;
  if (showingAll) {
    maxValue = Math.max(
      targetValue * 1.2,
      ...chartData.map((d) => d.total)
    );
  } else {
    // Get max across all selected meal types
    const allValues = activeMealTypes.flatMap((type) =>
      chartData.map((d) => d[type] as number)
    );
    maxValue = Math.max(...allValues) * 1.2 || 100;
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      {/* Macro Toggle */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
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

      {/* Meal Type Filter */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filter by meal:</span>
          <button
            onClick={() => toggleMealType('all')}
            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              showingAll
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleMealType(type)}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                !showingAll && selectedMealTypes.includes(type)
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={
                !showingAll && selectedMealTypes.includes(type)
                  ? { backgroundColor: MEAL_TYPE_COLORS[type] }
                  : undefined
              }
            >
              {MEAL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxValue]}
              tickFormatter={(value) =>
                selectedMacro === 'calories' ? value.toLocaleString() : value
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-gray-900 mb-2">{data.fullDate}</p>
                      {showingAll ? (
                        <>
                          <p className="text-sm" style={{ color: config.color }}>
                            {config.label}: {data.total.toLocaleString()} {config.unit}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Target: {targetValue.toLocaleString()} {config.unit}
                          </p>
                        </>
                      ) : (
                        <>
                          {activeMealTypes.map((type) => (
                            <p key={type} className="text-sm" style={{ color: MEAL_TYPE_COLORS[type] }}>
                              {MEAL_TYPE_LABELS[type]}: {(data[type] as number).toLocaleString()} {config.unit}
                            </p>
                          ))}
                          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                            Total: {data.total.toLocaleString()} {config.unit}
                          </p>
                        </>
                      )}
                      {data.entry_count > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {data.entry_count} {data.entry_count === 1 ? 'entry' : 'entries'}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {showingAll && (
              <ReferenceLine
                y={targetValue}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{
                  value: 'Target',
                  position: 'right',
                  fontSize: 11,
                  fill: '#9ca3af',
                }}
              />
            )}
            {/* Show single line for "All" view */}
            {showingAll && (
              <Line
                type="monotone"
                dataKey="total"
                stroke={config.color}
                strokeWidth={2}
                dot={{ fill: config.color, strokeWidth: 0, r: 4 }}
                activeDot={{ fill: config.color, strokeWidth: 0, r: 6 }}
              />
            )}
            {/* Show separate lines for each selected meal type */}
            {!showingAll && activeMealTypes.map((type) => (
              <Line
                key={type}
                type="monotone"
                dataKey={type}
                name={MEAL_TYPE_LABELS[type]}
                stroke={MEAL_TYPE_COLORS[type]}
                strokeWidth={2}
                dot={{ fill: MEAL_TYPE_COLORS[type], strokeWidth: 0, r: 4 }}
                activeDot={{ fill: MEAL_TYPE_COLORS[type], strokeWidth: 0, r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
        {showingAll ? (
          <>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span>Daily {config.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 border-t-2 border-dashed border-gray-400" />
              <span>Daily Target</span>
            </div>
          </>
        ) : (
          activeMealTypes.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: MEAL_TYPE_COLORS[type] }}
              />
              <span>{MEAL_TYPE_LABELS[type]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
