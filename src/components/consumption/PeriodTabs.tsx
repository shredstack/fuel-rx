'use client';

import type { ConsumptionPeriodType } from '@/lib/types';

interface PeriodTabsProps {
  selected: ConsumptionPeriodType;
  onChange: (period: ConsumptionPeriodType) => void;
}

const TABS: { value: ConsumptionPeriodType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'summary', label: 'Summary' },
];

export default function PeriodTabs({ selected, onChange }: PeriodTabsProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            selected === tab.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
