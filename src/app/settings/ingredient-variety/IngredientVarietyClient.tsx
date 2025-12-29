'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { IngredientVarietyPrefs } from '@/lib/types'
import IngredientVarietyEditor from '@/components/IngredientVarietyEditor'

interface Props {
  initialSettings: IngredientVarietyPrefs
}

export default function IngredientVarietyClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<IngredientVarietyPrefs>(initialSettings)
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
          ingredient_variety_prefs: prefs,
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">Ingredient Variety</h1>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
            Settings saved successfully! Your next meal plan will use these preferences.
          </div>
        )}

        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Grocery Shopping Preferences</h2>
          <p className="text-gray-600 mb-4">
            How many different items do you want to buy in each category? Fewer items means a simpler
            shopping list and easier meal prep. More items means more variety in your meals.
          </p>

          <IngredientVarietyEditor prefs={prefs} onChange={setPrefs} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-6"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-primary-800">
            <strong>Tip:</strong> A typical efficient grocery list has 3 proteins, 5 vegetables, 2 fruits,
            2 grains, 3 fats, and 2 dairy items. This creates variety while keeping shopping simple.
          </p>
        </div>
      </main>
    </div>
  )
}
