'use client'

import type { DietaryPreference } from '@/lib/types'
import { DIETARY_PREFERENCE_LABELS } from '@/lib/types'

interface Props {
  selectedPrefs: DietaryPreference[]
  onChange: (prefs: DietaryPreference[]) => void
}

export default function DietaryPrefsEditor({ selectedPrefs, onChange }: Props) {
  const togglePref = (pref: DietaryPreference) => {
    let newPrefs = [...selectedPrefs]

    if (pref === 'no_restrictions') {
      newPrefs = ['no_restrictions']
    } else {
      newPrefs = newPrefs.filter(p => p !== 'no_restrictions')
      if (newPrefs.includes(pref)) {
        newPrefs = newPrefs.filter(p => p !== pref)
      } else {
        newPrefs.push(pref)
      }
      if (newPrefs.length === 0) {
        newPrefs = ['no_restrictions']
      }
    }

    onChange(newPrefs)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(DIETARY_PREFERENCE_LABELS) as DietaryPreference[]).map((pref) => (
        <button
          key={pref}
          type="button"
          onClick={() => togglePref(pref)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedPrefs.includes(pref)
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {DIETARY_PREFERENCE_LABELS[pref]}
        </button>
      ))}
    </div>
  )
}
