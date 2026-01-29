'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
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
  GroceryItemWithContext,
  MealType,
  PrepSession,
  HouseholdServingsPrefs,
  DailyAssembly,
} from '@/lib/types'
import { normalizeCoreIngredients, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import { buildPrepTaskMap, type PrepTaskWithSession } from '@/components/prep/prepUtils'
import CoreIngredientsCard from '@/components/CoreIngredientsCard'
import ThemeBadge from '@/components/ThemeBadge'
import { SwapModal } from '@/components/meal'
import { MealCard, ViewToggle, MealTypeView } from '@/components/meal-plan'
import { useViewPreference } from '@/hooks/useViewPreference'
import { ShareMealPlanModal } from '@/components/ShareMealPlanModal'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import SpotlightTip from '@/components/onboarding/SpotlightTip'
import { FIRST_PLAN_TOUR_STEPS } from '@/lib/types'
import Logo from '@/components/Logo'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'
import NutritionDisclaimer from '@/components/NutritionDisclaimer'

interface Props {
  mealPlan: MealPlanNormalized & {
    grocery_list: Ingredient[]
    contextual_grocery_list?: GroceryItemWithContext[]
  }
  prepSessions?: PrepSession[]
  householdServings?: HouseholdServingsPrefs
  prepStyle?: string
  dailyAssembly?: DailyAssembly
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

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']

// Convert prep_time_minutes to CustomMealPrepTime format for social feed
function minutesToPrepTime(minutes: number): CustomMealPrepTime {
  if (minutes <= 5) return '5_or_less'
  if (minutes <= 15) return '15'
  if (minutes <= 30) return '30'
  return 'more_than_30'
}

export default function MealPlanClient({
  mealPlan: initialMealPlan,
  prepSessions = [],
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  prepStyle = 'day_of',
  dailyAssembly,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [mealPlan, setMealPlan] = useState(initialMealPlan)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(mealPlan.days[0]?.day || 'monday')
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(mealPlan.is_favorite)
  const [togglingFavorite, setTogglingFavorite] = useState(false)

  // URL query params for deep linking
  const viewFromUrl = searchParams.get('view') as 'daily' | 'meal-type' | null
  const mealTypeFromUrl = searchParams.get('type') as MealType | null

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

  // Like meal confirmation modal state
  const [likeMealModalOpen, setLikeMealModalOpen] = useState(false)
  const [likeMealShareWithCommunity, setLikeMealShareWithCommunity] = useState(true)
  const [pendingLikeMeal, setPendingLikeMeal] = useState<MealEntity | null>(null)

  // Cooking status state
  const [cookingStatuses, setCookingStatuses] = useState<Map<string, MealPlanMealCookingStatus>>(new Map())

  // Social feed enabled state
  const [socialFeedEnabled, setSocialFeedEnabled] = useState(false)

  // Cook Now handler - navigates to prep-view focused on the specific meal
  const handleCookNow = (mealSlot: MealSlot) => {
    // Navigate to prep-view with the meal name as a focus parameter
    const mealName = encodeURIComponent(mealSlot.meal.name)
    router.push(`/prep-view/${mealPlan.id}?focusMeal=${mealName}`)
  }

  // Build prep task map for efficient meal-to-prep-task lookups
  const prepTaskMap = useMemo(() => buildPrepTaskMap(prepSessions), [prepSessions])

  // View toggle state (daily vs meal-type view)
  const [activeView, setActiveView] = useViewPreference({ urlOverride: viewFromUrl })

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

        // Process each status and generate signed URLs for photos
        for (const status of data || []) {
          let photoUrl = status.cooked_photo_url

          // If photo URL is a storage path (not a full URL), generate signed URL
          if (photoUrl && !photoUrl.startsWith('http')) {
            const { data: signedUrlData } = await supabase.storage
              .from('meal-photos')
              .createSignedUrl(photoUrl, 60 * 60 * 24 * 7) // 7 days

            photoUrl = signedUrlData?.signedUrl || null
          }

          statusMap.set(status.meal_plan_meal_id, {
            id: status.id,
            meal_plan_meal_id: status.meal_plan_meal_id,
            cooking_status: status.cooking_status,
            cooked_at: status.cooked_at,
            modification_notes: status.modification_notes,
            cooked_photo_url: photoUrl,
            share_with_community: status.share_with_community ?? true,
            created_at: status.created_at,
            updated_at: status.updated_at,
          })
        }
        setCookingStatuses(statusMap)
      } catch (error) {
        console.error('Error loading cooking statuses:', error)
      }
    }
    loadCookingStatuses()
  }, [supabase, mealPlan.id])

  // Load social feed enabled setting on mount
  useEffect(() => {
    const loadSocialFeedEnabled = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('social_feed_enabled')
        .eq('id', user.id)
        .single()

      if (profile) {
        setSocialFeedEnabled(profile.social_feed_enabled || false)
      }
    }
    loadSocialFeedEnabled()
  }, [supabase])

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
      contextual_grocery_list: response.contextualGroceryList,
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
    } else if (preference === 'liked' && socialFeedEnabled) {
      // If liking and user has community enabled, show confirmation modal
      setPendingLikeMeal(meal)
      setLikeMealShareWithCommunity(true) // Default to checked
      setLikeMealModalOpen(true)
    } else {
      // For dislike or like without community, proceed directly
      await executeLikeMeal(meal, preference, false)
    }
  }

  const executeLikeMeal = async (meal: MealEntity, preference: MealPreferenceType, shareWithCommunity: boolean) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('meal_preferences')
      .upsert({
        user_id: user.id,
        meal_name: meal.name,
        preference: preference,
      }, {
        onConflict: 'user_id,meal_name',
      })

    if (!error) {
      setMealPreferences({ ...mealPreferences, [meal.name]: preference })

      // If liking a meal and user chose to share, share to feed
      if (preference === 'liked' && shareWithCommunity) {
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

  const handleLikeMealConfirm = async () => {
    if (pendingLikeMeal) {
      await executeLikeMeal(pendingLikeMeal, 'liked', likeMealShareWithCommunity)
    }
    setLikeMealModalOpen(false)
    setPendingLikeMeal(null)
  }

  const handleLikeMealCancel = () => {
    setLikeMealModalOpen(false)
    setPendingLikeMeal(null)
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
    updatedInstructions?: string[],
    photoUrl?: string,
    shareWithCommunity?: boolean
  ) => {
    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}/meals/${mealSlotId}/cooking-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooking_status: status,
          modification_notes: notes,
          updated_instructions: updatedInstructions,
          cooked_photo_url: photoUrl,
          share_with_community: shareWithCommunity,
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
        // Generate signed URL if photo is a storage path
        let cookedPhotoUrl = updatedStatus.cooked_photo_url
        if (cookedPhotoUrl && !cookedPhotoUrl.startsWith('http')) {
          const { data: signedUrlData } = await supabase.storage
            .from('meal-photos')
            .createSignedUrl(cookedPhotoUrl, 60 * 60 * 24 * 7) // 7 days
          cookedPhotoUrl = signedUrlData?.signedUrl || null
        }

        setCookingStatuses(new Map(cookingStatuses).set(mealSlotId, {
          ...updatedStatus,
          cooked_photo_url: cookedPhotoUrl,
        }))
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
    <div className="min-h-screen bg-gray-50 pb-36 md:pb-0">
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
          {/* Mobile: compact action row with favorite and share only */}
          <div className="flex gap-2 md:hidden">
            <button
              onClick={toggleFavorite}
              disabled={togglingFavorite}
              className={`p-2 rounded-lg transition-colors ${
                isFavorite
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-200 text-gray-700'
              }`}
              title={isFavorite ? 'Favorited' : 'Favorite'}
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
            </button>
            <button
              onClick={() => setShareModalOpen(true)}
              className="p-2 rounded-lg transition-colors bg-gray-200 text-gray-700"
              title="Share"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
          </div>
          {/* Desktop: full action row */}
          <div className="hidden md:flex gap-3">
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
              className="btn-primary bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600"
              data-tour="prep-schedule-link"
            >
              Start Cooking
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

        {/* Nutrition Disclaimer - Required by Apple App Store Guideline 1.4.1 */}
        <NutritionDisclaimer className="mb-6" />

        {/* Batch Prep Mode CTA Banner */}
        <Link
          href={`/prep-view/${mealPlan.id}`}
          className="block mb-6 p-4 bg-gradient-to-r from-primary-50 to-green-50 border border-primary-200 rounded-xl hover:from-primary-100 hover:to-green-100 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center group-hover:bg-primary-200 transition-colors">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">Ready to batch prep?</span>
                <span className="text-primary-600 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Start Cooking
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Get step-by-step cooking instructions with an AI assistant that knows your meals and can help with substitutions, timing, and technique. You can use the fresh day-of cooking instructions or batch prep instructions if you like to prepare eligible ingredients beforehand.
              </p>
            </div>
          </div>
        </Link>

        {/* Mobile sticky action bar - key actions always visible */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40 flex gap-3 shadow-lg">
          <Link
            href={`/prep-view/${mealPlan.id}`}
            className="btn-primary bg-gradient-to-r from-primary-600 to-primary-500 flex-1 text-center text-sm py-2"
          >
            Start Cooking
          </Link>
          <Link
            href={`/grocery-list/${mealPlan.id}`}
            className="btn-primary flex-1 text-center text-sm py-2"
            data-tour="grocery-list-link-mobile"
          >
            Grocery List
          </Link>
        </div>

        {/* View Toggle */}
        <ViewToggle view={activeView} onChange={setActiveView} data-tour="view-toggle" />

        {/* Daily View */}
        {activeView === 'daily' && (
          <>
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
                // Look up prep task by meal name (normalized)
                const prepTask = prepTaskMap.get(mealSlot.meal.name.toLowerCase().trim())
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
                    cookingStatusData={cookingStatuses.get(mealSlot.id)}
                    onCookingStatusChange={(status, notes, updatedInstructions, photoUrl, shareWithCommunity) =>
                      handleCookingStatusChange(mealSlot.id, mealSlot.meal.id, status, notes, updatedInstructions, photoUrl, shareWithCommunity)
                    }
                    socialFeedEnabled={socialFeedEnabled}
                    onCookNow={() => handleCookNow(mealSlot)}
                    prepTask={prepTask}
                    householdServings={householdServings}
                    currentDay={selectedDay}
                    dailyAssembly={dailyAssembly}
                    prepStyle={prepStyle}
                  />
                )
              })}
            </div>
          </>
        )}

        {/* Meal Type View */}
        {activeView === 'meal-type' && (
          <MealTypeView
            mealPlan={mealPlan}
            expandedMeal={expandedMeal}
            onToggleExpand={(mealSlotId) =>
              setExpandedMeal(expandedMeal === mealSlotId ? null : mealSlotId)
            }
            mealPreferences={mealPreferences}
            ingredientPreferences={ingredientPreferences}
            cookingStatuses={cookingStatuses}
            onLike={async (mealSlot) => {
              await toggleMealPreference(mealSlot.meal, 'liked')
              if (onboardingState && !onboardingState.first_meal_liked) {
                markMilestone('first_meal_liked')
              }
            }}
            onDislike={(mealSlot) => toggleMealPreference(mealSlot.meal, 'disliked')}
            onIngredientChange={(mealSlot, ingredientIndex, newIngredient) =>
              updateIngredientInMeal(mealSlot, ingredientIndex, newIngredient)
            }
            onIngredientLike={(name) => toggleIngredientPreference(name, 'liked')}
            onIngredientDislike={(name) => toggleIngredientPreference(name, 'disliked')}
            onSwap={handleOpenSwapModal}
            onCookingStatusChange={handleCookingStatusChange}
            socialFeedEnabled={socialFeedEnabled}
            onCookNow={handleCookNow}
            initialMealType={mealTypeFromUrl}
            prepTaskMap={prepTaskMap}
            householdServings={householdServings}
            dailyAssembly={dailyAssembly}
            prepStyle={prepStyle}
          />
        )}

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

        {/* Like Meal Confirmation Modal */}
        {likeMealModalOpen && pendingLikeMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Like this meal?</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will save &quot;{pendingLikeMeal.name}&quot; to your liked meals.
              </p>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-6">
                <input
                  type="checkbox"
                  id="like-share-with-community"
                  checked={likeMealShareWithCommunity}
                  onChange={(e) => setLikeMealShareWithCommunity(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="like-share-with-community" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">Share with community</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    This meal will be visible to other FuelRx users
                  </p>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleLikeMealCancel}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLikeMealConfirm}
                  className="btn-primary flex-1"
                >
                  Like
                </button>
              </div>
            </div>
          </div>
        )}

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
