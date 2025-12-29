'use client'

import type { PrepTime } from '@/lib/types'
import { PREP_TIME_OPTIONS } from '@/lib/types'

interface Props {
  value: PrepTime
  onChange: (value: PrepTime) => void
}

export default function PrepTimeSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PREP_TIME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
