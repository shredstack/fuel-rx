'use client'

import type { MealType } from '@/lib/types'
import { MEAL_TYPE_CONFIG } from '@/lib/types'

interface MealTypePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mealType: MealType) => void
  defaultMealType?: MealType
}

const MEAL_TYPES: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]

export function MealTypePicker({
  isOpen,
  onClose,
  onSelect,
  defaultMealType,
}: MealTypePickerProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log as...</h3>

        <div className="space-y-2">
          {MEAL_TYPES.map((type) => {
            const config = MEAL_TYPE_CONFIG[type]
            const isDefault = type === defaultMealType

            return (
              <button
                key={type}
                onClick={() => {
                  onSelect(type)
                  onClose()
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                  isDefault
                    ? 'bg-primary-50 border border-primary-200 text-primary-700'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="font-medium">{config?.label || type}</span>
                {isDefault && (
                  <span className="text-xs text-primary-600">(default)</span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
