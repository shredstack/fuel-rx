'use client'

import type { MealType, MealConsistencyPrefs, SelectableMealType } from '@/lib/types'
import { MEAL_TYPE_CONFIG } from '@/lib/types'

interface Props {
  prefs: MealConsistencyPrefs
  onChange: (prefs: MealConsistencyPrefs) => void
  /** Optional: If provided, only show selected meal types + snacks (if snackCount > 0) */
  selectedTypes?: SelectableMealType[]
  /** Optional: If > 0, include snack in the list */
  snackCount?: number
}

// Meal types that should always be "Same Daily" and not editable
const LOCKED_CONSISTENT_TYPES: MealType[] = ['pre_workout', 'post_workout']

export default function MealConsistencyEditor({
  prefs,
  onChange,
  selectedTypes,
  snackCount = 0
}: Props) {
  const toggleMealConsistency = (mealType: MealType) => {
    onChange({
      ...prefs,
      [mealType]: prefs[mealType] === 'varied' ? 'consistent' : 'varied',
    })
  }

  // Determine which meal types to show
  let mealTypesToShow: MealType[]
  if (selectedTypes) {
    // Filter to only selected types, maintaining display order
    const sortedTypes = [...selectedTypes].sort((a, b) => {
      return MEAL_TYPE_CONFIG[a].displayOrder - MEAL_TYPE_CONFIG[b].displayOrder
    }) as MealType[]

    // Add snacks if user has snacks
    if (snackCount > 0) {
      // Find the right position to insert snack based on display order
      const snackOrder = MEAL_TYPE_CONFIG.snack.displayOrder
      const insertIndex = sortedTypes.findIndex(t => MEAL_TYPE_CONFIG[t].displayOrder > snackOrder)
      if (insertIndex === -1) {
        sortedTypes.push('snack')
      } else {
        sortedTypes.splice(insertIndex, 0, 'snack')
      }
    }

    mealTypesToShow = sortedTypes
  } else {
    // Show all meal types in display order
    mealTypesToShow = (Object.keys(MEAL_TYPE_CONFIG) as MealType[]).sort((a, b) => {
      return MEAL_TYPE_CONFIG[a].displayOrder - MEAL_TYPE_CONFIG[b].displayOrder
    })
  }

  return (
    <div className="space-y-4">
      {mealTypesToShow.map((mealType) => {
        const isLocked = LOCKED_CONSISTENT_TYPES.includes(mealType)
        const config = MEAL_TYPE_CONFIG[mealType]

        return (
          <div
            key={mealType}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span>{config.icon}</span>
              <span className="font-medium text-gray-900">
                {config.label}
              </span>
              {isLocked && (
                <span className="text-xs text-gray-500">(always same)</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isLocked && prefs[mealType] !== 'consistent') {
                    toggleMealConsistency(mealType)
                  }
                }}
                disabled={isLocked}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  prefs[mealType] === 'consistent' || isLocked
                    ? isLocked
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Same Daily
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLocked && prefs[mealType] !== 'varied') {
                    toggleMealConsistency(mealType)
                  }
                }}
                disabled={isLocked}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLocked
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : prefs[mealType] === 'varied'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Varied
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
