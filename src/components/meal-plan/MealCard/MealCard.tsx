'use client'

import { useState } from 'react'
import type {
  MealSlot,
  MealPreferenceType,
  IngredientPreferenceType,
  IngredientWithNutrition,
  CookingStatus,
  MealPlanMealCookingStatus,
  DayOfWeek,
} from '@/lib/types'
import { getMealTypeColorClasses, MEAL_TYPE_CONFIG } from '@/lib/types'
import { SwapButton } from '@/components/meal'
import CookingStatusButton from '@/components/meal/CookingStatusButton'
import CookingStatusBadge from '@/components/meal/CookingStatusBadge'
import { IngredientRow } from './IngredientRow'
import { MealModificationsSection } from './MealModificationsSection'
import { DayBadge } from '../DayBadge'
import { InlineLogButton } from './InlineLogButton'

interface IngredientPreferencesMap {
  [ingredientNameNormalized: string]: {
    ingredientId: string
    preference: IngredientPreferenceType
  }
}

interface MealCardProps {
  mealSlot: MealSlot
  isExpanded: boolean
  onToggle: () => void
  preference?: MealPreferenceType
  onLike: () => void
  onDislike: () => void
  onIngredientChange: (ingredientIndex: number, newIngredient: IngredientWithNutrition) => Promise<boolean>
  mealPlanId: string
  ingredientPreferences: IngredientPreferencesMap
  onIngredientLike: (ingredientName: string) => void
  onIngredientDislike: (ingredientName: string) => void
  onSwap: () => void
  isFirstMealCard?: boolean
  cookingStatus: CookingStatus
  cookingStatusData?: MealPlanMealCookingStatus
  onCookingStatusChange: (status: CookingStatus, notes?: string, updatedInstructions?: string[], photoUrl?: string, shareWithCommunity?: boolean) => Promise<void>
  socialFeedEnabled?: boolean
  // Props for meal-type view
  showDayBadge?: boolean
  day?: DayOfWeek
  days?: DayOfWeek[]
}

export function MealCard({
  mealSlot,
  isExpanded,
  onToggle,
  preference,
  onLike,
  onDislike,
  onIngredientChange,
  mealPlanId,
  ingredientPreferences,
  onIngredientLike,
  onIngredientDislike,
  onSwap,
  isFirstMealCard = false,
  cookingStatus,
  cookingStatusData,
  onCookingStatusChange,
  socialFeedEnabled = false,
  showDayBadge = false,
  day,
  days,
}: MealCardProps) {
  const meal = mealSlot.meal
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
  const [savingIngredient, setSavingIngredient] = useState(false)

  const mealTypeConfig = MEAL_TYPE_CONFIG[meal.meal_type]

  return (
    <div className="card" {...(isFirstMealCard ? { 'data-tour': 'meal-card' } : {})}>
      <div className="flex items-start justify-between">
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getMealTypeColorClasses(meal.meal_type)}`}>
              {mealTypeConfig?.label || meal.meal_type}
            </span>
            <span className="text-xs text-gray-500">
              {meal.prep_time_minutes} min
            </span>
            {!mealSlot.is_original && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                Swapped
              </span>
            )}
            <CookingStatusBadge status={cookingStatus} />
            {showDayBadge && (days ? <DayBadge days={days} /> : day ? <DayBadge day={day} /> : null)}
          </div>
          <h4 className="text-lg font-semibold text-gray-900">{meal.name}</h4>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <span className="text-gray-600">
              <span className="font-medium">{Math.round(meal.calories)}</span> kcal
            </span>
            <span className="text-blue-600">
              <span className="font-medium">{Math.round(meal.protein)}g</span> protein
            </span>
            <span className="text-orange-600">
              <span className="font-medium">{Math.round(meal.carbs)}g</span> carbs
            </span>
            <span className="text-purple-600">
              <span className="font-medium">{Math.round(meal.fat)}g</span> fat
            </span>
          </div>
        </button>

        {/* Swap, Like/Dislike and Expand buttons */}
        <div
          className="flex items-center gap-2 ml-4"
          {...(isFirstMealCard ? { 'data-tour': 'like-dislike' } : {})}
        >
          <CookingStatusButton
            status={cookingStatus}
            mealName={meal.name}
            currentInstructions={meal.instructions}
            onStatusChange={onCookingStatusChange}
            variant="icon"
            socialFeedEnabled={socialFeedEnabled}
          />
          <InlineLogButton
            mealSlot={mealSlot}
            mealPlanMealId={mealSlot.id}
            defaultMealType={mealSlot.meal_type}
          />
          <span {...(isFirstMealCard ? { 'data-tour': 'swap-button' } : {})}>
            <SwapButton onClick={onSwap} />
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLike()
            }}
            className={`p-2 rounded-full transition-colors ${
              preference === 'liked'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title="Like this meal"
          >
            <svg className="w-5 h-5" fill={preference === 'liked' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDislike()
            }}
            className={`p-2 rounded-full transition-colors ${
              preference === 'disliked'
                ? 'bg-red-100 text-red-600'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
            }`}
            title="Dislike this meal"
          >
            <svg className="w-5 h-5" fill={preference === 'disliked' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-2"
          >
            <svg
              className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Your Modifications Section - shown when there are notes or photos */}
          {cookingStatusData && (cookingStatusData.modification_notes || cookingStatusData.cooked_photo_url) && (
            <MealModificationsSection
              cookingStatusData={cookingStatusData}
              meal={meal}
              mealPlanId={mealPlanId}
              mealSlotId={mealSlot.id}
            />
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Ingredients with Nutrition */}
            <div>
              <h5 className="font-medium text-gray-900 mb-2">
                Ingredients
                <span className="text-xs text-gray-400 font-normal ml-2">(click to edit nutrition)</span>
              </h5>
              <ul className="space-y-2">
                {meal.ingredients.map((ing, idx) => (
                  <IngredientRow
                    key={idx}
                    ingredient={ing}
                    isEditing={editingIngredientIndex === idx}
                    isSaving={savingIngredient && editingIngredientIndex === idx}
                    onStartEdit={() => setEditingIngredientIndex(idx)}
                    onCancelEdit={() => setEditingIngredientIndex(null)}
                    onSave={async (updatedIng) => {
                      setSavingIngredient(true)
                      const success = await onIngredientChange(idx, updatedIng)
                      if (success) {
                        setEditingIngredientIndex(null)
                      }
                      setSavingIngredient(false)
                    }}
                    mealName={meal.name}
                    mealPlanId={mealPlanId}
                    preference={ingredientPreferences[ing.name.toLowerCase().trim()]?.preference}
                    onLike={() => onIngredientLike(ing.name)}
                    onDislike={() => onIngredientDislike(ing.name)}
                  />
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Instructions</h5>
              <ol className="space-y-2">
                {meal.instructions.map((step, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{idx + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
