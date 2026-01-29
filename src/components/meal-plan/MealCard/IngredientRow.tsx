'use client'

import { useState } from 'react'
import type { IngredientWithNutrition, IngredientPreferenceType } from '@/lib/types'
import { MacroInput } from '@/components/ui'

interface IngredientRowProps {
  ingredient: IngredientWithNutrition
  isEditing: boolean
  isSaving: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (updatedIngredient: IngredientWithNutrition) => Promise<void>
  mealName: string
  mealPlanId: string
  preference?: IngredientPreferenceType
  onLike: () => void
  onDislike: () => void
}

export function IngredientRow({
  ingredient,
  isEditing,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSave,
  mealName,
  mealPlanId,
  preference,
  onLike,
  onDislike,
}: IngredientRowProps) {
  const [editValues, setEditValues] = useState({
    calories: ingredient.calories ?? 0,
    protein: ingredient.protein ?? 0,
    carbs: ingredient.carbs ?? 0,
    fat: ingredient.fat ?? 0,
  })

  // IngredientWithNutrition always has nutrition data
  const hasNutritionData = true

  const handleSave = async () => {
    const newCalories = editValues.calories
    const newProtein = editValues.protein
    const newCarbs = editValues.carbs
    const newFat = editValues.fat

    // Save to user overrides API
    try {
      await fetch('/api/ingredient-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_name: ingredient.name,
          serving_size: parseFloat(ingredient.amount) || 1,
          serving_unit: ingredient.unit,
          original_calories: ingredient.calories,
          original_protein: ingredient.protein,
          original_carbs: ingredient.carbs,
          original_fat: ingredient.fat,
          override_calories: newCalories,
          override_protein: newProtein,
          override_carbs: newCarbs,
          override_fat: newFat,
          meal_plan_id: mealPlanId,
          meal_name: mealName,
        }),
      })
    } catch (error) {
      console.error('Error saving ingredient override:', error)
    }

    // Update local state
    await onSave({
      ...ingredient,
      calories: newCalories,
      protein: newProtein,
      carbs: newCarbs,
      fat: newFat,
    })
  }

  if (isEditing) {
    return (
      <li className="text-sm bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="font-medium text-gray-900 mb-2">
          {ingredient.amount} {ingredient.unit} {ingredient.name}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <MacroInput
            macroType="calories"
            value={editValues.calories}
            onChange={(val) => setEditValues({ ...editValues, calories: val })}
            size="sm"
          />
          <MacroInput
            macroType="protein"
            value={editValues.protein}
            onChange={(val) => setEditValues({ ...editValues, protein: val })}
            size="sm"
          />
          <MacroInput
            macroType="carbs"
            value={editValues.carbs}
            onChange={(val) => setEditValues({ ...editValues, carbs: val })}
            size="sm"
          />
          <MacroInput
            macroType="fat"
            value={editValues.fat}
            onChange={(val) => setEditValues({ ...editValues, fat: val })}
            size="sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="text-sm text-gray-600 p-2 hover:bg-gray-50 rounded group transition-colors">
      <div className="flex justify-between items-center">
        <div className="flex-1 cursor-pointer" onClick={onStartEdit}>
          <div className="flex items-start gap-1">
            <span>{ingredient.amount} {ingredient.unit} {ingredient.name}</span>
            <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          {hasNutritionData && (
            <div className="flex gap-3 text-xs text-gray-400 mt-1">
              <span>{ingredient.calories ?? 0} cal</span>
              <span className="text-blue-400">{ingredient.protein ?? 0}g P</span>
              <span className="text-orange-400">{ingredient.carbs ?? 0}g C</span>
              <span className="text-purple-400">{ingredient.fat ?? 0}g F</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLike()
            }}
            className={`p-1 rounded-full transition-colors ${
              preference === 'liked'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
            }`}
            title="Like this ingredient"
          >
            <svg className="w-4 h-4" fill={preference === 'liked' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDislike()
            }}
            className={`p-1 rounded-full transition-colors ${
              preference === 'disliked'
                ? 'bg-red-100 text-red-600'
                : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
            }`}
            title="Dislike this ingredient"
          >
            <svg className="w-4 h-4" fill={preference === 'disliked' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}
