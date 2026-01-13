'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DietaryPreference } from '@/lib/types'
// Close icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

interface DietaryRestrictionsEditorProps {
  currentRestrictions: DietaryPreference[]
  onClose: () => void
}

const RESTRICTIONS: { id: DietaryPreference; label: string; emoji: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { id: 'paleo', label: 'Paleo', emoji: '🍖' },
  { id: 'gluten_free', label: 'Gluten-Free', emoji: '🌾' },
  { id: 'dairy_free', label: 'Dairy-Free', emoji: '🥛' },
]

export default function DietaryRestrictionsEditor({
  currentRestrictions,
  onClose
}: DietaryRestrictionsEditorProps) {
  const supabase = createClient()
  // Filter out 'no_restrictions' for selection state
  const [selected, setSelected] = useState<DietaryPreference[]>(
    currentRestrictions.filter(r => r !== 'no_restrictions')
  )
  const [saving, setSaving] = useState(false)

  const toggleRestriction = (id: DietaryPreference) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // If no restrictions selected, store 'no_restrictions'
      const toSave: DietaryPreference[] = selected.length > 0 ? selected : ['no_restrictions']

      const { error } = await supabase
        .from('user_profiles')
        .update({
          dietary_prefs: toSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      onClose()
      // Trigger a page refresh to show updated data
      window.location.reload()
    } catch (err) {
      console.error('Failed to save restrictions:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Dietary Restrictions</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-600 mb-4">
            Select any dietary restrictions that apply to you. These will be considered when generating your meal plans.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {RESTRICTIONS.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => toggleRestriction(id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selected.includes(id)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-1 block">{emoji}</span>
                <span className="font-medium text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
