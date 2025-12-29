'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingData } from '@/lib/types'
import { DEFAULT_MEAL_CONSISTENCY_PREFS, DEFAULT_INGREDIENT_VARIETY_PREFS, DEFAULT_PREP_STYLE, DEFAULT_MEAL_COMPLEXITY_PREFS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'
import HouseholdServingsEditor from '@/components/HouseholdServingsEditor'
import MacrosEditor from '@/components/MacrosEditor'
import DietaryPrefsEditor from '@/components/DietaryPrefsEditor'
import MealsPerDaySelector from '@/components/MealsPerDaySelector'
import PrepTimeSelector from '@/components/PrepTimeSelector'
import MealConsistencyEditor from '@/components/MealConsistencyEditor'
import PrepStyleSelector from '@/components/PrepStyleSelector'
import MealComplexityEditor from '@/components/MealComplexityEditor'
import IngredientVarietyEditor from '@/components/IngredientVarietyEditor'
import BasicInfoEditor from '@/components/BasicInfoEditor'

const STEPS = ['basics', 'macros', 'preferences', 'consistency', 'prep_style', 'meal_complexity', 'ingredients', 'household'] as const
type Step = typeof STEPS[number]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState<Step>('basics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<OnboardingData>({
    name: '',
    weight: null,
    target_protein: 150,
    target_carbs: 200,
    target_fat: 70,
    target_calories: 2000,
    dietary_prefs: ['no_restrictions'],
    meals_per_day: 3,
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

  // Auto-calculate calories when macros change
  useEffect(() => {
    const calories = (formData.target_protein * 4) + (formData.target_carbs * 4) + (formData.target_fat * 9)
    setFormData(prev => ({ ...prev, target_calories: calories }))
  }, [formData.target_protein, formData.target_carbs, formData.target_fat])

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

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        name: formData.name || null,
        weight: formData.weight,
        target_protein: formData.target_protein,
        target_carbs: formData.target_carbs,
        target_fat: formData.target_fat,
        target_calories: formData.target_calories,
        dietary_prefs: formData.dietary_prefs,
        meals_per_day: formData.meals_per_day,
        prep_time: formData.prep_time,
        meal_consistency_prefs: formData.meal_consistency_prefs,
        ingredient_variety_prefs: formData.ingredient_variety_prefs,
        prep_style: formData.prep_style,
        breakfast_complexity: formData.breakfast_complexity,
        lunch_complexity: formData.lunch_complexity,
        dinner_complexity: formData.dinner_complexity,
        household_servings: formData.household_servings,
        profile_photo_url: formData.profile_photo_url,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">Coach Hill&apos;s FuelRx</h1>
          <h2 className="mt-4 text-xl text-gray-700">Let&apos;s set up your profile</h2>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  STEPS.indexOf(currentStep) >= index
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-16 h-1 ${
                    STEPS.indexOf(currentStep) > index ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
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
                  <strong>Tip:</strong> Most CrossFit athletes need 1.6-2.2g of protein per kg of body weight.
                  Carbs fuel your WODs, and healthy fats support brain + hormone function.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {currentStep === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Meal Preferences</h3>

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
                  Meals Per Day
                </label>
                <MealsPerDaySelector
                  value={formData.meals_per_day}
                  onChange={(value) => setFormData(prev => ({ ...prev, meals_per_day: value }))}
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
                  <strong>Tip:</strong> Most people find &quot;Mixed/Flexible&quot; works best - batch cook proteins on the weekend,
                  but make fresh dinners during the week.
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

          {/* Step 8: Household Servings */}
          {currentStep === 'household' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Feeding Your Household</h3>
              <p className="text-gray-600">
                Are you also cooking for family members? Configure how many additional people you&apos;re feeding at each meal.
                Your macros remain the priority &mdash; we&apos;ll scale quantities accordingly.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> Children are counted as 0.6x an adult portion. You (the athlete) are automatically counted as 1 adult.
                </p>
              </div>

              {/* Use the shared component */}
              <HouseholdServingsEditor
                servings={formData.household_servings}
                onChange={(newServings) => setFormData(prev => ({ ...prev, household_servings: newServings }))}
                showQuickActions={true}
              />

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Tip:</strong> You can skip this step if you&apos;re only cooking for yourself.
                  This is completely optional and can be configured later in settings.
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

            {currentStep !== 'household' ? (
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
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
