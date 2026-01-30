'use client';

import { useMemo, useState } from 'react';
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
import type { ConsumptionSummaryData, WeeklySummaryDataPoint } from '@/lib/types';

type MacroToggle = 'calories' | 'protein' | 'carbs' | 'fat';

const MACRO_CONFIG: Record<MacroToggle, { label: string; color: string; unit: string; dataKey: keyof WeeklySummaryDataPoint }> = {
  calories: { label: 'Calories', color: '#f97316', unit: 'cal', dataKey: 'avgCalories' },
  protein: { label: 'Protein', color: '#3b82f6', unit: 'g', dataKey: 'avgProtein' },
  carbs: { label: 'Carbs', color: '#22c55e', unit: 'g', dataKey: 'avgCarbs' },
  fat: { label: 'Fat', color: '#eab308', unit: 'g', dataKey: 'avgFat' },
};

interface SummaryViewProps {
  data: ConsumptionSummaryData;
}

export default function SummaryView({ data }: SummaryViewProps) {
  const [activeMacros, setActiveMacros] = useState<MacroToggle[]>(['calories']);

  const toggleMacro = (macro: MacroToggle) => {
    setActiveMacros((prev) => {
      if (prev.includes(macro)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== macro);
      }
      return [...prev, macro];
    });
  };

  // Filter weeks to only those with data for a cleaner chart
  const weeksWithData = useMemo(
    () => data.weeks.filter((w) => w.daysWithData > 0),
    [data.weeks]
  );

  const hasAnyData = weeksWithData.length > 0;

  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Summary Data Yet</h3>
        <p className="text-sm text-gray-500">
          Start logging meals to see your weekly trends over time.
        </p>
      </div>
    );
  }

  // Calculate Y-axis domain for macros chart based on active macros
  const macroMaxValue = Math.max(
    ...activeMacros.map((macro) => {
      const targetVal = data.targets[macro];
      const maxData = Math.max(...weeksWithData.map((w) => w[MACRO_CONFIG[macro].dataKey] as number));
      return Math.max(targetVal * 1.2, maxData * 1.1);
    })
  );

  const fruitVegMax = Math.max(
    data.targets.fruitVegGrams * 1.2,
    ...weeksWithData.map((w) => w.avgFruitVegGrams * 1.1)
  );

  const waterMax = Math.max(
    data.targets.waterOunces * 1.2,
    ...weeksWithData.map((w) => w.avgWaterOunces * 1.1)
  );

  // Show every Nth week label to avoid crowding
  const tickInterval = weeksWithData.length > 26 ? 3 : weeksWithData.length > 13 ? 1 : 0;

  return (
    <div className="space-y-4">
      {/* Chart 1: Calories & Macros */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Avg Daily Calories & Macros by Week
        </h3>

        {/* Macro Toggle */}
        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
          {(Object.keys(MACRO_CONFIG) as MacroToggle[]).map((macro) => (
            <button
              key={macro}
              onClick={() => toggleMacro(macro)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                activeMacros.includes(macro)
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {MACRO_CONFIG[macro].label}
            </button>
          ))}
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeksWithData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={[0, macroMaxValue]}
                tickFormatter={(value) =>
                  activeMacros.includes('calories') && activeMacros.length === 1
                    ? value.toLocaleString()
                    : value
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const week = payload[0].payload as WeeklySummaryDataPoint;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-gray-900 mb-2">
                          Week of {week.weekLabel}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          {week.daysWithData} day{week.daysWithData !== 1 ? 's' : ''} logged
                        </p>
                        {activeMacros.map((macro) => (
                          <div key={macro} className="flex justify-between gap-4 text-sm">
                            <span style={{ color: MACRO_CONFIG[macro].color }}>
                              {MACRO_CONFIG[macro].label}
                            </span>
                            <span className="text-gray-900 font-medium">
                              {Math.round(week[MACRO_CONFIG[macro].dataKey] as number).toLocaleString()}{' '}
                              {MACRO_CONFIG[macro].unit}
                            </span>
                          </div>
                        ))}
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {activeMacros.map((macro) => (
                            <p key={`target-${macro}`} className="text-xs text-gray-400">
                              {MACRO_CONFIG[macro].label} target: {data.targets[macro].toLocaleString()}{' '}
                              {MACRO_CONFIG[macro].unit}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Target reference lines */}
              {activeMacros.map((macro) => (
                <ReferenceLine
                  key={`target-${macro}`}
                  y={data.targets[macro]}
                  stroke={MACRO_CONFIG[macro].color}
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
              ))}
              {/* Data lines */}
              {activeMacros.map((macro) => (
                <Line
                  key={macro}
                  type="monotone"
                  dataKey={MACRO_CONFIG[macro].dataKey}
                  stroke={MACRO_CONFIG[macro].color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ fill: MACRO_CONFIG[macro].color, strokeWidth: 0, r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
          {activeMacros.map((macro) => (
            <div key={macro} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: MACRO_CONFIG[macro].color }}
              />
              <span>Avg {MACRO_CONFIG[macro].label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed border-gray-400" />
            <span>Target</span>
          </div>
        </div>
      </div>

      {/* Chart 2: Fruit & Vegetable Grams */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Avg Daily Fruits & Veggies by Week
        </h3>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeksWithData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={[0, fruitVegMax]}
                tickFormatter={(value) => `${value}g`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const week = payload[0].payload as WeeklySummaryDataPoint;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-gray-900 mb-1">
                          Week of {week.weekLabel}
                        </p>
                        <p className="text-sm" style={{ color: '#22c55e' }}>
                          Avg: {Math.round(week.avgFruitVegGrams)}g / day
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Target: {data.targets.fruitVegGrams}g / day
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {week.daysWithData} day{week.daysWithData !== 1 ? 's' : ''} logged
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={data.targets.fruitVegGrams}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{
                  value: '800g Goal',
                  position: 'right',
                  fontSize: 11,
                  fill: '#9ca3af',
                }}
              />
              <Line
                type="monotone"
                dataKey="avgFruitVegGrams"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ fill: '#22c55e', strokeWidth: 0, r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Avg Fruit & Veg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed border-gray-400" />
            <span>800g Goal</span>
          </div>
        </div>
      </div>

      {/* Chart 3: Water Ounces */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Avg Daily Water by Week
        </h3>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeksWithData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={[0, waterMax]}
                tickFormatter={(value) => `${value}oz`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const week = payload[0].payload as WeeklySummaryDataPoint;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-gray-900 mb-1">
                          Week of {week.weekLabel}
                        </p>
                        <p className="text-sm" style={{ color: '#3b82f6' }}>
                          Avg: {Math.round(week.avgWaterOunces)}oz / day
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Target: {data.targets.waterOunces}oz / day
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={data.targets.waterOunces}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{
                  value: '100oz Goal',
                  position: 'right',
                  fontSize: 11,
                  fill: '#9ca3af',
                }}
              />
              <Line
                type="monotone"
                dataKey="avgWaterOunces"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ fill: '#3b82f6', strokeWidth: 0, r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Avg Water</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed border-gray-400" />
            <span>100oz Goal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
