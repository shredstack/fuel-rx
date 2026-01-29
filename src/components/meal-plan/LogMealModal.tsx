'use client'

import { useState, useEffect } from 'react'
import type { MealSlot, MealType, EditableIngredient, IngredientWithNutrition } from '@/lib/types'
import { MEAL_TYPE_LABELS } from '@/lib/types'
import { useLogMeal } from '@/hooks/queries/useConsumptionMutations'
import { useMealIngredients } from '@/hooks/queries/useMealIngredients'
import MealIngredientEditor from '@/components/consumption/MealIngredientEditor'
import MealTypeSelector from '@/components/consumption/MealTypeSelector'

interface LogMealModalProps {
  isOpen: boolean
  onClose: () => void
  mealSlot: MealSlot
  mealPlanMealId: string
  defaultMealType?: MealType
  onLogSuccess?: () => void
}

// Type for produce tracking in the meal log modal
interface DetectedProduceItem {
  name: string
  amount: string
  unit: string
  category: 'fruit' | 'vegetable'
  estimatedGrams: number
  isSelected: boolean
  adjustedGrams: number
}

// Time-based meal type suggestions
function getTimeBasedMealTypes(): MealType[] {
  const hour = new Date().getHours()
  if (hour < 10) return ['breakfast']
  if (hour < 14) return ['lunch', 'snack']
  if (hour < 18) return ['snack']
  return ['dinner', 'snack']
}

// Convert meal ingredients to editable format
function ingredientsToEditable(ingredients: IngredientWithNutrition[]): EditableIngredient[] {
  return ingredients.map((ing) => {
    const amount = parseFloat(ing.amount) || 0
    return {
      name: ing.name,
      amount,
      originalAmount: amount,
      unit: ing.unit,
      category: ing.category || 'other',
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
      isIncluded: true,
    }
  })
}

// Calculate total macros from editable ingredients
function calculateTotalMacros(ingredients: EditableIngredient[]): {
  calories: number
  protein: number
  carbs: number
  fat: number
} {
  return ingredients
    .filter((ing) => ing.isIncluded && ing.amount > 0)
    .reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.calories,
        protein: acc.protein + ing.protein,
        carbs: acc.carbs + ing.carbs,
        fat: acc.fat + ing.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
}

// Helper to get today's date in user's local timezone as YYYY-MM-DD
function getLocalTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function LogMealModal({
  isOpen,
  onClose,
  mealSlot,
  mealPlanMealId,
  defaultMealType,
  onLogSuccess,
}: LogMealModalProps) {
  const meal = mealSlot.meal
  const logMealMutation = useLogMeal()

  // Meal type selection
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    defaultMealType || mealSlot.meal_type || getTimeBasedMealTypes()[0]
  )

  // Ingredient editing state
  const [showIngredientEditor, setShowIngredientEditor] = useState(false)
  const [editedIngredients, setEditedIngredients] = useState<EditableIngredient[] | null>(null)

  // Fetch meal ingredients when ingredient editor is shown
  const { data: mealWithIngredients, isLoading: ingredientsLoading } = useMealIngredients(
    showIngredientEditor ? meal.id : null
  )

  // Produce tracking state for 800g goal
  const [detectedProduce, setDetectedProduce] = useState<DetectedProduceItem[]>([])
  const [isLoadingProduce, setIsLoadingProduce] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMealType(defaultMealType || mealSlot.meal_type || getTimeBasedMealTypes()[0])
      setShowIngredientEditor(false)
      setEditedIngredients(null)
      setDetectedProduce([])

      // Fetch produce data for 800g tracking
      const fetchProduce = async () => {
        setIsLoadingProduce(true)
        try {
          const response = await fetch('/api/consumption/extract-produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meal_id: meal.id }),
          })

          if (response.ok) {
            const data = await response.json()
            const items = data.produceIngredients || []

            // Initialize produce items with selection state
            const initializedItems: DetectedProduceItem[] = items.map(
              (item: {
                name: string
                amount: string
                unit: string
                category: 'fruit' | 'vegetable'
                estimatedGrams: number
              }) => ({
                ...item,
                isSelected: true,
                adjustedGrams: item.estimatedGrams,
              })
            )

            setDetectedProduce(initializedItems)
          }
        } catch (error) {
          console.error('Error fetching produce:', error)
        } finally {
          setIsLoadingProduce(false)
        }
      }

      fetchProduce()
    }
  }, [isOpen, meal.id, defaultMealType, mealSlot.meal_type])

  // Initialize editable ingredients when meal data loads
  useEffect(() => {
    if (showIngredientEditor && mealWithIngredients?.ingredients && !editedIngredients) {
      setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients))
    }
  }, [showIngredientEditor, mealWithIngredients, editedIngredients])

  const handleLog = async () => {
    const today = getLocalTodayString()

    // Calculate macros - use edited ingredients if modified, otherwise use original meal macros
    const customMacros = editedIngredients ? calculateTotalMacros(editedIngredients) : null

    // Capture selected produce items before clearing state
    const selectedProduceItems = detectedProduce.filter((p) => p.isSelected && p.adjustedGrams > 0)

    try {
      // Build request payload
      const payload: {
        type: 'meal_plan'
        source_id: string
        meal_id: string
        meal_type: MealType
        consumed_at: string
        custom_macros?: { calories: number; protein: number; carbs: number; fat: number }
      } = {
        type: 'meal_plan',
        source_id: mealPlanMealId,
        meal_id: meal.id,
        meal_type: selectedMealType,
        consumed_at: `${today}T${new Date().toTimeString().slice(0, 8)}`,
      }

      // Include custom macros if user modified portions
      if (customMacros) {
        payload.custom_macros = {
          calories: Math.round(customMacros.calories),
          protein: Math.round(customMacros.protein * 10) / 10,
          carbs: Math.round(customMacros.carbs * 10) / 10,
          fat: Math.round(customMacros.fat * 10) / 10,
        }
      }

      await logMealMutation.mutateAsync(payload)

      // Log selected produce items for 800g tracking
      if (selectedProduceItems.length > 0) {
        try {
          await fetch('/api/consumption/log-produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ingredients: selectedProduceItems.map((item) => ({
                name: item.name,
                category: item.category,
                grams: item.adjustedGrams,
              })),
              meal_type: selectedMealType,
              consumed_at: `${today}T${new Date().toTimeString().slice(0, 8)}`,
            }),
          })
        } catch (e) {
          // Silently fail - don't block the main logging flow
          console.error('Error logging produce:', e)
        }
      }

      onLogSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error logging meal:', error)
    }
  }

  if (!isOpen) return null

  // Calculate display macros
  const displayMacros = editedIngredients
    ? calculateTotalMacros(editedIngredients)
    : { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }

  const isModified =
    editedIngredients &&
    (displayMacros.calories !== meal.calories ||
      displayMacros.protein !== meal.protein ||
      displayMacros.carbs !== meal.carbs ||
      displayMacros.fat !== meal.fat)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Log &ldquo;{meal.name}&rdquo;</h3>

        {/* Macro summary - shows edited or original macros */}
        <div
          className={`text-sm mb-4 p-2 rounded ${isModified ? 'bg-amber-50 border border-amber-200' : 'text-gray-500'}`}
        >
          {isModified && <span className="text-amber-600 font-medium">Modified: </span>}
          {Math.round(displayMacros.calories)} cal | {Math.round(displayMacros.protein * 10) / 10}g
          P | {Math.round(displayMacros.carbs * 10) / 10}g C |{' '}
          {Math.round(displayMacros.fat * 10) / 10}g F
        </div>

        {/* Adjust portions toggle */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              if (showIngredientEditor) {
                // Collapse and reset
                setShowIngredientEditor(false)
                setEditedIngredients(null)
              } else {
                // Expand
                setShowIngredientEditor(true)
                // Initialize editable ingredients when meal data is available
                if (mealWithIngredients?.ingredients) {
                  setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients))
                }
              }
            }}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showIngredientEditor ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            {showIngredientEditor ? 'Hide ingredients' : 'Adjust portions'}
          </button>

          {/* Ingredient editor section */}
          {showIngredientEditor && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              {ingredientsLoading ? (
                <div className="text-center py-4 text-gray-500">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading ingredients...
                </div>
              ) : editedIngredients && editedIngredients.length > 0 ? (
                <MealIngredientEditor ingredients={editedIngredients} onChange={setEditedIngredients} />
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  No ingredients available for this meal.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Inline Produce Tracking for 800g Goal */}
        <div className="mb-4">
          {isLoadingProduce ? (
            <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-green-700">Detecting fruits & veggies...</span>
            </div>
          ) : detectedProduce.length > 0 ? (
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🥬</span>
                <span className="font-medium text-green-800 text-sm">Add to 800g Goal</span>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  +{detectedProduce.filter((p) => p.isSelected).reduce((sum, p) => sum + p.adjustedGrams, 0)}g
                </span>
              </div>
              <div className="space-y-2">
                {detectedProduce.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      item.isSelected
                        ? 'bg-white border border-green-200'
                        : 'bg-green-50/50 opacity-60'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => {
                        setDetectedProduce((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, isSelected: !p.isSelected } : p))
                        )
                      }}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        item.isSelected
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {item.isSelected && (
                        <svg
                          className="w-2.5 h-2.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Name */}
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      <span className="text-sm">{item.category === 'fruit' ? '🍎' : '🥬'}</span>
                      <span
                        className={`text-sm truncate ${item.isSelected ? 'text-gray-900' : 'text-gray-500'}`}
                      >
                        {item.name}
                      </span>
                    </div>

                    {/* Gram adjuster */}
                    {item.isSelected && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDetectedProduce((prev) =>
                              prev.map((p, i) =>
                                i === index
                                  ? { ...p, adjustedGrams: Math.max(0, p.adjustedGrams - 25) }
                                  : p
                              )
                            )
                          }}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.adjustedGrams}
                          onChange={(e) => {
                            const newGrams = parseInt(e.target.value) || 0
                            setDetectedProduce((prev) =>
                              prev.map((p, i) =>
                                i === index ? { ...p, adjustedGrams: Math.max(0, newGrams) } : p
                              )
                            )
                          }}
                          className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs font-semibold"
                        />
                        <span className="text-xs text-gray-500">g</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDetectedProduce((prev) =>
                              prev.map((p, i) =>
                                i === index ? { ...p, adjustedGrams: p.adjustedGrams + 25 } : p
                              )
                            )
                          }}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Meal type selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Log as:</label>
          <MealTypeSelector
            value={selectedMealType}
            onChange={setSelectedMealType}
            suggestedTypes={getTimeBasedMealTypes()}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLog}
            disabled={logMealMutation.isPending}
            className="flex-1 px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {logMealMutation.isPending ? 'Logging...' : 'Log'}
          </button>
        </div>
      </div>
    </div>
  )
}
