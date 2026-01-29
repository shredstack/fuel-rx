'use client';

import type { PeriodConsumptionSummary, Macros } from '@/lib/types';

interface PeriodProgressCardProps {
  summary: PeriodConsumptionSummary;
  dailyTargets: Macros;
}

// Month names for hydration-safe date formatting
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDateRange(startDate: string, endDate: string, periodType: 'weekly' | 'monthly'): string {
  // Parse date components directly to avoid timezone issues
  // dateStr is in YYYY-MM-DD format
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [, endMonth, endDay] = endDate.split('-').map(Number);

  if (periodType === 'monthly') {
    return `${MONTH_NAMES[startMonth - 1]} ${startYear}`;
  }

  // Weekly format: "Jan 20 - Jan 26"
  const startStr = `${MONTH_NAMES_SHORT[startMonth - 1]} ${startDay}`;
  const endStr = `${MONTH_NAMES_SHORT[endMonth - 1]} ${endDay}`;
  return `${startStr} - ${endStr}`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max;

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : ''}`}
        style={{
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: isOver ? undefined : color,
        }}
      />
    </div>
  );
}

export default function PeriodProgressCard({ summary, dailyTargets }: PeriodProgressCardProps) {
  const remaining = summary.targets.calories - summary.consumed.calories;
  const dateRange = formatDateRange(summary.startDate, summary.endDate, summary.periodType);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {summary.periodType === 'weekly' ? 'This Week' : 'This Month'}
          </h2>
          <p className="text-sm text-gray-500">{dateRange}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {summary.daysWithData} of {summary.dayCount} days logged
          </p>
          <p className="text-xs text-gray-400">{summary.entry_count} total entries</p>
        </div>
      </div>

      {/* Main Calorie Display */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-3xl font-bold text-gray-900">
              {summary.consumed.calories.toLocaleString()}
            </span>
            <span className="text-gray-500 ml-1">
              / {summary.targets.calories.toLocaleString()} cal
            </span>
          </div>
          <span
            className={`text-lg font-semibold ${
              remaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {remaining >= 0 ? `${remaining.toLocaleString()} left` : `${Math.abs(remaining).toLocaleString()} over`}
          </span>
        </div>
        <ProgressBar
          value={summary.consumed.calories}
          max={summary.targets.calories}
          color="#f97316"
        />
      </div>

      {/* Macro Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {/* Protein */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Protein</span>
            <span className="text-xs text-gray-500">{summary.percentages.protein}%</span>
          </div>
          <ProgressBar
            value={summary.consumed.protein}
            max={summary.targets.protein}
            color="#3b82f6"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(summary.consumed.protein)}g / {Math.round(summary.targets.protein)}g
          </p>
        </div>

        {/* Carbs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Carbs</span>
            <span className="text-xs text-gray-500">{summary.percentages.carbs}%</span>
          </div>
          <ProgressBar
            value={summary.consumed.carbs}
            max={summary.targets.carbs}
            color="#22c55e"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(summary.consumed.carbs)}g / {Math.round(summary.targets.carbs)}g
          </p>
        </div>

        {/* Fat */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Fat</span>
            <span className="text-xs text-gray-500">{summary.percentages.fat}%</span>
          </div>
          <ProgressBar
            value={summary.consumed.fat}
            max={summary.targets.fat}
            color="#eab308"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(summary.consumed.fat)}g / {Math.round(summary.targets.fat)}g
          </p>
        </div>
      </div>

      {/* Daily Average */}
      {summary.daysWithData > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Daily Average:</span>{' '}
            {summary.averagePerDay.calories.toLocaleString()} cal
            <span className="mx-2">|</span>
            {summary.averagePerDay.protein}g P
            <span className="mx-1">·</span>
            {summary.averagePerDay.carbs}g C
            <span className="mx-1">·</span>
            {summary.averagePerDay.fat}g F
          </p>
          <p className="text-xs text-gray-400 mt-1">
            vs target: {dailyTargets.calories.toLocaleString()} cal / {dailyTargets.protein}g P / {dailyTargets.carbs}g C / {dailyTargets.fat}g F
          </p>
        </div>
      )}
    </div>
  );
}
