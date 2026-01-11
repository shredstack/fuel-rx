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
import type { DailyDataPoint, Macros } from '@/lib/types';

type MacroType = 'calories' | 'protein' | 'carbs' | 'fat';

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

function formatDate(dateStr: string, periodType: 'weekly' | 'monthly'): string {
  const date = new Date(dateStr);
  if (periodType === 'weekly') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.getDate().toString();
}

export default function TrendChart({ dailyData, dailyTargets, periodType }: TrendChartProps) {
  const [selectedMacro, setSelectedMacro] = useState<MacroType>('calories');

  const config = MACRO_CONFIG[selectedMacro];
  const targetValue = dailyTargets[selectedMacro];

  // Format data for chart
  const chartData = dailyData.map((day) => ({
    ...day,
    label: formatDate(day.date, periodType),
    fullDate: new Date(day.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  // Calculate y-axis domain
  const maxValue = Math.max(
    targetValue * 1.2,
    ...dailyData.map((d) => d[selectedMacro])
  );

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
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
                      <p className="font-medium text-gray-900 mb-1">{data.fullDate}</p>
                      <p className="text-sm" style={{ color: config.color }}>
                        {config.label}: {data[selectedMacro].toLocaleString()} {config.unit}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Target: {targetValue.toLocaleString()} {config.unit}
                      </p>
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
            <Line
              type="monotone"
              dataKey={selectedMacro}
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 0, r: 4 }}
              activeDot={{ fill: config.color, strokeWidth: 0, r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500">
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
      </div>
    </div>
  );
}
