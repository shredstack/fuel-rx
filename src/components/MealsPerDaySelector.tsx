'use client'

import type { MealsPerDay } from '@/lib/types'
import { MEALS_PER_DAY_OPTIONS } from '@/lib/types'

interface Props {
  value: MealsPerDay
  onChange: (value: MealsPerDay) => void
}

export default function MealsPerDaySelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {MEALS_PER_DAY_OPTIONS.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onChange(num)}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === num
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {num}
        </button>
      ))}
    </div>
  )
}
