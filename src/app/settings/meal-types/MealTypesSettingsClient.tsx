'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { SelectableMealType, MealConsistencyPrefs } from '@/lib/types'
import MealTypesSelector from '@/components/MealTypesSelector'
import MealConsistencyEditor from '@/components/MealConsistencyEditor'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  initialSettings: {
    selected_meal_types: SelectableMealType[]
    snack_count: number
    meal_consistency_prefs: MealConsistencyPrefs
  }
}

export default function MealTypesSettingsClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [selectedTypes, setSelectedTypes] = useState<SelectableMealType[]>(initialSettings.selected_meal_types)
  const [snackCount, setSnackCount] = useState(initialSettings.snack_count)
  const [consistencyPrefs, setConsistencyPrefs] = useState<MealConsistencyPrefs>(initialSettings.meal_consistency_prefs)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Calculate legacy fields for backward compatibility
      const legacyMealsPerDay = Math.min(6, Math.max(3, selectedTypes.length + snackCount)) as 3 | 4 | 5 | 6
      const includeWorkoutMeals = selectedTypes.includes('pre_workout') || selectedTypes.includes('post_workout')

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          selected_meal_types: selectedTypes,
          snack_count: snackCount,
          meal_consistency_prefs: consistencyPrefs,
          // Legacy fields
          meals_per_day: legacyMealsPerDay,
          include_workout_meals: includeWorkoutMeals,
        })
        .eq('id', user.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/settings" className="text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-primary-600">Meal Types</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">
              Dismiss
            </button>
          </div>
        )}

        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Daily Meals</h2>
          <p className="text-gray-600 mb-4">
            Select which meals you want in your plan. Pre/post-workout meals help fuel training and hit your calorie targets.
          </p>

          <MealTypesSelector
            selectedTypes={selectedTypes}
            snackCount={snackCount}
            onTypesChange={setSelectedTypes}
            onSnackCountChange={setSnackCount}
          />
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Meal Variety</h2>
          <p className="text-gray-600 mb-4">
            Choose which meals you want to keep the same each day vs. vary throughout the week.
            Consistent meals simplify meal prep and grocery shopping.
          </p>

          <MealConsistencyEditor
            prefs={consistencyPrefs}
            onChange={setConsistencyPrefs}
            selectedTypes={selectedTypes}
            snackCount={snackCount}
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-6"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mt-4">
              Settings saved successfully! Your next meal plan will use these meal types.
            </div>
          )}
        </div>

        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-primary-800">
            <strong>Note:</strong> These preferences will be used when generating your next meal plan.
            Your existing meal plans will not be affected.
          </p>
        </div>
      </main>

      <MobileTabBar />
    </div>
  )
}
