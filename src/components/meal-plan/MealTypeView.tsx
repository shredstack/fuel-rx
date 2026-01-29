'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
  HouseholdServingsPrefs,
  DailyAssembly,
} from '@/lib/types'
import { MEAL_TYPE_CONFIG, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import { groupMealsByTypeDeduped, type DeduplicatedMeal } from '@/lib/meal-plan-utils'
import { MealCard } from './MealCard'
import type { PrepTaskWithSession } from '@/components/prep/prepUtils'

const MEAL_TYPE_STORAGE_KEY = 'fuelrx-mealplan-meal-type'

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
  onCookNow?: (mealSlot: MealSlot) => void
  initialMealType?: MealType | null
  // Prep detail props
  prepTaskMap?: Map<string, PrepTaskWithSession>
  householdServings?: HouseholdServingsPrefs
  dailyAssembly?: DailyAssembly
  prepStyle?: string
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
  onCookNow,
  initialMealType,
  prepTaskMap,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  dailyAssembly,
  prepStyle = 'day_of',
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

  // Selected meal type tab - start with first active type, then sync from storage
  const [selectedMealType, setSelectedMealTypeState] = useState<MealType>(
    activeMealTypes[0] || 'breakfast'
  )

  // Persist meal type to localStorage when it changes
  const setSelectedMealType = useCallback((mealType: MealType) => {
    setSelectedMealTypeState(mealType)
    if (typeof window !== 'undefined') {
      localStorage.setItem(MEAL_TYPE_STORAGE_KEY, mealType)
    }
  }, [])

  // On mount, restore from URL param or localStorage (priority: URL > localStorage > default)
  useEffect(() => {
    // URL param takes highest priority
    if (initialMealType && activeMealTypes.includes(initialMealType)) {
      setSelectedMealTypeState(initialMealType)
      return
    }
    // Check localStorage for saved preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MEAL_TYPE_STORAGE_KEY) as MealType | null
      if (saved && activeMealTypes.includes(saved)) {
        setSelectedMealTypeState(saved)
        return
      }
    }
    // Default to first active type
    if (activeMealTypes.length > 0) {
      setSelectedMealTypeState(activeMealTypes[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {/* Meal type selector - Mobile: dropdown, Desktop: tabs */}
      <div className="mb-6">
        {/* Mobile dropdown */}
        <div className="md:hidden">
          <select
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value as MealType)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
          >
            {activeMealTypes.map((type) => {
              const config = MEAL_TYPE_CONFIG[type]
              const count = groupedMeals.get(type)?.length || 0
              return (
                <option key={type} value={type}>
                  {config?.label || type} ({count})
                </option>
              )
            })}
          </select>
        </div>
        {/* Desktop tabs */}
        <div className="hidden md:flex overflow-x-auto gap-2 pb-2">
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
      </div>

      {/* Meals for selected type (deduplicated) */}
      <div className="space-y-4">
        {mealsForType.map(({ mealSlot, days }, idx) => {
          // Look up prep task by meal name (normalized)
          const prepTask = prepTaskMap?.get(mealSlot.meal.name.toLowerCase().trim())
          return (
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
              onCookNow={onCookNow ? () => onCookNow(mealSlot) : undefined}
              prepTask={prepTask}
              householdServings={householdServings}
              currentDay={days[0]}
              dailyAssembly={dailyAssembly}
              prepStyle={prepStyle}
            />
          )
        })}
      </div>
    </div>
  )
}
