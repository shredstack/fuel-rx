'use client'

import { useState, useEffect } from 'react'
import type {
  AdminIngredient,
  IngredientCategoryType,
  IngredientNutrition,
} from '@/lib/types'

interface Props {
  ingredient: AdminIngredient
  onClose: () => void
  onSave: (updated: AdminIngredient) => void
}

const CATEGORY_OPTIONS: { value: IngredientCategoryType; label: string }[] = [
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'grain', label: 'Grain' },
  { value: 'fat', label: 'Fat' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'other', label: 'Other' },
]

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  llm_estimated: { label: 'LLM Estimated', color: 'bg-yellow-100 text-yellow-800' },
  usda: { label: 'USDA', color: 'bg-green-100 text-green-800' },
  user_corrected: { label: 'User Corrected', color: 'bg-blue-100 text-blue-800' },
  barcode_scan: { label: 'Barcode Scan', color: 'bg-purple-100 text-purple-800' },
}

export default function EditIngredientModal({ ingredient, onClose, onSave }: Props) {
  // Form state
  const [name, setName] = useState(ingredient.name)
  const [category, setCategory] = useState<IngredientCategoryType | ''>(
    ingredient.category || ''
  )
  const [validated, setValidated] = useState(ingredient.validated)
  const [nutrition, setNutrition] = useState<IngredientNutrition[]>([])
  const [loadingNutrition, setLoadingNutrition] = useState(true)
  const [showNutrition, setShowNutrition] = useState(false)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track edited nutrition
  const [editedNutrition, setEditedNutrition] = useState<Record<string, Partial<IngredientNutrition>>>({})

  // Fetch nutrition data
  useEffect(() => {
    const fetchNutrition = async () => {
      try {
        const response = await fetch(`/api/admin/ingredients/${ingredient.id}`)
        if (response.ok) {
          const data: AdminIngredient = await response.json()
          setNutrition(data.nutrition || [])
        }
      } catch (err) {
        console.error('Failed to fetch nutrition:', err)
      } finally {
        setLoadingNutrition(false)
      }
    }
    fetchNutrition()
  }, [ingredient.id])

  // Handle nutrition field change
  const handleNutritionChange = (
    nutritionId: string,
    field: keyof IngredientNutrition,
    value: string | number
  ) => {
    setEditedNutrition(prev => ({
      ...prev,
      [nutritionId]: {
        ...prev[nutritionId],
        [field]: value,
      },
    }))
  }

  // Save changes
  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      // Save ingredient changes
      const ingredientUpdates: Record<string, unknown> = {}
      if (name !== ingredient.name) ingredientUpdates.name = name
      if (category !== ingredient.category) ingredientUpdates.category = category
      if (validated !== ingredient.validated) ingredientUpdates.validated = validated

      if (Object.keys(ingredientUpdates).length > 0) {
        const response = await fetch(`/api/admin/ingredients/${ingredient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ingredientUpdates),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update ingredient')
        }
      }

      // Save nutrition changes
      for (const [nutritionId, changes] of Object.entries(editedNutrition)) {
        if (Object.keys(changes).length > 0) {
          const response = await fetch(
            `/api/admin/ingredients/${nutritionId}/nutrition`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(changes),
            }
          )

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to update nutrition')
          }
        }
      }

      // Return updated ingredient
      onSave({
        ...ingredient,
        name,
        name_normalized: name.toLowerCase().trim(),
        category: category || null,
        validated,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Check if there are unsaved changes
  const hasChanges =
    name !== ingredient.name ||
    category !== (ingredient.category || '') ||
    validated !== ingredient.validated ||
    Object.keys(editedNutrition).length > 0

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Edit Ingredient</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as IngredientCategoryType | '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select category...</option>
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="validated"
                checked={validated}
                onChange={e => setValidated(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="validated" className="text-sm font-medium text-gray-700">
                Validated (FuelRx approved)
              </label>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Source:</span>{' '}
                {ingredient.is_user_added ? (
                  <span className="text-purple-600">User Added</span>
                ) : (
                  <span className="text-gray-900">System</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">{formatDate(ingredient.created_at)}</span>
              </div>
              {ingredient.added_by_user_id && (
                <div className="col-span-2">
                  <span className="text-gray-500">Added By:</span>{' '}
                  <span className="text-gray-900 font-mono text-xs">
                    {ingredient.added_by_user_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Nutrition Section */}
          <div>
            <button
              onClick={() => setShowNutrition(!showNutrition)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showNutrition ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Nutrition Data ({nutrition.length} records)
            </button>

            {showNutrition && (
              <div className="mt-4 space-y-4">
                {loadingNutrition ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : nutrition.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No nutrition data available
                  </div>
                ) : (
                  nutrition.map(nut => (
                    <div
                      key={nut.id}
                      className="border border-gray-200 rounded-lg p-4 space-y-3"
                    >
                      {/* Serving info and source badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editedNutrition[nut.id]?.serving_size ?? nut.serving_size}
                            onChange={e =>
                              handleNutritionChange(
                                nut.id,
                                'serving_size',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={editedNutrition[nut.id]?.serving_unit ?? nut.serving_unit}
                            onChange={e =>
                              handleNutritionChange(nut.id, 'serving_unit', e.target.value)
                            }
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            SOURCE_LABELS[nut.source]?.color || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {SOURCE_LABELS[nut.source]?.label || nut.source}
                        </span>
                      </div>

                      {/* Macros */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Calories
                          </label>
                          <input
                            type="number"
                            value={editedNutrition[nut.id]?.calories ?? nut.calories}
                            onChange={e =>
                              handleNutritionChange(
                                nut.id,
                                'calories',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Protein (g)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editedNutrition[nut.id]?.protein ?? nut.protein}
                            onChange={e =>
                              handleNutritionChange(
                                nut.id,
                                'protein',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Carbs (g)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editedNutrition[nut.id]?.carbs ?? nut.carbs}
                            onChange={e =>
                              handleNutritionChange(
                                nut.id,
                                'carbs',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Fat (g)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editedNutrition[nut.id]?.fat ?? nut.fat}
                            onChange={e =>
                              handleNutritionChange(
                                nut.id,
                                'fat',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
