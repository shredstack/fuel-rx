'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PrepStyle, MealComplexity } from '@/lib/types'
import PrepStyleSelector from '@/components/PrepStyleSelector'
import MealComplexityEditor from '@/components/MealComplexityEditor'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  initialSettings: {
    prep_style: string
    breakfast_complexity: string
    lunch_complexity: string
    dinner_complexity: string
  }
}

export default function PrepSettingsClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [prepStyle, setPrepStyle] = useState<PrepStyle>(initialSettings.prep_style as PrepStyle)
  const [complexityValues, setComplexityValues] = useState({
    breakfast: initialSettings.breakfast_complexity as MealComplexity,
    lunch: initialSettings.lunch_complexity as MealComplexity,
    dinner: initialSettings.dinner_complexity as MealComplexity,
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
          prep_style: prepStyle,
          breakfast_complexity: complexityValues.breakfast,
          lunch_complexity: complexityValues.lunch,
          dinner_complexity: complexityValues.dinner,
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
          <h1 className="text-2xl font-bold text-primary-600">Meal Prep Settings</h1>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Prep Style</h2>
          <p className="text-gray-600 mb-4">
            How do you prefer to meal prep? We&apos;ll organize your weekly prep schedule to match your style.
          </p>

          <PrepStyleSelector value={prepStyle} onChange={setPrepStyle} />
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Meal Complexity</h2>
          <p className="text-gray-600 mb-4">
            What level of cooking effort do you prefer for each meal type?
          </p>

          <MealComplexityEditor values={complexityValues} onChange={setComplexityValues} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-6"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mt-4">
              Settings saved successfully! Your next meal plan will use these preferences.
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
