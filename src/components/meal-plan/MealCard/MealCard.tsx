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
  HouseholdServingsPrefs,
  DailyAssembly,
  MealType,
} from '@/lib/types'
import { getMealTypeColorClasses, MEAL_TYPE_CONFIG, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import { SwapButton } from '@/components/meal'
import CookingStatusButton from '@/components/meal/CookingStatusButton'
import CookingStatusBadge from '@/components/meal/CookingStatusBadge'
import { IngredientRow } from './IngredientRow'
import { MealModificationsSection } from './MealModificationsSection'
import { DayBadge } from '../DayBadge'
import { InlineLogButton } from './InlineLogButton'
import { CookingAssistantButton } from '@/components/CookingAssistant'
import {
  formatCookingTemps,
  formatCookingTimes,
  hasHouseholdForMeal,
  getServingMultiplier,
  formatHouseholdContext,
  type PrepTaskWithSession,
} from '@/components/prep/prepUtils'

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
  // Cook Now mode
  onCookNow?: () => void
  // Prep detail props (for enhanced cooking info)
  prepTask?: PrepTaskWithSession
  householdServings?: HouseholdServingsPrefs
  currentDay?: DayOfWeek
  dailyAssembly?: DailyAssembly
  prepStyle?: string
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
  onCookNow,
  prepTask,
  householdServings = DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
  currentDay,
  dailyAssembly,
  prepStyle = 'day_of',
}: MealCardProps) {
  const meal = mealSlot.meal
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
  const [savingIngredient, setSavingIngredient] = useState(false)

  const mealTypeConfig = MEAL_TYPE_CONFIG[meal.meal_type]

  // Get cooking temps and times from prep task
  const cookingTemps = prepTask ? formatCookingTemps(prepTask.cooking_temps) : []
  const cookingTimes = prepTask ? formatCookingTimes(prepTask.cooking_times) : []

  // Get household context for scaling
  const effectiveDay = currentDay || day || 'monday'
  const hasHousehold = hasHouseholdForMeal(householdServings, effectiveDay, mealSlot.meal_type)
  const multiplier = getServingMultiplier(householdServings, effectiveDay, mealSlot.meal_type)
  const householdContextText = formatHouseholdContext(householdServings, effectiveDay, mealSlot.meal_type)

  // Check if this is a batch prep meal with assembly instructions
  const isBatchPrepStyle = prepStyle === 'traditional_batch'
  const assemblyMealType = mealSlot.meal_type === 'snack' ? 'snack' : mealSlot.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'pre_workout' | 'post_workout' | 'snack'
  const assemblyInfo = dailyAssembly?.[effectiveDay]?.[assemblyMealType]

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

        {/* Action buttons: Cooking Assistant, Status, Log, Swap, Like/Dislike, Expand */}
        <div
          className="flex items-center gap-2 ml-4"
          {...(isFirstMealCard ? { 'data-tour': 'like-dislike' } : {})}
        >
          <CookingAssistantButton
            mealId={meal.id}
            mealName={meal.name}
          />
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

          {/* Quick Info Badges - Temps & Times */}
          {(cookingTemps.length > 0 || cookingTimes.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {cookingTemps.map((temp, i) => (
                <span key={`temp-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  {temp}
                </span>
              ))}
              {cookingTimes.map((time, i) => (
                <span key={`time-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {time}
                </span>
              ))}
            </div>
          )}

          {/* Batch Prep Assembly Instructions (for traditional_batch users) */}
          {isBatchPrepStyle && assemblyInfo && (
            <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <h5 className="text-xs font-semibold text-teal-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Assembly
                <span className="text-teal-600 font-normal ml-1">({assemblyInfo.time})</span>
              </h5>
              <p className="text-sm text-teal-800">
                {assemblyInfo.instructions}
              </p>
              <p className="text-xs text-teal-600 mt-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Components already batch-prepped on Sunday
              </p>
            </div>
          )}

          {/* Equipment Needed */}
          {prepTask?.equipment_needed && prepTask.equipment_needed.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Equipment Needed
              </h5>
              <div className="flex flex-wrap gap-2">
                {prepTask.equipment_needed.map((item, i) => (
                  <span key={i} className="text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Household Scaling Guide */}
          {hasHousehold && multiplier > 1 && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-purple-800">
                  Multiply ingredient quantities by {multiplier.toFixed(1)}x
                </p>
                <p className="text-xs text-purple-600 mt-0.5">
                  For {householdContextText}
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-[2fr_3fr] gap-6">
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
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-gray-900">Instructions</h5>
                {onCookNow && (
                  <button
                    onClick={onCookNow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cook Now
                  </button>
                )}
              </div>
              <ol className="space-y-2">
                {meal.instructions.map((step, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{idx + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Pro Tips */}
          {prepTask?.tips && prepTask.tips.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Pro Tips
              </h5>
              <ul className="space-y-1">
                {prepTask.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-amber-800">{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
