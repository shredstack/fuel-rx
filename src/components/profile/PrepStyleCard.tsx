'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, PrepStyle, MealComplexity } from '@/lib/types'
import { PREP_STYLE_LABELS, MEAL_COMPLEXITY_LABELS, DEFAULT_PREP_STYLE, DEFAULT_MEAL_COMPLEXITY_PREFS } from '@/lib/types'

interface PrepStyleCardProps {
  profile: UserProfile
}

export default function PrepStyleCard({ profile }: PrepStyleCardProps) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Use defaults if profile values are null/undefined
  const [prepStyle, setPrepStyle] = useState<PrepStyle>(profile.prep_style || DEFAULT_PREP_STYLE)
  const [breakfastComplexity, setBreakfastComplexity] = useState<MealComplexity>(profile.breakfast_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.breakfast)
  const [lunchComplexity, setLunchComplexity] = useState<MealComplexity>(profile.lunch_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.lunch)
  const [dinnerComplexity, setDinnerComplexity] = useState<MealComplexity>(profile.dinner_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.dinner)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('user_profiles')
        .update({
          prep_style: prepStyle,
          breakfast_complexity: breakfastComplexity,
          lunch_complexity: lunchComplexity,
          dinner_complexity: dinnerComplexity,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save prep preferences:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setPrepStyle(profile.prep_style || DEFAULT_PREP_STYLE)
    setBreakfastComplexity(profile.breakfast_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.breakfast)
    setLunchComplexity(profile.lunch_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.lunch)
    setDinnerComplexity(profile.dinner_complexity || DEFAULT_MEAL_COMPLEXITY_PREFS.dinner)
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>🍳</span> Meal Prep Style
        </h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-green-600 text-sm font-medium hover:text-green-700"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="text-gray-500 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-green-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {/* Prep Style Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              When do you prefer to prep?
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(PREP_STYLE_LABELS) as [PrepStyle, typeof PREP_STYLE_LABELS[PrepStyle]][]).map(([value, { title, description }]) => (
                <button
                  key={value}
                  onClick={() => setPrepStyle(value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    prepStyle === value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{title}</div>
                  <div className="text-xs text-gray-500 mt-1">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Meal Complexity Selectors */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Meal complexity preferences
            </label>

            {[
              { label: 'Breakfast', value: breakfastComplexity, setter: setBreakfastComplexity },
              { label: 'Lunch', value: lunchComplexity, setter: setLunchComplexity },
              { label: 'Dinner', value: dinnerComplexity, setter: setDinnerComplexity },
            ].map(({ label, value, setter }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-20">{label}</span>
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value as MealComplexity)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {(Object.entries(MEAL_COMPLEXITY_LABELS) as [MealComplexity, typeof MEAL_COMPLEXITY_LABELS[MealComplexity]][]).map(([v, { title }]) => (
                    <option key={v} value={v}>{title}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Style:</span>{' '}
            <span className="font-medium">{PREP_STYLE_LABELS[prepStyle]?.title || 'Day-Of Fresh Cooking'}</span>
          </p>
          <p>
            <span className="text-gray-500">Breakfast:</span>{' '}
            <span className="font-medium">{MEAL_COMPLEXITY_LABELS[breakfastComplexity]?.title || 'Minimal Prep'}</span>
          </p>
          <p>
            <span className="text-gray-500">Lunch:</span>{' '}
            <span className="font-medium">{MEAL_COMPLEXITY_LABELS[lunchComplexity]?.title || 'Minimal Prep'}</span>
          </p>
          <p>
            <span className="text-gray-500">Dinner:</span>{' '}
            <span className="font-medium">{MEAL_COMPLEXITY_LABELS[dinnerComplexity]?.title || 'Full Recipe'}</span>
          </p>
        </div>
      )}
    </div>
  )
}
