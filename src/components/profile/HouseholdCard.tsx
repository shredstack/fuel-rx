'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HouseholdServingsPrefs } from '@/lib/types'
import HouseholdServingsEditor from '@/components/HouseholdServingsEditor'
// Close icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

interface HouseholdCardProps {
  householdServings: HouseholdServingsPrefs
}

export default function HouseholdCard({ householdServings: initialServings }: HouseholdCardProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [householdServings, setHouseholdServings] = useState(initialServings)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Calculate summary
  const summary = useMemo(() => {
    const days = Object.values(householdServings)
    const hasAnyServings = days.some(day =>
      Object.values(day).some(meal => meal.adults > 0 || meal.children > 0)
    )

    if (!hasAnyServings) return 'Just me'

    // Find max additional people across all days/meals
    let maxAdults = 0
    let maxChildren = 0

    days.forEach(day => {
      Object.values(day).forEach(meal => {
        maxAdults = Math.max(maxAdults, meal.adults)
        maxChildren = Math.max(maxChildren, meal.children)
      })
    })

    const parts = ['Me']
    if (maxAdults > 0) parts.push(`+ ${maxAdults} adult${maxAdults > 1 ? 's' : ''}`)
    if (maxChildren > 0) parts.push(`${maxChildren} kid${maxChildren > 1 ? 's' : ''}`)

    return parts.join(', ')
  }, [householdServings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('user_profiles')
        .update({
          household_servings: householdServings,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      setShowEditor(false)
    } catch (err) {
      console.error('Failed to save household settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span>👨‍👩‍👧</span> Household Settings
          </h2>
          <button
            onClick={() => setShowEditor(true)}
            className="text-green-600 text-sm font-medium hover:text-green-700"
          >
            Edit
          </button>
        </div>

        <p className="text-gray-700">
          Feeding: <span className="font-medium">{summary}</span>
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Grocery quantities scale to feed your household
        </p>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Household Settings</h2>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <HouseholdServingsEditor
                servings={householdServings}
                onChange={setHouseholdServings}
                showQuickActions={true}
              />
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
      )}
    </>
  )
}
