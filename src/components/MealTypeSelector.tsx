'use client'

import { useState } from 'react'
import type { MealType } from '@/lib/types'
import { MEAL_TYPE_LABELS } from '@/lib/types'

interface Props {
  value: MealType
  onChange: (value: MealType) => void
  disabled?: boolean
}

const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
}

const MEAL_TYPE_OPTIONS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function MealTypeSelector({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(false)

  const selectedLabel = MEAL_TYPE_LABELS[value]
  const selectedIcon = MEAL_TYPE_ICONS[value]

  return (
    <div className="relative">
      {/* Selected option button */}
      <button
        type="button"
        onClick={() => !disabled && setExpanded(!expanded)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-primary-400 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedIcon}</span>
          <div className="text-left">
            <p className="font-medium text-gray-900">{selectedLabel}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {expanded && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {MEAL_TYPE_OPTIONS.map((mealType) => {
            const isSelected = value === mealType
            return (
              <button
                key={mealType}
                type="button"
                onClick={() => {
                  onChange(mealType)
                  setExpanded(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  isSelected ? 'bg-primary-50' : ''
                }`}
              >
                <span className="text-2xl">{MEAL_TYPE_ICONS[mealType]}</span>
                <span className="font-medium text-gray-900">{MEAL_TYPE_LABELS[mealType]}</span>
                {isSelected && (
                  <svg className="w-5 h-5 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {expanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
