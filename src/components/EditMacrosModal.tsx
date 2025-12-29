'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MacrosEditor from './MacrosEditor'

interface MacroValues {
  target_protein: number
  target_carbs: number
  target_fat: number
  target_calories: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentValues: MacroValues
  onSave: (values: MacroValues) => void
}

export default function EditMacrosModal({ isOpen, onClose, currentValues, onSave }: Props) {
  const [values, setValues] = useState<MacroValues>(currentValues)
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
          target_protein: values.target_protein,
          target_carbs: values.target_carbs,
          target_fat: values.target_fat,
          target_calories: values.target_calories,
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
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Daily Macros</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <MacrosEditor values={values} onChange={setValues} />

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
