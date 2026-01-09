'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { IngredientUsageMode } from '@/lib/types'

// Ingredient from database
interface IngredientOption {
  id: string
  name: string
  name_normalized: string
  category: IngredientCategory | null
}

type IngredientCategory = 'protein' | 'grain' | 'vegetable' | 'fat' | 'fruit' | 'dairy' | 'pantry' | 'other'

export interface IngredientSelection {
  selectedIngredients: string[] // ingredient names
  usageMode: IngredientUsageMode
}

interface Props {
  value: IngredientSelection
  onChange: (selection: IngredientSelection) => void
  disabled?: boolean
}

// Category display configuration
const CATEGORY_CONFIG: Record<IngredientCategory, { label: string; emoji: string; order: number }> = {
  protein: { label: 'Proteins', emoji: '🍗', order: 1 },
  grain: { label: 'Grains & Starches', emoji: '🌾', order: 2 },
  vegetable: { label: 'Vegetables', emoji: '🥦', order: 3 },
  fat: { label: 'Healthy Fats', emoji: '🥑', order: 4 },
  fruit: { label: 'Fruits', emoji: '🍎', order: 5 },
  dairy: { label: 'Dairy', emoji: '🧀', order: 6 },
  pantry: { label: 'Pantry', emoji: '🫙', order: 7 },
  other: { label: 'Other', emoji: '🍽️', order: 8 },
}

export default function IngredientSelector({ value, onChange, disabled }: Props) {
  const [ingredients, setIngredients] = useState<IngredientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<IngredientCategory>>(new Set())

  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('ingredients')
          .select('id, name, name_normalized, category')
          .order('name')

        if (error) {
          console.error('Error fetching ingredients:', error)
          return
        }

        setIngredients(data || [])
      } catch (err) {
        console.error('Error fetching ingredients:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchIngredients()
  }, [])

  // Group ingredients by category
  const ingredientsByCategory = ingredients.reduce((acc, ing) => {
    const category = ing.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(ing)
    return acc
  }, {} as Record<IngredientCategory, IngredientOption[]>)

  // Sort categories by configured order
  const sortedCategories = (Object.keys(ingredientsByCategory) as IngredientCategory[])
    .sort((a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order)

  const toggleIngredient = (ingredientName: string) => {
    const newSelected = value.selectedIngredients.includes(ingredientName)
      ? value.selectedIngredients.filter(name => name !== ingredientName)
      : [...value.selectedIngredients, ingredientName]

    onChange({
      ...value,
      selectedIngredients: newSelected,
    })
  }

  const toggleCategory = (category: IngredientCategory) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const selectAllInCategory = (category: IngredientCategory) => {
    const categoryIngredients = ingredientsByCategory[category] || []
    const categoryNames = categoryIngredients.map(ing => ing.name)
    const allSelected = categoryNames.every(name => value.selectedIngredients.includes(name))

    let newSelected: string[]
    if (allSelected) {
      // Deselect all in category
      newSelected = value.selectedIngredients.filter(name => !categoryNames.includes(name))
    } else {
      // Select all in category
      newSelected = [...new Set([...value.selectedIngredients, ...categoryNames])]
    }

    onChange({
      ...value,
      selectedIngredients: newSelected,
    })
  }

  const clearAll = () => {
    onChange({
      ...value,
      selectedIngredients: [],
    })
  }

  const selectedCount = value.selectedIngredients.length

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 h-12 rounded-lg" />
    )
  }

  return (
    <div className="relative">
      {/* Collapsed view / trigger button */}
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
          <span className="text-2xl">🥘</span>
          <div className="text-left">
            <p className="font-medium text-gray-900">
              {selectedCount === 0 ? 'Select ingredients (optional)' : `${selectedCount} ingredient${selectedCount === 1 ? '' : 's'} selected`}
            </p>
            <p className="text-xs text-gray-500">
              {selectedCount === 0
                ? 'Choose specific ingredients to use'
                : value.usageMode === 'only_selected'
                  ? 'Use only these ingredients'
                  : 'Include these, plus additions as needed'
              }
            </p>
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

      {/* Expanded panel */}
      {expanded && !disabled && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Usage mode toggle */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <p className="text-sm font-medium text-gray-700 mb-2">How should the AI use these ingredients?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, usageMode: 'include_with_additions' })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  value.usageMode === 'include_with_additions'
                    ? 'bg-primary-100 border-primary-300 text-primary-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Include these + add more
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, usageMode: 'only_selected' })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  value.usageMode === 'only_selected'
                    ? 'bg-primary-100 border-primary-300 text-primary-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Only use selected
              </button>
            </div>
          </div>

          {/* Selected count and clear */}
          {selectedCount > 0 && (
            <div className="px-4 py-2 bg-primary-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm text-primary-700 font-medium">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Categories */}
          <div className="max-h-80 overflow-y-auto">
            {sortedCategories.map((category) => {
              const config = CATEGORY_CONFIG[category]
              const categoryIngredients = ingredientsByCategory[category] || []
              const isExpanded = expandedCategories.has(category)
              const selectedInCategory = categoryIngredients.filter(ing =>
                value.selectedIngredients.includes(ing.name)
              ).length
              const allSelectedInCategory = selectedInCategory === categoryIngredients.length && categoryIngredients.length > 0

              return (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  {/* Category header */}
                  <div className="flex items-center px-4 py-3 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="flex-1 flex items-center gap-3"
                    >
                      <span className="text-xl">{config.emoji}</span>
                      <span className="font-medium text-gray-900">{config.label}</span>
                      {selectedInCategory > 0 && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                          {selectedInCategory}
                        </span>
                      )}
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        selectAllInCategory(category)
                      }}
                      className="ml-2 text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap"
                    >
                      {allSelectedInCategory ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  {/* Category ingredients */}
                  {isExpanded && (
                    <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                      {categoryIngredients.map((ingredient) => {
                        const isSelected = value.selectedIngredients.includes(ingredient.name)
                        return (
                          <label
                            key={ingredient.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary-100 text-primary-800'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleIngredient(ingredient.name)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm truncate">{ingredient.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Done button */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
