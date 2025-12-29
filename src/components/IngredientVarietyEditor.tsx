'use client'

import type { IngredientCategory, IngredientVarietyPrefs } from '@/lib/types'
import { INGREDIENT_CATEGORY_LABELS, INGREDIENT_VARIETY_RANGES } from '@/lib/types'

interface Props {
  prefs: IngredientVarietyPrefs
  onChange: (prefs: IngredientVarietyPrefs) => void
}

export default function IngredientVarietyEditor({ prefs, onChange }: Props) {
  const handleCategoryChange = (category: IngredientCategory, value: number) => {
    onChange({
      ...prefs,
      [category]: value,
    })
  }

  const totalItems = Object.values(prefs).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {(Object.keys(INGREDIENT_CATEGORY_LABELS) as IngredientCategory[]).map((category) => {
        const range = INGREDIENT_VARIETY_RANGES[category]
        const currentValue = prefs[category]

        return (
          <div key={category} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">
                {INGREDIENT_CATEGORY_LABELS[category]}
              </span>
              <span className="text-primary-600 font-semibold">
                {currentValue} {currentValue === 1 ? 'item' : 'items'}
              </span>
            </div>
            <input
              type="range"
              min={range.min}
              max={range.max}
              value={currentValue}
              onChange={(e) => handleCategoryChange(category, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{range.min}</span>
              <span>{range.max}</span>
            </div>
          </div>
        )
      })}

      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Total items:</strong> {totalItems} items on your shopping list
        </p>
      </div>
    </div>
  )
}
