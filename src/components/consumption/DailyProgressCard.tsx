'use client';

import type { Macros, FruitVegProgress } from '@/lib/types';
import FruitVegProgressBar from './FruitVegProgressBar';

interface DailyProgressCardProps {
  date: string;
  targets: Macros;
  consumed: Macros;
  percentages: Macros;
  entryCount: number;
  fruitVeg?: FruitVegProgress;
}

function ProgressBar({
  value,
  max,
  percentage,
  color,
  rewardOnGoal = false,
}: {
  value: number;
  max: number;
  percentage: number;
  color: string;
  rewardOnGoal?: boolean;
}) {
  const cappedPercentage = Math.min(percentage, 100);
  const goalReached = percentage >= 100;

  // For athlete calorie tracking: red until goal hit, then rainbow to reward fueling up
  // For other macros: normal color, red if over
  const useRainbow = rewardOnGoal && goalReached;
  let barColor: string;
  if (rewardOnGoal && !goalReached) {
    barColor = 'bg-red-400';
  } else if (!rewardOnGoal && percentage > 100) {
    barColor = 'bg-red-500';
  } else {
    barColor = color;
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div
        className={`h-2.5 rounded-full transition-all duration-300 ${useRainbow ? 'animate-rainbow' : barColor}`}
        style={{
          width: `${cappedPercentage}%`,
          ...(useRainbow && {
            background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)',
            backgroundSize: '200% 100%',
          }),
        }}
      />
    </div>
  );
}

export default function DailyProgressCard({ date, targets, consumed, percentages, entryCount, fruitVeg }: DailyProgressCardProps) {
  // Format date for display
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const remaining = {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };

  return (
    <div className="card mb-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{formattedDate}</h2>
        <span className="text-sm text-gray-500">
          {entryCount} {entryCount === 1 ? 'item' : 'items'} logged
        </span>
      </div>

      {/* Main Calorie Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-3xl font-bold text-gray-900">{Math.round(consumed.calories)}</span>
          <span className="text-gray-500">/ {targets.calories} cal</span>
        </div>
        <ProgressBar
          value={consumed.calories}
          max={targets.calories}
          percentage={percentages.calories}
          color="bg-primary-500"
          rewardOnGoal
        />
        <p className="text-sm text-gray-500 mt-1">
          {remaining.calories > 0 ? `${Math.round(remaining.calories)} cal remaining` : 'Goal reached!'}
        </p>
      </div>

      {/* Fruit & Vegetable Progress (800g Challenge) */}
      {fruitVeg && (
        <FruitVegProgressBar
          currentGrams={fruitVeg.currentGrams}
          goalGrams={fruitVeg.goalGrams}
          goalCelebrated={fruitVeg.goalCelebrated}
        />
      )}

      {/* Macro Progress */}
      <div className="grid grid-cols-3 gap-4">
        {/* Protein */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Protein</span>
            <span className="text-gray-500">{percentages.protein}%</span>
          </div>
          <ProgressBar
            value={consumed.protein}
            max={targets.protein}
            percentage={percentages.protein}
            color="bg-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(consumed.protein)}g / {targets.protein}g
          </p>
        </div>

        {/* Carbs */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Carbs</span>
            <span className="text-gray-500">{percentages.carbs}%</span>
          </div>
          <ProgressBar
            value={consumed.carbs}
            max={targets.carbs}
            percentage={percentages.carbs}
            color="bg-yellow-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(consumed.carbs)}g / {targets.carbs}g
          </p>
        </div>

        {/* Fat */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Fat</span>
            <span className="text-gray-500">{percentages.fat}%</span>
          </div>
          <ProgressBar
            value={consumed.fat}
            max={targets.fat}
            percentage={percentages.fat}
            color="bg-pink-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(consumed.fat)}g / {targets.fat}g
          </p>
        </div>
      </div>
    </div>
  );
}
