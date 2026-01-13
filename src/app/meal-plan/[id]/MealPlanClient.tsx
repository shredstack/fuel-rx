'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  Ingredient,
  MealPreferenceType,
  IngredientPreferenceType,
  IngredientPreferenceWithDetails,
  MealPlanNormalized,
  DayPlanNormalized,
  MealSlot,
  MealEntity,
  DayOfWeek,
  IngredientWithNutrition,
  SwapResponse,
  CustomMealPrepTime,
  CookingStatus,
  MealPlanMealCookingStatus,
} from '@/lib/types'
import { normalizeCoreIngredients } from '@/lib/types'
import CoreIngredientsCard from '@/components/CoreIngredientsCard'
import ThemeBadge from '@/components/ThemeBadge'
import { SwapButton, SwapModal } from '@/components/meal'
import CookingStatusButton from '@/components/meal/CookingStatusButton'
import CookingStatusBadge from '@/components/meal/CookingStatusBadge'
import { ShareMealPlanModal } from '@/components/ShareMealPlanModal'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import SpotlightTip from '@/components/onboarding/SpotlightTip'
import { FIRST_PLAN_TOUR_STEPS } from '@/lib/types'
import Logo from '@/components/Logo'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  mealPlan: MealPlanNormalized & {
    grocery_list: Ingredient[]
  }
}

interface MealPreferencesMap {
  [mealName: string]: MealPreferenceType
}

interface IngredientPreferencesMap {
  [ingredientNameNormalized: string]: {
    ingredientId: string
    preference: IngredientPreferenceType
  }
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

// Convert prep_time_minutes to CustomMealPrepTime format for social feed
function minutesToPrepTime(minutes: number): CustomMealPrepTime {
  if (minutes <= 5) return '5_or_less'
  if (minutes <= 15) return '15'
  if (minutes <= 30) return '30'
  return 'more_than_30'
}

export default function MealPlanClient({ mealPlan: initialMealPlan }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [mealPlan, setMealPlan] = useState(initialMealPlan)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(mealPlan.days[0]?.day || 'monday')
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(mealPlan.is_favorite)
  const [togglingFavorite, setTogglingFavorite] = useState(false)

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(mealPlan.title || '')
  const [savingTitle, setSavingTitle] = useState(false)

  // Meal preferences state
  const [mealPreferences, setMealPreferences] = useState<MealPreferencesMap>({})

  // Ingredient preferences state
  const [ingredientPreferences, setIngredientPreferences] = useState<IngredientPreferencesMap>({})

  // Swap modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapTarget, setSwapTarget] = useState<{
    mealSlot: MealSlot
    day: DayOfWeek
  } | null>(null)

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false)

  // Cooking status state
  const [cookingStatuses, setCookingStatuses] = useState<Map<string, MealPlanMealCookingStatus>>(new Map())

  // Onboarding state
  const {
    state: onboardingState,
    shouldShowTour,
    currentTourStep,
    advanceTourStep,
    completeTour,
    skipTour,
    markMilestone,
  } = useOnboardingState()

  // Mark first_plan_viewed milestone on mount
  useEffect(() => {
    if (onboardingState && !onboardingState.first_plan_viewed) {
      markMilestone('first_plan_viewed')
    }
  }, [onboardingState, markMilestone])

  // Load meal preferences on mount
  useEffect(() => {
    const loadMealPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('meal_preferences')
        .select('meal_name, preference')
        .eq('user_id', user.id)

      if (data) {
        const prefsMap: MealPreferencesMap = {}
        data.forEach(pref => {
          prefsMap[pref.meal_name] = pref.preference as MealPreferenceType
        })
        setMealPreferences(prefsMap)
      }
    }
    loadMealPreferences()
  }, [supabase])

  // Load ingredient preferences on mount
  useEffect(() => {
    const loadIngredientPreferences = async () => {
      try {
        const response = await fetch('/api/ingredient-preferences')
        if (response.ok) {
          const data: IngredientPreferenceWithDetails[] = await response.json()
          const prefsMap: IngredientPreferencesMap = {}
          data.forEach(pref => {
            prefsMap[pref.name_normalized] = {
              ingredientId: pref.ingredient_id,
              preference: pref.preference
            }
          })
          setIngredientPreferences(prefsMap)
        }
      } catch (error) {
        console.error('Error loading ingredient preferences:', error)
      }
    }
    loadIngredientPreferences()
  }, [])

  // Load cooking statuses on mount
  useEffect(() => {
    const loadCookingStatuses = async () => {
      try {
        // Fetch all cooking statuses for this meal plan
        const { data, error } = await supabase
          .from('meal_plan_meal_cooking_status')
          .select(`
            *,
            meal_plan_meals!inner(meal_plan_id)
          `)
          .eq('meal_plan_meals.meal_plan_id', mealPlan.id)

        if (error) {
          console.error('Error loading cooking statuses:', error)
          return
        }

        const statusMap = new Map<string, MealPlanMealCookingStatus>()
        data?.forEach((status) => {
          statusMap.set(status.meal_plan_meal_id, {
            id: status.id,
            meal_plan_meal_id: status.meal_plan_meal_id,
            cooking_status: status.cooking_status,
            cooked_at: status.cooked_at,
            modification_notes: status.modification_notes,
            created_at: status.created_at,
            updated_at: status.updated_at,
          })
        })
        setCookingStatuses(statusMap)
      } catch (error) {
        console.error('Error loading cooking statuses:', error)
      }
    }
    loadCookingStatuses()
  }, [supabase, mealPlan.id])

  const currentDayPlan = mealPlan.days.find(d => d.day === selectedDay) as DayPlanNormalized | undefined

  const sortedMeals = currentDayPlan?.meals.slice().sort((a, b) => {
    return MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type)
  }) || []

  // Handle opening the swap modal
  const handleOpenSwapModal = (mealSlot: MealSlot, day: DayOfWeek) => {
    setSwapTarget({ mealSlot, day })
    setSwapModalOpen(true)
  }

  // Handle swap completion
  const handleSwapComplete = (response: SwapResponse) => {
    if (!swapTarget) return

    // Get set of all swapped meal slot IDs (for consistent meals, multiple slots are updated)
    const swappedSlotIds = new Set(response.mealPlanMeals.map(m => m.id))

    // Update the meal plan state with new data
    const updatedDays = mealPlan.days.map(dayPlan => {
      // Update daily totals
      const updatedTotals = response.updatedDailyTotals[dayPlan.day] || dayPlan.daily_totals

      // Update all swapped meals in the meals array
      const updatedMeals = dayPlan.meals.map(mealSlot => {
        if (swappedSlotIds.has(mealSlot.id)) {
          return {
            ...mealSlot,
            meal: response.newMeal,
            is_original: false,
            swapped_from_meal_id: swapTarget.mealSlot.meal.id,
          }
        }
        return mealSlot
      })

      return {
        ...dayPlan,
        meals: updatedMeals,
        daily_totals: updatedTotals,
      }
    })

    setMealPlan({
      ...mealPlan,
      days: updatedDays,
      grocery_list: response.groceryList,
    })

    // Track first_meal_swapped milestone
    if (onboardingState && !onboardingState.first_meal_swapped) {
      markMilestone('first_meal_swapped')
    }

    setSwapModalOpen(false)
    setSwapTarget(null)
  }

  const toggleFavorite = async () => {
    setTogglingFavorite(true)
    const newValue = !isFavorite

    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newValue }),
      })

      if (response.ok) {
        setIsFavorite(newValue)
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
    setTogglingFavorite(false)
  }

  const saveTitle = async () => {
    setSavingTitle(true)
    const { error } = await supabase
      .from('meal_plans')
      .update({ title: titleValue || null })
      .eq('id', mealPlan.id)

    if (!error) {
      setMealPlan({ ...mealPlan, title: titleValue || undefined })
      setIsEditingTitle(false)
    }
    setSavingTitle(false)
  }

  const updateIngredientInMeal = async (
    mealSlot: MealSlot,
    ingredientIndex: number,
    newIngredient: IngredientWithNutrition
  ) => {
    const mealId = mealSlot.meal.id
    const updatedIngredients = [...mealSlot.meal.ingredients]
    updatedIngredients[ingredientIndex] = { ...newIngredient }

    // Recalculate meal macros from ingredient totals
    const newMealMacros = updatedIngredients.reduce(
      (totals, ing) => ({
        calories: totals.calories + (ing.calories || 0),
        protein: totals.protein + (ing.protein || 0),
        carbs: totals.carbs + (ing.carbs || 0),
        fat: totals.fat + (ing.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    // Round to reasonable precision
    const roundedMacros = {
      calories: Math.round(newMealMacros.calories),
      protein: Math.round(newMealMacros.protein * 10) / 10,
      carbs: Math.round(newMealMacros.carbs * 10) / 10,
      fat: Math.round(newMealMacros.fat * 10) / 10,
    }

    // Update the meal in the database
    const { error: mealError } = await supabase
      .from('meals')
      .update({
        ingredients: updatedIngredients,
        calories: roundedMacros.calories,
        protein: roundedMacros.protein,
        carbs: roundedMacros.carbs,
        fat: roundedMacros.fat,
        is_nutrition_edited_by_user: true,
      })
      .eq('id', mealId)

    if (mealError) {
      console.error('Error updating meal ingredients:', mealError)
      return false
    }

    // Update local state
    const updatedDays = mealPlan.days.map(day => {
      const updatedMeals = day.meals.map(slot => {
        if (slot.meal.id === mealId) {
          return {
            ...slot,
            meal: {
              ...slot.meal,
              ingredients: updatedIngredients,
              calories: roundedMacros.calories,
              protein: roundedMacros.protein,
              carbs: roundedMacros.carbs,
              fat: roundedMacros.fat,
              is_nutrition_edited_by_user: true,
            },
          }
        }
        return slot
      })

      // Recalculate daily totals
      const daily_totals = updatedMeals.reduce(
        (totals, slot) => ({
          calories: totals.calories + slot.meal.calories,
          protein: totals.protein + slot.meal.protein,
          carbs: totals.carbs + slot.meal.carbs,
          fat: totals.fat + slot.meal.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      )

      return {
        ...day,
        meals: updatedMeals,
        daily_totals,
      }
    })

    setMealPlan({ ...mealPlan, days: updatedDays })
    return true
  }

  const toggleMealPreference = async (meal: MealEntity, preference: MealPreferenceType) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const mealName = meal.name
    const currentPref = mealPreferences[mealName]

    if (currentPref === preference) {
      // Remove preference if clicking the same button
      const { error } = await supabase
        .from('meal_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('meal_name', mealName)

      if (!error) {
        const newPrefs = { ...mealPreferences }
        delete newPrefs[mealName]
        setMealPreferences(newPrefs)

        // If removing a 'liked' preference, also remove from community feed
        if (preference === 'liked') {
          await supabase
            .from('social_feed_posts')
            .delete()
            .eq('user_id', user.id)
            .eq('source_type', 'liked_meal')
            .eq('source_meals_table_id', meal.id)
        }
      }
    } else {
      // Upsert preference
      const { error } = await supabase
        .from('meal_preferences')
        .upsert({
          user_id: user.id,
          meal_name: mealName,
          preference: preference,
        }, {
          onConflict: 'user_id,meal_name',
        })

      if (!error) {
        setMealPreferences({ ...mealPreferences, [mealName]: preference })

        // If liking a meal and user has community enabled, share to feed
        if (preference === 'liked') {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('social_feed_enabled')
            .eq('id', user.id)
            .single()

          if (profile?.social_feed_enabled) {
            const { error: shareError } = await supabase.from('social_feed_posts').insert({
              user_id: user.id,
              source_type: 'liked_meal',
              source_meals_table_id: meal.id,
              meal_name: meal.name,
              calories: Math.round(meal.calories),
              protein: Math.round(meal.protein),
              carbs: Math.round(meal.carbs),
              fat: Math.round(meal.fat),
              prep_time: minutesToPrepTime(meal.prep_time_minutes),
              ingredients: meal.ingredients.map(ing => ({
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit,
                calories: Math.round(ing.calories),
                protein: Math.round(ing.protein),
                carbs: Math.round(ing.carbs),
                fat: Math.round(ing.fat),
              })),
              instructions: meal.instructions,
              meal_type: meal.meal_type,
            })
            // Ignore duplicate errors (23505) - meal already shared
            if (shareError && shareError.code !== '23505') {
              console.error('Error sharing liked meal to community feed:', shareError)
            }
          }
        }
      }
    }
  }

  const toggleIngredientPreference = async (ingredientName: string, preference: IngredientPreferenceType) => {
    const normalizedName = ingredientName.toLowerCase().trim()
    const currentPref = ingredientPreferences[normalizedName]

    try {
      if (currentPref?.preference === preference) {
        // Remove preference if clicking the same button
        const response = await fetch(`/api/ingredient-preferences?ingredient_id=${currentPref.ingredientId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          const newPrefs = { ...ingredientPreferences }
          delete newPrefs[normalizedName]
          setIngredientPreferences(newPrefs)
        }
      } else {
        // First, get or create the ingredient
        const ingredientResponse = await fetch('/api/ingredients/by-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ingredientName }),
        })

        if (!ingredientResponse.ok) {
          console.error('Failed to get/create ingredient')
          return
        }

        const ingredient = await ingredientResponse.json()

        // Then save the preference
        const prefResponse = await fetch('/api/ingredient-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredient_id: ingredient.id,
            preference: preference,
          }),
        })

        if (prefResponse.ok) {
          setIngredientPreferences({
            ...ingredientPreferences,
            [normalizedName]: {
              ingredientId: ingredient.id,
              preference: preference,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error toggling ingredient preference:', error)
    }
  }

  // Handle cooking status change
  const handleCookingStatusChange = async (
    mealSlotId: string,
    mealId: string,
    status: CookingStatus,
    notes?: string,
    updatedInstructions?: string[]
  ) => {
    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}/meals/${mealSlotId}/cooking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooking_status: status,
          modification_notes: notes,
          updated_instructions: updatedInstructions,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update cooking status')
      }

      const updatedStatus = await response.json()

      // Update local state
      if (status === 'not_cooked') {
        const newStatuses = new Map(cookingStatuses)
        newStatuses.delete(mealSlotId)
        setCookingStatuses(newStatuses)
      } else {
        setCookingStatuses(new Map(cookingStatuses).set(mealSlotId, updatedStatus))
      }

      // If instructions were updated, update the meal in local state
      if (updatedInstructions && updatedInstructions.length > 0) {
        const updatedDays = mealPlan.days.map(day => ({
          ...day,
          meals: day.meals.map(slot => {
            if (slot.meal.id === mealId) {
              return {
                ...slot,
                meal: {
                  ...slot.meal,
                  instructions: updatedInstructions,
                },
              }
            }
            return slot
          }),
        }))
        setMealPlan({ ...mealPlan, days: updatedDays })
      }
    } catch (error) {
      console.error('Error updating cooking status:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Plan header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  placeholder="Enter meal plan title..."
                  className="input-field text-xl font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle()
                    if (e.key === 'Escape') {
                      setTitleValue(mealPlan.title || '')
                      setIsEditingTitle(false)
                    }
                  }}
                />
                <button
                  onClick={saveTitle}
                  disabled={savingTitle}
                  className="px-3 py-1 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingTitle ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setTitleValue(mealPlan.title || '')
                    setIsEditingTitle(false)
                  }}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">
                  {mealPlan.title || (mealPlan.theme ? `${mealPlan.theme.emoji || ''} ${mealPlan.theme.display_name} Meal Plan` : 'Meal Plan')}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Edit title"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-gray-600">
              Week of {new Date(mealPlan.week_start_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleFavorite}
              disabled={togglingFavorite}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isFavorite
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg
                className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`}
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              {isFavorite ? 'Favorited' : 'Favorite'}
            </button>
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>
            <Link
              href={`/prep-view/${mealPlan.id}`}
              className="btn-outline"
              data-tour="prep-schedule-link"
            >
              Prep Schedule
            </Link>
            <Link
              href={`/grocery-list/${mealPlan.id}`}
              className="btn-primary"
              data-tour="grocery-list-link"
            >
              Grocery List
            </Link>
          </div>
        </div>

        {/* Theme Badge */}
        {mealPlan.theme && (
          <div className="mb-6">
            <ThemeBadge theme={mealPlan.theme} showDetails />
          </div>
        )}

        {/* Core Ingredients */}
        {mealPlan.core_ingredients && normalizeCoreIngredients(mealPlan.core_ingredients) && (
          <div className="mb-6">
            <CoreIngredientsCard coreIngredients={normalizeCoreIngredients(mealPlan.core_ingredients)!} />
          </div>
        )}

        {/* Day selector */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2" data-tour="day-selector">
          {mealPlan.days.map((day) => (
            <button
              key={day.day}
              onClick={() => setSelectedDay(day.day)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedDay === day.day
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {DAY_LABELS[day.day]}
            </button>
          ))}
        </div>

        {/* Daily totals */}
        {currentDayPlan && (
          <div className="card mb-6" data-tour="daily-totals">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {DAY_LABELS[selectedDay]} Daily Totals
            </h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary-600">
                  {Math.round(currentDayPlan.daily_totals.calories)}
                </p>
                <p className="text-sm text-gray-500">Calories</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(currentDayPlan.daily_totals.protein)}g
                </p>
                <p className="text-sm text-gray-500">Protein</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.round(currentDayPlan.daily_totals.carbs)}g
                </p>
                <p className="text-sm text-gray-500">Carbs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round(currentDayPlan.daily_totals.fat)}g
                </p>
                <p className="text-sm text-gray-500">Fat</p>
              </div>
            </div>
          </div>
        )}

        {/* Meals */}
        <div className="space-y-4">
          {sortedMeals.map((mealSlot, idx) => {
            return (
              <MealCard
                key={mealSlot.id}
                mealSlot={mealSlot}
                isExpanded={expandedMeal === mealSlot.id}
                onToggle={() =>
                  setExpandedMeal(
                    expandedMeal === mealSlot.id ? null : mealSlot.id
                  )
                }
                preference={mealPreferences[mealSlot.meal.name]}
                onLike={async () => {
                  await toggleMealPreference(mealSlot.meal, 'liked')
                  // Track first_meal_liked milestone
                  if (onboardingState && !onboardingState.first_meal_liked) {
                    markMilestone('first_meal_liked')
                  }
                }}
                onDislike={() => toggleMealPreference(mealSlot.meal, 'disliked')}
                onIngredientChange={(ingredientIndex, newIngredient) =>
                  updateIngredientInMeal(mealSlot, ingredientIndex, newIngredient)
                }
                mealPlanId={mealPlan.id}
                ingredientPreferences={ingredientPreferences}
                onIngredientLike={(name) => toggleIngredientPreference(name, 'liked')}
                onIngredientDislike={(name) => toggleIngredientPreference(name, 'disliked')}
                onSwap={() => handleOpenSwapModal(mealSlot, selectedDay)}
                isFirstMealCard={idx === 0}
                cookingStatus={cookingStatuses.get(mealSlot.id)?.cooking_status || 'not_cooked'}
                onCookingStatusChange={(status, notes, updatedInstructions) =>
                  handleCookingStatusChange(mealSlot.id, mealSlot.meal.id, status, notes, updatedInstructions)
                }
              />
            )
          })}
        </div>

        {/* Swap Modal */}
        {swapTarget && (
          <SwapModal
            isOpen={swapModalOpen}
            onClose={() => {
              setSwapModalOpen(false)
              setSwapTarget(null)
            }}
            currentMeal={swapTarget.mealSlot.meal}
            mealPlanMealId={swapTarget.mealSlot.id}
            mealPlanId={mealPlan.id}
            mealType={swapTarget.mealSlot.meal_type}
            onSwapComplete={handleSwapComplete}
          />
        )}

        {/* Share Modal */}
        <ShareMealPlanModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          mealPlanId={mealPlan.id}
          mealPlanTitle={mealPlan.title || (mealPlan.theme ? `${mealPlan.theme.emoji || ''} ${mealPlan.theme.display_name} Meal Plan` : 'Meal Plan')}
        />

        {/* First Plan Tour */}
        {shouldShowTour && currentTourStep < FIRST_PLAN_TOUR_STEPS.length && (
          <SpotlightTip
            step={FIRST_PLAN_TOUR_STEPS[currentTourStep]}
            currentStepIndex={currentTourStep}
            totalSteps={FIRST_PLAN_TOUR_STEPS.length}
            onNext={advanceTourStep}
            onSkip={skipTour}
            onComplete={completeTour}
          />
        )}
      </main>

      <MobileTabBar />
    </div>
  )
}

function MealCard({
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
  onCookingStatusChange,
}: {
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
  onCookingStatusChange: (status: CookingStatus, notes?: string, updatedInstructions?: string[]) => Promise<void>
}) {
  const meal = mealSlot.meal
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
  const [savingIngredient, setSavingIngredient] = useState(false)

  const mealTypeColors: Record<string, string> = {
    breakfast: 'bg-yellow-100 text-yellow-800',
    lunch: 'bg-teal-100 text-teal-800',
    dinner: 'bg-blue-100 text-blue-800',
    snack: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="card" {...(isFirstMealCard ? { 'data-tour': 'meal-card' } : {})}>
      <div className="flex items-start justify-between">
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${mealTypeColors[meal.meal_type]}`}>
              {meal.meal_type}
            </span>
            <span className="text-sm text-gray-500">
              {meal.prep_time_minutes} min prep
            </span>
            {!mealSlot.is_original && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                Swapped
              </span>
            )}
            <CookingStatusBadge status={cookingStatus} />
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

// Ingredient row component with inline editing
function IngredientRow({
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
}: {
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
}) {
  const [editValues, setEditValues] = useState({
    calories: ingredient.calories.toString(),
    protein: ingredient.protein.toString(),
    carbs: ingredient.carbs.toString(),
    fat: ingredient.fat.toString(),
  })

  // IngredientWithNutrition always has nutrition data
  const hasNutritionData = true

  const handleSave = async () => {
    const newCalories = parseFloat(editValues.calories) || 0
    const newProtein = parseFloat(editValues.protein) || 0
    const newCarbs = parseFloat(editValues.carbs) || 0
    const newFat = parseFloat(editValues.fat) || 0

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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Calories</label>
            <input
              type="number"
              value={editValues.calories}
              onChange={(e) => setEditValues({ ...editValues, calories: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Protein</label>
            <input
              type="number"
              value={editValues.protein}
              onChange={(e) => setEditValues({ ...editValues, protein: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Carbs</label>
            <input
              type="number"
              value={editValues.carbs}
              onChange={(e) => setEditValues({ ...editValues, carbs: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fat</label>
            <input
              type="number"
              value={editValues.fat}
              onChange={(e) => setEditValues({ ...editValues, fat: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              step="0.1"
            />
          </div>
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
              <span>{ingredient.calories} cal</span>
              <span className="text-blue-400">{ingredient.protein}g P</span>
              <span className="text-orange-400">{ingredient.carbs}g C</span>
              <span className="text-purple-400">{ingredient.fat}g F</span>
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
