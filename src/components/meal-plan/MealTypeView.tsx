'use client'

import { useState, useMemo, useEffect } from 'react'
import type {
  MealPlanNormalized,
  MealSlot,
  MealPreferenceType,
  IngredientPreferenceType,
  IngredientWithNutrition,
  CookingStatus,
  MealPlanMealCookingStatus,
  DayOfWeek,
  MealType,
} from '@/lib/types'
import { MEAL_TYPE_CONFIG } from '@/lib/types'
import { groupMealsByTypeDeduped, type DeduplicatedMeal } from '@/lib/meal-plan-utils'
import { MealCard } from './MealCard'

interface IngredientPreferencesMap {
  [ingredientNameNormalized: string]: {
    ingredientId: string
    preference: IngredientPreferenceType
  }
}

interface MealPreferencesMap {
  [mealName: string]: MealPreferenceType
}

interface MealTypeViewProps {
  mealPlan: MealPlanNormalized
  expandedMeal: string | null
  onToggleExpand: (mealSlotId: string) => void
  mealPreferences: MealPreferencesMap
  ingredientPreferences: IngredientPreferencesMap
  cookingStatuses: Map<string, MealPlanMealCookingStatus>
  onLike: (mealSlot: MealSlot) => void
  onDislike: (mealSlot: MealSlot) => void
  onIngredientChange: (
    mealSlot: MealSlot,
    ingredientIndex: number,
    newIngredient: IngredientWithNutrition
  ) => Promise<boolean>
  onIngredientLike: (ingredientName: string) => void
  onIngredientDislike: (ingredientName: string) => void
  onSwap: (mealSlot: MealSlot, day: DayOfWeek) => void
  onCookingStatusChange: (
    mealSlotId: string,
    mealId: string,
    status: CookingStatus,
    notes?: string,
    updatedInstructions?: string[],
    photoUrl?: string,
    shareWithCommunity?: boolean
  ) => Promise<void>
  socialFeedEnabled: boolean
}

export function MealTypeView({
  mealPlan,
  expandedMeal,
  onToggleExpand,
  mealPreferences,
  ingredientPreferences,
  cookingStatuses,
  onLike,
  onDislike,
  onIngredientChange,
  onIngredientLike,
  onIngredientDislike,
  onSwap,
  onCookingStatusChange,
  socialFeedEnabled,
}: MealTypeViewProps) {
  // Group meals by type, deduplicating identical meals
  const groupedMeals = useMemo(
    () => groupMealsByTypeDeduped(mealPlan.days),
    [mealPlan.days]
  )

  // Get active meal types (those with at least one meal)
  const MEAL_TYPE_ORDER: MealType[] = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'pre_workout',
    'post_workout',
  ]
  const activeMealTypes = useMemo(
    () =>
      MEAL_TYPE_ORDER.filter((type) => {
        const meals = groupedMeals.get(type)
        return meals && meals.length > 0
      }),
    [groupedMeals]
  )

  // Selected meal type tab
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    activeMealTypes[0] || 'breakfast'
  )

  // Get meals for selected type (deduplicated)
  const mealsForType = groupedMeals.get(selectedMealType) || []

  // Track if user has manually interacted with expand/collapse for current meal type
  const [userToggledTypes, setUserToggledTypes] = useState<Set<MealType>>(new Set())

  // Auto-expand if there's only one distinct meal for this type AND user hasn't manually toggled
  const shouldAutoExpand = mealsForType.length === 1 && !userToggledTypes.has(selectedMealType)

  // Handle toggle with tracking
  const handleToggle = (mealSlotId: string) => {
    // Mark this meal type as user-toggled
    setUserToggledTypes((prev) => new Set(prev).add(selectedMealType))
    onToggleExpand(mealSlotId)
  }

  return (
    <div>
      {/* Meal type tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        {activeMealTypes.map((type) => {
          const config = MEAL_TYPE_CONFIG[type]
          const count = groupedMeals.get(type)?.length || 0
          return (
            <button
              key={type}
              onClick={() => setSelectedMealType(type)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedMealType === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {config?.label || type}
              <span
                className={`ml-2 text-xs ${
                  selectedMealType === type
                    ? 'text-white/80'
                    : 'text-gray-400'
                }`}
              >
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* Meals for selected type (deduplicated) */}
      <div className="space-y-4">
        {mealsForType.map(({ mealSlot, days }, idx) => (
          <MealCard
            key={mealSlot.id}
            mealSlot={mealSlot}
            days={days}
            showDayBadge
            isExpanded={shouldAutoExpand || expandedMeal === mealSlot.id}
            onToggle={() => handleToggle(mealSlot.id)}
            preference={mealPreferences[mealSlot.meal.name]}
            onLike={() => onLike(mealSlot)}
            onDislike={() => onDislike(mealSlot)}
            onIngredientChange={(ingredientIndex, newIngredient) =>
              onIngredientChange(mealSlot, ingredientIndex, newIngredient)
            }
            mealPlanId={mealPlan.id}
            ingredientPreferences={ingredientPreferences}
            onIngredientLike={onIngredientLike}
            onIngredientDislike={onIngredientDislike}
            onSwap={() => onSwap(mealSlot, days[0])}
            isFirstMealCard={idx === 0}
            cookingStatus={
              cookingStatuses.get(mealSlot.id)?.cooking_status || 'not_cooked'
            }
            cookingStatusData={cookingStatuses.get(mealSlot.id)}
            onCookingStatusChange={(
              status,
              notes,
              updatedInstructions,
              photoUrl,
              shareWithCommunity
            ) =>
              onCookingStatusChange(
                mealSlot.id,
                mealSlot.meal.id,
                status,
                notes,
                updatedInstructions,
                photoUrl,
                shareWithCommunity
              )
            }
            socialFeedEnabled={socialFeedEnabled}
          />
        ))}
      </div>
    </div>
  )
}
