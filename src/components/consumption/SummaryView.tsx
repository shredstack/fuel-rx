'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Tooltip,
} from 'recharts';
import type { ConsumptionSummaryData, WeeklySummaryDataPoint } from '@/lib/types';

type MacroToggle = 'calories' | 'protein' | 'carbs' | 'fat';

const MACRO_CONFIG: Record<
  MacroToggle,
  { label: string; color: string; unit: string; dataKey: keyof WeeklySummaryDataPoint }
> = {
  calories: { label: 'Calories', color: '#f97316', unit: 'cal', dataKey: 'avgCalories' },
  protein: { label: 'Protein', color: '#3b82f6', unit: 'g', dataKey: 'avgProtein' },
  carbs: { label: 'Carbs', color: '#22c55e', unit: 'g', dataKey: 'avgCarbs' },
  fat: { label: 'Fat', color: '#eab308', unit: 'g', dataKey: 'avgFat' },
};

interface SummaryViewProps {
  data: ConsumptionSummaryData;
}

// ============================================
// Highlight Components
// ============================================

interface HighlightCardProps {
  icon: string;
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | null;
}

function HighlightCard({ icon, label, value, subtext, trend }: HighlightCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {subtext && (
        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          {trend === 'up' && <span className="text-green-500">↑</span>}
          {trend === 'down' && <span className="text-red-500">↓</span>}
          {subtext}
        </div>
      )}
    </div>
  );
}

interface StreakBadgeProps {
  icon: string;
  text: string;
  count: string;
}

function StreakBadge({ icon, text, count }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-full px-3 py-1.5 whitespace-nowrap">
      <span>{icon}</span>
      <span className="text-sm font-medium text-gray-800">{text}</span>
      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

// ============================================
// Bar Chart Component
// ============================================

interface WeeklyBarChartProps {
  data: WeeklySummaryDataPoint[];
  dataKey: keyof WeeklySummaryDataPoint;
  target: number;
  color: string;
  unit: string;
  label: string;
}

function WeeklyBarChart({ data, dataKey, target, color, unit, label }: WeeklyBarChartProps) {
  // Calculate Y-axis max
  const maxValue = Math.max(
    target * 1.3,
    Math.max(...data.map((d) => (d[dataKey] as number) * 1.1))
  );

  // Show fewer tick labels on crowded charts
  const tickInterval = data.length > 20 ? 3 : data.length > 10 ? 1 : 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Avg Daily {label} by Week</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 border-t-2 border-dashed border-gray-400" />
            <span>Target</span>
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxValue]}
              tickFormatter={(value) =>
                dataKey === 'avgCalories' ? value.toLocaleString('en-US') : String(value)
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const week = payload[0].payload as WeeklySummaryDataPoint;
                  const value = week[dataKey] as number;
                  const pct = Math.round((value / target) * 100);
                  const hitTarget = value >= target * 0.9;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="font-medium">Week of {week.weekLabel}</p>
                      <p className="text-lg font-bold" style={{ color }}>
                        {Math.round(value)}
                        {unit}
                      </p>
                      <p className={`text-xs ${hitTarget ? 'text-green-400' : 'text-gray-400'}`}>
                        {pct}% of target
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
            <ReferenceLine y={target} stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={2} />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => {
                const value = entry[dataKey] as number;
                const hitTarget = value >= target * 0.9;
                return <Cell key={`cell-${index}`} fill={hitTarget ? color : `${color}60`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// Highlights Calculator
// ============================================

interface MacroStats {
  thisWeek: number;
  lastWeek: number;
  change: number;
  changePct: number;
  streak: number;
  targetHits: number;
  best: number;
}

interface Highlights {
  macros: Record<MacroToggle, MacroStats>;
  avgCalories: number;
  thisWeekWater: number;
  lastWeekWater: number;
  waterPct: number;
  thisWeekFruitVeg: number;
  lastWeekFruitVeg: number;
  fruitVegPct: number;
  totalWeeks: number;
}

function calculateMacroStats(
  weeksWithData: WeeklySummaryDataPoint[],
  dataKey: keyof WeeklySummaryDataPoint,
  target: number,
  currentWeek: WeeklySummaryDataPoint
): MacroStats {
  const thisWeekVal = currentWeek[dataKey] as number;
  const currentWeekHasData = currentWeek.daysWithData > 0;

  // For lastWeek, use the most recent week with data that isn't the current week
  const pastWeeks = currentWeekHasData
    ? weeksWithData.slice(0, -1)
    : weeksWithData;
  const lastWeekVal = pastWeeks.length > 0
    ? (pastWeeks[pastWeeks.length - 1][dataKey] as number)
    : 0;

  // Target hits and streak only count completed weeks with data
  const targetHits = weeksWithData.filter((w) => (w[dataKey] as number) >= target * 0.9).length;

  let streak = 0;
  for (let i = weeksWithData.length - 1; i >= 0; i--) {
    if ((weeksWithData[i][dataKey] as number) >= target * 0.9) {
      streak++;
    } else {
      break;
    }
  }

  const best = weeksWithData.length > 0
    ? Math.max(...weeksWithData.map((w) => w[dataKey] as number))
    : 0;
  const change = thisWeekVal - lastWeekVal;
  const changePct = lastWeekVal > 0 ? Math.round((change / lastWeekVal) * 100) : 0;

  return {
    thisWeek: Math.round(thisWeekVal),
    lastWeek: Math.round(lastWeekVal),
    change: Math.round(change),
    changePct,
    streak,
    targetHits,
    best: Math.round(best),
  };
}

function calculateHighlights(
  weeks: WeeklySummaryDataPoint[],
  targets: ConsumptionSummaryData['targets']
): Highlights {
  const weeksWithData = weeks.filter((w) => w.daysWithData > 0);
  // The last entry in weeks is always the current calendar week
  const currentWeek = weeks[weeks.length - 1];

  const macros: Record<MacroToggle, MacroStats> = {
    calories: calculateMacroStats(weeksWithData, 'avgCalories', targets.calories, currentWeek),
    protein: calculateMacroStats(weeksWithData, 'avgProtein', targets.protein, currentWeek),
    carbs: calculateMacroStats(weeksWithData, 'avgCarbs', targets.carbs, currentWeek),
    fat: calculateMacroStats(weeksWithData, 'avgFat', targets.fat, currentWeek),
  };

  // Overall calorie average
  const avgCalories =
    weeksWithData.length > 0
      ? Math.round(weeksWithData.reduce((sum, w) => sum + w.avgCalories, 0) / weeksWithData.length)
      : 0;

  // Water stats - use actual current week
  const currentWeekHasData = currentWeek.daysWithData > 0;
  const pastWeeks = currentWeekHasData
    ? weeksWithData.slice(0, -1)
    : weeksWithData;

  const thisWeekWater = Math.round(currentWeek.avgWaterOunces);
  const lastWeekWater = pastWeeks.length > 0
    ? Math.round(pastWeeks[pastWeeks.length - 1].avgWaterOunces)
    : 0;
  const waterPct =
    targets.waterOunces > 0
      ? Math.round((currentWeek.avgWaterOunces / targets.waterOunces) * 100)
      : 0;

  // Fruit & Veg stats
  const thisWeekFruitVeg = Math.round(currentWeek.avgFruitVegGrams);
  const lastWeekFruitVeg = pastWeeks.length > 0
    ? Math.round(pastWeeks[pastWeeks.length - 1].avgFruitVegGrams)
    : 0;
  const fruitVegPct =
    targets.fruitVegGrams > 0
      ? Math.round((currentWeek.avgFruitVegGrams / targets.fruitVegGrams) * 100)
      : 0;

  return {
    macros,
    avgCalories,
    thisWeekWater,
    lastWeekWater,
    waterPct,
    thisWeekFruitVeg,
    lastWeekFruitVeg,
    fruitVegPct,
    totalWeeks: weeksWithData.length,
  };
}

// ============================================
// Main Component
// ============================================

export default function SummaryView({ data }: SummaryViewProps) {
  const [selectedMacro, setSelectedMacro] = useState<MacroToggle>('calories');

  // Filter weeks to only those with data
  const weeksWithData = useMemo(
    () => data.weeks.filter((w) => w.daysWithData > 0),
    [data.weeks]
  );

  // Calculate highlights
  const highlights = useMemo(
    () => calculateHighlights(data.weeks, data.targets),
    [data.weeks, data.targets]
  );

  const hasAnyData = weeksWithData.length > 0;

  // Empty state
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

  const config = MACRO_CONFIG[selectedMacro];
  const macroStats = highlights.macros[selectedMacro];

  return (
    <div className="space-y-4">
      {/* Macro Toggle - moved to top so badges react to selection */}
      <div className="bg-white rounded-xl p-1 shadow-sm">
        <div className="flex gap-1">
          {(Object.keys(MACRO_CONFIG) as MacroToggle[]).map((macro) => (
            <button
              key={macro}
              onClick={() => setSelectedMacro(macro)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                selectedMacro === macro
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {MACRO_CONFIG[macro].label}
            </button>
          ))}
        </div>
      </div>

      {/* Streak Badges - dynamic based on selected macro */}
      <div className="flex flex-wrap gap-2">
        {macroStats.streak > 1 && (
          <StreakBadge
            icon="🔥"
            text={`${config.label} streak`}
            count={`${macroStats.streak}wk`}
          />
        )}
        <StreakBadge
          icon="💪"
          text={`${config.label} target`}
          count={`${macroStats.targetHits}/${highlights.totalWeeks}`}
        />
      </div>

      {/* Highlight Cards - dynamic based on selected macro */}
      <div className="grid grid-cols-2 gap-3">
        <HighlightCard
          icon={selectedMacro === 'calories' ? '⚡' : selectedMacro === 'protein' ? '🥩' : selectedMacro === 'carbs' ? '🍚' : '🥑'}
          label={`This Week ${config.label}`}
          value={macroStats.thisWeek > 0
            ? `${macroStats.thisWeek.toLocaleString('en-US')}${config.unit}`
            : 'No data yet'
          }
          subtext={
            macroStats.thisWeek === 0
              ? 'Start logging to track'
              : macroStats.changePct !== 0
                ? `${macroStats.changePct > 0 ? '+' : ''}${macroStats.changePct}% vs last week`
                : 'Same as last week'
          }
          trend={macroStats.thisWeek === 0 ? null : macroStats.change > 0 ? 'up' : macroStats.change < 0 ? 'down' : null}
        />
        <HighlightCard
          icon="🏆"
          label={`Best ${config.label}`}
          value={`${macroStats.best.toLocaleString('en-US')}${config.unit}`}
          subtext="All-time weekly avg"
        />
        <HighlightCard
          icon="🥦"
          label="Fruits & Veggies"
          value={`${highlights.thisWeekFruitVeg}g`}
          subtext={`${highlights.fruitVegPct}% of goal`}
          trend={
            highlights.thisWeekFruitVeg > highlights.lastWeekFruitVeg
              ? 'up'
              : highlights.thisWeekFruitVeg < highlights.lastWeekFruitVeg
                ? 'down'
                : null
          }
        />
        <HighlightCard
          icon="💧"
          label="Water This Week"
          value={`${highlights.thisWeekWater}oz`}
          subtext={`${highlights.waterPct}% of goal`}
          trend={
            highlights.thisWeekWater > highlights.lastWeekWater
              ? 'up'
              : highlights.thisWeekWater < highlights.lastWeekWater
                ? 'down'
                : null
          }
        />
      </div>

      {/* Best Week / Motivation Card - dynamic based on selected macro */}
      {macroStats.best > 0 && (() => {
        const isNewBest = macroStats.thisWeek >= macroStats.best && macroStats.thisWeek > 0;
        const isAlmostBest = macroStats.thisWeek >= macroStats.best * 0.95 && !isNewBest;
        const noDataThisWeek = macroStats.thisWeek === 0;
        const gap = Math.round(macroStats.best - macroStats.thisWeek);
        const pctOfBest = macroStats.best > 0 ? Math.round((macroStats.thisWeek / macroStats.best) * 100) : 0;

        let gradient = 'from-orange-500 to-amber-500';
        let icon = '🏆';
        let title = '';
        let body: React.ReactNode = null;

        if (isNewBest) {
          title = 'New Best Week!';
          body = <>You hit <span className="font-bold">{macroStats.thisWeek.toLocaleString('en-US')}{config.unit} {config.label.toLowerCase()}</span> average — new personal record!</>;
        } else if (isAlmostBest) {
          title = 'Almost There!';
          body = <>You&apos;re at <span className="font-bold">{macroStats.thisWeek.toLocaleString('en-US')}{config.unit}</span> — just {gap}{config.unit} from your best!</>;
        } else if (noDataThisWeek) {
          gradient = 'from-blue-500 to-indigo-500';
          icon = '🎯';
          title = 'Your Best Week';
          body = <>Your best {config.label.toLowerCase()} week averaged <span className="font-bold">{macroStats.best.toLocaleString('en-US')}{config.unit}</span> — start logging to beat it!</>;
        } else {
          gradient = 'from-purple-500 to-indigo-500';
          icon = '📈';
          title = 'Keep Going!';
          body = <>You&apos;re at <span className="font-bold">{pctOfBest}%</span> of your best week (<span className="font-bold">{macroStats.best.toLocaleString('en-US')}{config.unit}</span>) — {gap}{config.unit} to go!</>;
        }

        return (
          <div className={`bg-gradient-to-r ${gradient} rounded-xl p-4 text-white shadow-lg`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{icon}</span>
              <span className="font-bold">{title}</span>
            </div>
            <p className="text-sm opacity-90">{body}</p>
          </div>
        );
      })()}

      {/* Main Macro Bar Chart */}
      <WeeklyBarChart
        data={weeksWithData}
        dataKey={config.dataKey}
        target={data.targets[selectedMacro]}
        color="#8b5cf6"
        unit={config.unit}
        label={config.label}
      />

      {/* Fruit & Veg Chart */}
      <WeeklyBarChart
        data={weeksWithData}
        dataKey="avgFruitVegGrams"
        target={data.targets.fruitVegGrams}
        color="#22c55e"
        unit="g"
        label="Fruits & Veggies"
      />

      {/* Water Chart */}
      <WeeklyBarChart
        data={weeksWithData}
        dataKey="avgWaterOunces"
        target={data.targets.waterOunces}
        color="#3b82f6"
        unit="oz"
        label="Water"
      />

    </div>
  );
}
