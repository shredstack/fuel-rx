'use client';

import type { Macros } from '@/lib/types';

interface DailyAverageCardProps {
  averagePerDay: Macros;
  dailyTargets: Macros;
  daysWithData: number;
}

function DeltaBadge({ value, target, unit }: { value: number; target: number; unit: string }) {
  const delta = Math.round(value - target);
  const pct = target > 0 ? Math.abs(delta) / target : 0;

  if (pct <= 0.1) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        On track
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        +{Math.abs(delta)}{unit} over
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      -{Math.abs(delta)}{unit} under
    </span>
  );
}

function CompactProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max;

  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-400' : ''}`}
        style={{
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: isOver ? undefined : color,
        }}
      />
    </div>
  );
}

export default function DailyAverageCard({ averagePerDay, dailyTargets, daysWithData }: DailyAverageCardProps) {
  if (daysWithData === 0) return null;

  const macros = [
    { label: 'Protein', avg: averagePerDay.protein, target: dailyTargets.protein, color: '#3b82f6', unit: 'g' },
    { label: 'Carbs', avg: averagePerDay.carbs, target: dailyTargets.carbs, color: '#22c55e', unit: 'g' },
    { label: 'Fat', avg: averagePerDay.fat, target: dailyTargets.fat, color: '#eab308', unit: 'g' },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M3 20.25h18M3.75 3v16.5h16.5" />
        </svg>
        <h3 className="text-base font-semibold text-gray-900">Daily Average vs Target</h3>
      </div>

      {/* Calories Row */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-indigo-100">
        <div>
          <span className="text-2xl font-bold text-gray-900">
            {averagePerDay.calories.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 ml-1">
            / {dailyTargets.calories.toLocaleString()} cal
          </span>
        </div>
        <DeltaBadge value={averagePerDay.calories} target={dailyTargets.calories} unit=" cal" />
      </div>

      {/* Macro Grid */}
      <div className="grid grid-cols-3 gap-4">
        {macros.map((macro) => {
          const avgRounded = Math.round(macro.avg);
          const targetRounded = Math.round(macro.target);

          return (
            <div key={macro.label}>
              <p className="text-xs font-medium text-gray-500 mb-1">{macro.label}</p>
              <p className="text-lg font-bold text-gray-900">{avgRounded}g</p>
              <p className="text-xs text-gray-400 mb-2">target: {targetRounded}g</p>
              <CompactProgressBar value={macro.avg} max={macro.target} color={macro.color} />
              <div className="mt-2">
                <DeltaBadge value={macro.avg} target={macro.target} unit="g" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
