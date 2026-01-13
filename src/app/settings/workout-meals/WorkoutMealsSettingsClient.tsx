'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutTime, PreWorkoutPreference } from '@/lib/types'
import WorkoutMealsEditor from '@/components/WorkoutMealsEditor'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  initialSettings: {
    include_workout_meals: boolean
    workout_time: string
    pre_workout_preference: string
  }
}

export default function WorkoutMealsSettingsClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [values, setValues] = useState({
    includeWorkoutMeals: initialSettings.include_workout_meals,
    workoutTime: initialSettings.workout_time as WorkoutTime,
    preWorkoutPreference: initialSettings.pre_workout_preference as PreWorkoutPreference,
  })
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

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          include_workout_meals: values.includeWorkoutMeals,
          workout_time: values.workoutTime,
          pre_workout_preference: values.preWorkoutPreference,
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
          <h1 className="text-2xl font-bold text-primary-600">Workout Nutrition</h1>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pre & Post-Workout Meals</h2>
          <p className="text-gray-600 mb-4">
            Configure workout-specific nutrition to fuel your training and recovery.
          </p>

          <WorkoutMealsEditor values={values} onChange={setValues} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-6"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mt-4">
              Settings saved successfully! Your next meal plan will include workout meals.
            </div>
          )}
        </div>

        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-primary-800">
            <strong>Note:</strong> When workout meals are enabled, your meal plans will include:
          </p>
          <ul className="text-sm text-primary-800 mt-2 list-disc list-inside space-y-1">
            <li><strong>Pre-workout:</strong> Quick carbs for energy (30-60 min before training)</li>
            <li><strong>Post-workout:</strong> Protein + carbs for recovery (within 60 min after)</li>
          </ul>
        </div>
      </main>

      <MobileTabBar />
    </div>
  )
}
