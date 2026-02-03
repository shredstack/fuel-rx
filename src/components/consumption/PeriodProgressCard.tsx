'use client';

import type { PeriodConsumptionSummary } from '@/lib/types';

interface PeriodProgressCardProps {
  summary: PeriodConsumptionSummary;
  onPrevious?: () => void;
  onNext?: () => void;
  isNextDisabled?: boolean;
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

export default function PeriodProgressCard({ summary, onPrevious, onNext, isNextDisabled }: PeriodProgressCardProps) {
  const remaining = summary.targets.calories - summary.consumed.calories;
  const dateRange = formatDateRange(summary.startDate, summary.endDate, summary.periodType);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label={`Previous ${summary.periodType === 'weekly' ? 'week' : 'month'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {dateRange}
            </h2>
          </div>
          {onNext && (
            <button
              onClick={onNext}
              disabled={isNextDisabled}
              className={`p-1.5 rounded-lg transition-colors ${
                isNextDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
              aria-label={`Next ${summary.periodType === 'weekly' ? 'week' : 'month'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
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

    </div>
  );
}
