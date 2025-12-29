'use client'

import type { MealType, MealConsistencyPrefs } from '@/lib/types'
import { MEAL_TYPE_LABELS } from '@/lib/types'

interface Props {
  prefs: MealConsistencyPrefs
  onChange: (prefs: MealConsistencyPrefs) => void
}

export default function MealConsistencyEditor({ prefs, onChange }: Props) {
  const toggleMealConsistency = (mealType: MealType) => {
    onChange({
      ...prefs,
      [mealType]: prefs[mealType] === 'varied' ? 'consistent' : 'varied',
    })
  }

  return (
    <div className="space-y-4">
      {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((mealType) => (
        <div
          key={mealType}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <span className="font-medium text-gray-900">
            {MEAL_TYPE_LABELS[mealType]}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (prefs[mealType] !== 'consistent') {
                  toggleMealConsistency(mealType)
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                prefs[mealType] === 'consistent'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Same Daily
            </button>
            <button
              type="button"
              onClick={() => {
                if (prefs[mealType] !== 'varied') {
                  toggleMealConsistency(mealType)
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                prefs[mealType] === 'varied'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Varied
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
