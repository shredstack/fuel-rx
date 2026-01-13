'use client'

import type { SelectableMealType } from '@/lib/types'
import { MEAL_TYPE_CONFIG } from '@/lib/types'

interface Props {
  selectedTypes: SelectableMealType[]
  snackCount: number
  onTypesChange: (types: SelectableMealType[]) => void
  onSnackCountChange: (count: number) => void
}

// Meal types that can be toggled (excludes snack which has its own counter)
const SELECTABLE_MEAL_TYPES: { type: SelectableMealType; required: boolean }[] = [
  { type: 'breakfast', required: true },
  { type: 'pre_workout', required: false },
  { type: 'lunch', required: true },
  { type: 'post_workout', required: false },
  { type: 'dinner', required: true },
]

export default function MealTypesSelector({
  selectedTypes,
  snackCount,
  onTypesChange,
  onSnackCountChange,
}: Props) {
  const toggleMealType = (type: SelectableMealType) => {
    // Don't allow toggling required types off
    const mealConfig = SELECTABLE_MEAL_TYPES.find(m => m.type === type)
    if (mealConfig?.required && selectedTypes.includes(type)) {
      return
    }

    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type))
    } else {
      // Add in display order
      const allInOrder = SELECTABLE_MEAL_TYPES.map(m => m.type)
      const newTypes = [...selectedTypes, type].sort(
        (a, b) => allInOrder.indexOf(a) - allInOrder.indexOf(b)
      )
      onTypesChange(newTypes)
    }
  }

  return (
    <div className="space-y-6">
      {/* Main meal types */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Which meals do you want in your plan?
        </label>
        <div className="space-y-2">
          {SELECTABLE_MEAL_TYPES.map(({ type, required }) => {
            const config = MEAL_TYPE_CONFIG[type]
            const isSelected = selectedTypes.includes(type)
            const isWorkout = config.isWorkoutMeal

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleMealType(type)}
                disabled={required && isSelected}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? isWorkout
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${required && isSelected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{config.label}</p>
                    {isWorkout && (
                      <p className="text-xs text-gray-500">
                        {type === 'pre_workout' ? 'Quick energy before training' : 'Recovery fuel after training'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {required && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Required</span>
                  )}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? isWorkout
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Snack counter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          How many snacks per day?
        </label>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <span className="text-2xl">{MEAL_TYPE_CONFIG.snack.icon}</span>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Snacks</p>
            <p className="text-xs text-gray-500">Small meals between main meals</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSnackCountChange(Math.max(0, snackCount - 1))}
              disabled={snackCount === 0}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-2xl font-bold text-gray-900 w-8 text-center">{snackCount}</span>
            <button
              type="button"
              onClick={() => onSnackCountChange(Math.min(4, snackCount + 1))}
              disabled={snackCount === 4}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Your daily plan:</strong>{' '}
          {selectedTypes.map(t => MEAL_TYPE_CONFIG[t].label).join(', ')}
          {snackCount > 0 && `, ${snackCount} snack${snackCount > 1 ? 's' : ''}`}
          {' '}({selectedTypes.length + snackCount} eating occasions)
        </p>
      </div>
    </div>
  )
}
