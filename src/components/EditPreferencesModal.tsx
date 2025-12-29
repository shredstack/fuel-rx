'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DietaryPreference, PrepTime, MealsPerDay } from '@/lib/types'
import DietaryPrefsEditor from './DietaryPrefsEditor'
import MealsPerDaySelector from './MealsPerDaySelector'
import PrepTimeSelector from './PrepTimeSelector'

interface PreferenceValues {
  dietary_prefs: DietaryPreference[]
  meals_per_day: MealsPerDay
  prep_time: PrepTime
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentValues: PreferenceValues
  onSave: (values: PreferenceValues) => void
}

export default function EditPreferencesModal({ isOpen, onClose, currentValues, onSave }: Props) {
  const [values, setValues] = useState<PreferenceValues>(currentValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          dietary_prefs: values.dietary_prefs,
          meals_per_day: values.meals_per_day,
          prep_time: values.prep_time,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      onSave(values)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Preferences</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dietary Preferences
            </label>
            <DietaryPrefsEditor
              selectedPrefs={values.dietary_prefs}
              onChange={(prefs) => setValues(prev => ({ ...prev, dietary_prefs: prefs }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meals Per Day
            </label>
            <MealsPerDaySelector
              value={values.meals_per_day}
              onChange={(value) => setValues(prev => ({ ...prev, meals_per_day: value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Prep Time
            </label>
            <PrepTimeSelector
              value={values.prep_time}
              onChange={(value) => setValues(prev => ({ ...prev, prep_time: value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn-outline flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
