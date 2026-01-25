'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingData } from '@/lib/types'
import { useKeyboard } from '@/hooks/useKeyboard'
import { usePlatform } from '@/hooks/usePlatform'
import { DEFAULT_MEAL_CONSISTENCY_PREFS, DEFAULT_INGREDIENT_VARIETY_PREFS, DEFAULT_PREP_STYLE, DEFAULT_MEAL_COMPLEXITY_PREFS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS, DEFAULT_SELECTED_MEAL_TYPES } from '@/lib/types'
import MacrosEditor from '@/components/MacrosEditor'
import DietaryPrefsEditor from '@/components/DietaryPrefsEditor'
import MealTypesSelector from '@/components/MealTypesSelector'
import PrepTimeSelector from '@/components/PrepTimeSelector'
import MealConsistencyEditor from '@/components/MealConsistencyEditor'
import PrepStyleSelector from '@/components/PrepStyleSelector'
import MealComplexityEditor from '@/components/MealComplexityEditor'
import IngredientVarietyEditor from '@/components/IngredientVarietyEditor'
import BasicInfoEditor from '@/components/BasicInfoEditor'
import ThemeSelector, { type ThemeSelection } from '@/components/ThemeSelector'
import Logo from '@/components/Logo'

const STEPS = ['basics', 'macros', 'meal_types', 'consistency', 'prep_style', 'meal_complexity', 'ingredients', 'theme'] as const
type Step = typeof STEPS[number]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState<Step>('basics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isKeyboardVisible, keyboardHeight } = useKeyboard()
  const { isNative } = usePlatform()
  const contentRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only applying client-specific styles after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const [formData, setFormData] = useState<OnboardingData>({
    name: '',
    weight: null,
    target_protein: 150,
    target_carbs: 200,
    target_fat: 70,
    target_calories: 2000,
    dietary_prefs: ['no_restrictions'],
    selected_meal_types: [...DEFAULT_SELECTED_MEAL_TYPES],
    snack_count: 1,
    prep_time: 30,
    meal_consistency_prefs: { ...DEFAULT_MEAL_CONSISTENCY_PREFS },
    ingredient_variety_prefs: { ...DEFAULT_INGREDIENT_VARIETY_PREFS },
    prep_style: DEFAULT_PREP_STYLE,
    breakfast_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.breakfast,
    lunch_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.lunch,
    dinner_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.dinner,
    household_servings: { ...DEFAULT_HOUSEHOLD_SERVINGS_PREFS },
    profile_photo_url: null,
  })
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>({ type: 'surprise' })
  const [showSkipModal, setShowSkipModal] = useState(false)

  // Auto-calculate calories when macros change
  useEffect(() => {
    const calories = (formData.target_protein * 4) + (formData.target_carbs * 4) + (formData.target_fat * 9)
    setFormData(prev => ({ ...prev, target_calories: calories }))
  }, [formData.target_protein, formData.target_carbs, formData.target_fat])

  // Scroll focused input into view when keyboard opens on native
  useEffect(() => {
    if (isKeyboardVisible && isNative) {
      const activeElement = document.activeElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }, [isKeyboardVisible, isNative])

  const handleNext = () => {
    const stepIndex = STEPS.indexOf(currentStep)
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1])
    }
  }

  const handleBack = () => {
    const stepIndex = STEPS.indexOf(currentStep)
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1])
    }
  }

  // Track if user skipped to theme step (used to save defaults on submit)
  const [skippedToTheme, setSkippedToTheme] = useState(false)

  const handleSkip = () => {
    // Close modal and jump directly to theme selection step
    // Defaults will be saved when user clicks "Generate My First Plan"
    setShowSkipModal(false)
    setSkippedToTheme(true)
    setCurrentStep('theme')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // If user skipped to theme, save defaults; otherwise save their customized preferences
    const dataToSave = skippedToTheme ? {
      target_protein: 150,
      target_carbs: 200,
      target_fat: 70,
      target_calories: 2000,
      dietary_prefs: ['no_restrictions'],
      selected_meal_types: DEFAULT_SELECTED_MEAL_TYPES,
      snack_count: 1,
      meals_per_day: Math.min(6, Math.max(3, DEFAULT_SELECTED_MEAL_TYPES.length + 1)) as 3 | 4 | 5 | 6,
      include_workout_meals: DEFAULT_SELECTED_MEAL_TYPES.includes('pre_workout') || DEFAULT_SELECTED_MEAL_TYPES.includes('post_workout'),
      prep_time: 30,
      meal_consistency_prefs: DEFAULT_MEAL_CONSISTENCY_PREFS,
      ingredient_variety_prefs: DEFAULT_INGREDIENT_VARIETY_PREFS,
      prep_style: DEFAULT_PREP_STYLE,
      breakfast_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.breakfast,
      lunch_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.lunch,
      dinner_complexity: DEFAULT_MEAL_COMPLEXITY_PREFS.dinner,
      household_servings: DEFAULT_HOUSEHOLD_SERVINGS_PREFS,
    } : {
      name: formData.name || null,
      weight: formData.weight,
      target_protein: formData.target_protein,
      target_carbs: formData.target_carbs,
      target_fat: formData.target_fat,
      target_calories: formData.target_calories,
      dietary_prefs: formData.dietary_prefs,
      selected_meal_types: formData.selected_meal_types,
      snack_count: formData.snack_count,
      meals_per_day: Math.min(6, Math.max(3, formData.selected_meal_types.length + formData.snack_count)) as 3 | 4 | 5 | 6,
      include_workout_meals: formData.selected_meal_types.includes('pre_workout') || formData.selected_meal_types.includes('post_workout'),
      prep_time: formData.prep_time,
      meal_consistency_prefs: formData.meal_consistency_prefs,
      ingredient_variety_prefs: formData.ingredient_variety_prefs,
      prep_style: formData.prep_style,
      breakfast_complexity: formData.breakfast_complexity,
      lunch_complexity: formData.lunch_complexity,
      dinner_complexity: formData.dinner_complexity,
      household_servings: formData.household_servings,
      profile_photo_url: formData.profile_photo_url,
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(dataToSave)
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Mark profile_completed milestone - must complete before navigating
    const stateResponse = await fetch('/api/onboarding/state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_completed: true }),
    })

    if (!stateResponse.ok) {
      setError('Failed to save onboarding state. Please try again.')
      setLoading(false)
      return
    }

    // Convert ThemeSelection to API format
    const themeForApi = themeSelection.type === 'specific'
      ? themeSelection.themeId
      : themeSelection.type

    // Start first meal plan generation with user's selected theme
    const generateResponse = await fetch('/api/generate-meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeSelection: themeForApi }),
    })

    if (generateResponse.ok) {
      // Mark first_plan_started milestone
      await fetch('/api/onboarding/state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_plan_started: true }),
      })
    }

    // Use window.location for native apps to ensure a full page reload
    // This prevents race conditions with the dashboard's onboarding check
    if (isNative) {
      window.location.href = '/welcome-celebration'
    } else {
      router.push('/welcome-celebration')
    }
  }

  return (
    <div
      className="min-h-screen bg-gray-50 py-12 px-4 safe-area-top safe-area-bottom"
      style={mounted && isNative && isKeyboardVisible ? { paddingBottom: keyboardHeight } : undefined}
    >
      <div className="max-w-2xl mx-auto" ref={contentRef}>
        <div className="text-center mb-8">
          <Logo size="xl" className="justify-center" />
          <h2 className="mt-4 text-xl text-gray-700">Let&apos;s set up your profile</h2>
        </div>

        {/* Progress indicator - compact on mobile, scrollable if needed */}
        <div className="mb-8 overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex justify-center min-w-fit">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm sm:text-base flex-shrink-0 ${
                    STEPS.indexOf(currentStep) >= index
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-6 sm:w-12 h-1 flex-shrink-0 ${
                      STEPS.indexOf(currentStep) > index ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          {/* Step 1: Basics */}
          {currentStep === 'basics' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>

              <BasicInfoEditor
                values={{
                  name: formData.name,
                  weight: formData.weight,
                  profile_photo_url: formData.profile_photo_url,
                }}
                onChange={(values) => setFormData(prev => ({
                  ...prev,
                  name: values.name,
                  weight: values.weight,
                  profile_photo_url: values.profile_photo_url,
                }))}
              />
            </div>
          )}

          {/* Step 2: Macros */}
          {currentStep === 'macros' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Daily Macro Targets</h3>
              <p className="text-gray-600">
                Enter your daily macro goals. Calories will be calculated automatically.
              </p>

              <MacrosEditor
                values={{
                  target_protein: formData.target_protein,
                  target_carbs: formData.target_carbs,
                  target_fat: formData.target_fat,
                  target_calories: formData.target_calories,
                }}
                onChange={(values) => setFormData(prev => ({ ...prev, ...values }))}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> Most CrossFit athletes need 0.7%-1.2% of their body weight in grams of protein.
                  Carbs fuel your WODs, and healthy fats support brain + hormone function.
                  Don't forget your veggies and fruits - you should try for 800g per day!
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Meal Types (replaces old Preferences step) */}
          {currentStep === 'meal_types' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Your Daily Meals</h3>
              <p className="text-gray-600">
                Select the meals you want in your plan. Pre/post-workout meals help fuel training and recovery.
              </p>

              <MealTypesSelector
                selectedTypes={formData.selected_meal_types}
                snackCount={formData.snack_count}
                onTypesChange={(types) => setFormData(prev => ({ ...prev, selected_meal_types: types }))}
                onSnackCountChange={(count) => setFormData(prev => ({ ...prev, snack_count: count }))}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Dietary Preferences
                </label>
                <DietaryPrefsEditor
                  selectedPrefs={formData.dietary_prefs}
                  onChange={(prefs) => setFormData(prev => ({ ...prev, dietary_prefs: prefs }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Max Prep Time Per Meal
                </label>
                <PrepTimeSelector
                  value={formData.prep_time}
                  onChange={(value) => setFormData(prev => ({ ...prev, prep_time: value }))}
                />
              </div>
            </div>
          )}

          {/* Step 4: Meal Consistency */}
          {currentStep === 'consistency' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Meal Variety Preferences</h3>
              <p className="text-gray-600">
                Choose which meals you want to keep the same each day vs. vary throughout the week.
                Consistent meals simplify meal prep and grocery shopping.
              </p>

              <MealConsistencyEditor
                prefs={formData.meal_consistency_prefs}
                onChange={(prefs) => setFormData(prev => ({ ...prev, meal_consistency_prefs: prefs }))}
                selectedTypes={formData.selected_meal_types}
                snackCount={formData.snack_count}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> Keeping breakfast, lunch and snacks consistent is a popular choice
                  for athletes who want variety at dinner but easy meal prep for busy days.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Prep Style */}
          {currentStep === 'prep_style' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">How do you prefer to meal prep?</h3>
              <p className="text-gray-600">
                We&apos;ll organize your weekly prep schedule to match your style.
              </p>

              <PrepStyleSelector
                value={formData.prep_style}
                onChange={(value) => setFormData(prev => ({ ...prev, prep_style: value }))}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> Day-of cooking keeps meals fresh and flexible. If you prefer batch prep,
                  Traditional Batch Prep lets you spend 2 hours on Sunday and enjoy quick meals all week.
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Meal Complexity */}
          {currentStep === 'meal_complexity' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">What level of cooking effort do you prefer?</h3>
              <p className="text-gray-600">
                We&apos;ll match meal complexity to your preferences for each meal type.
              </p>

              <MealComplexityEditor
                values={{
                  breakfast: formData.breakfast_complexity,
                  lunch: formData.lunch_complexity,
                  dinner: formData.dinner_complexity,
                }}
                onChange={(values) => setFormData(prev => ({
                  ...prev,
                  breakfast_complexity: values.breakfast,
                  lunch_complexity: values.lunch,
                  dinner_complexity: values.dinner,
                }))}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> Quick assembly breakfasts and lunches with full-recipe dinners is a popular
                  choice for busy athletes who want to save time during the day but enjoy cooking in the evening.
                </p>
              </div>
            </div>
          )}

          {/* Step 7: Ingredient Variety */}
          {currentStep === 'ingredients' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Grocery Shopping Preferences</h3>
              <p className="text-gray-600">
                How many different items do you want to buy in each category? Fewer items means a simpler shopping list
                and easier meal prep. More items means more variety in your meals.
              </p>

              <IngredientVarietyEditor
                prefs={formData.ingredient_variety_prefs}
                onChange={(prefs) => setFormData(prev => ({ ...prev, ingredient_variety_prefs: prefs }))}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> A typical efficient grocery list has 3 proteins, 5 vegetables, 2 fruits, 2 grains, 3 fats,
                  and 2 dairy items. This creates variety while keeping shopping simple.
                </p>
              </div>
            </div>
          )}

          {/* Step 8: Theme Selection */}
          {currentStep === 'theme' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Choose Your First Meal Plan Theme</h3>
              <p className="text-gray-600">
                Pick a cuisine theme for your first meal plan. We&apos;ll automatically generate it for you
                once you complete setup!
              </p>

              <ThemeSelector
                value={themeSelection}
                onChange={setThemeSelection}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>What happens next:</strong> After you click &quot;Generate My First Plan&quot;, we&apos;ll create
                  a personalized 7-day meal plan based on your preferences. This takes about 5 minutes &mdash;
                  you can navigate away and we&apos;ll let you know when it&apos;s ready!
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between">
            {currentStep !== 'basics' ? (
              <button
                type="button"
                onClick={handleBack}
                className="btn-secondary"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep !== 'theme' ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Generating...' : 'Generate My First Plan'}
              </button>
            )}
          </div>

          {/* Skip onboarding link - only show on first step */}
          {currentStep === 'basics' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowSkipModal(true)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Skip for now and use defaults
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skip Confirmation Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Skip to Theme Selection?</h3>
            <p className="text-gray-600 mb-4">
              No problem! We&apos;ll use our recommended defaults for your profile, and you can choose a theme for your first meal plan.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-3">Default Settings</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>Macros:</strong> 150g protein, 200g carbs, 70g fat (2,000 cal)</li>
                <li><strong>Meals:</strong> Breakfast, lunch, dinner + pre/post-workout + 1 snack</li>
                <li><strong>Prep Style:</strong> Day-of cooking (fresh meals daily)</li>
                <li><strong>Complexity:</strong> Minimal prep breakfast, quick assembly lunch, full recipe dinner</li>
                <li><strong>Variety:</strong> Consistent meals during the day, varied dinners</li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-primary-900 mb-2">Customize anytime in your Profile</h4>
              <ul className="text-sm text-primary-800 space-y-1">
                <li>• Daily macro targets</li>
                <li>• Meal types and snack count</li>
                <li>• Dietary preferences</li>
                <li>• Prep style and complexity</li>
                <li>• Ingredient variety</li>
                <li>• Household servings</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="flex-1 btn-secondary"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 btn-primary"
              >
                Choose Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
