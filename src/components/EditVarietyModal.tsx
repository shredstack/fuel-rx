'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MealConsistencyPrefs } from '@/lib/types'
import MealConsistencyEditor from './MealConsistencyEditor'

interface Props {
  isOpen: boolean
  onClose: () => void
  currentValues: MealConsistencyPrefs
  onSave: (values: MealConsistencyPrefs) => void
}

export default function EditVarietyModal({ isOpen, onClose, currentValues, onSave }: Props) {
  const [prefs, setPrefs] = useState<MealConsistencyPrefs>(currentValues)
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
          meal_consistency_prefs: prefs,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      onSave(prefs)
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
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Edit Meal Variety</h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose which meals stay the same each day vs. which ones vary throughout the week.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <MealConsistencyEditor prefs={prefs} onChange={setPrefs} />

        <p className="text-xs text-gray-500 mt-4">
          &quot;Same Daily&quot; meals use one recipe repeated all week for simpler meal prep.
        </p>

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
