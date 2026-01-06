'use client'

import { useState, useEffect } from 'react'
import type { MealPlanTheme, ThemePreferenceType, ThemeIngredientGuidance } from '@/lib/types'

interface ThemeWithPreference {
  theme: MealPlanTheme
  preference: ThemePreferenceType | null
}

interface Props {
  onSave?: () => void
}

const SEASON_NAMES: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

export default function ThemePreferencesEditor({ onSave }: Props) {
  const [themes, setThemes] = useState<ThemeWithPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch themes and preferences on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesRes, prefsRes] = await Promise.all([
          fetch('/api/themes'),
          fetch('/api/theme-preferences'),
        ])

        if (!themesRes.ok || !prefsRes.ok) {
          throw new Error('Failed to fetch themes')
        }

        const themesData: MealPlanTheme[] = await themesRes.json()
        const prefsData: Array<{ theme_id: string; preference: ThemePreferenceType }> = await prefsRes.json()

        // Create a map of preferences
        const prefsMap = new Map(prefsData.map(p => [p.theme_id, p.preference]))

        // Merge themes with preferences
        const themesWithPrefs: ThemeWithPreference[] = themesData.map(theme => ({
          theme,
          preference: prefsMap.get(theme.id) || null,
        }))

        setThemes(themesWithPrefs)
      } catch (err) {
        console.error('Error fetching themes:', err)
        setError('Failed to load themes')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const togglePreference = async (themeId: string, preference: ThemePreferenceType) => {
    setSaving(themeId)
    setError(null)

    const currentTheme = themes.find(t => t.theme.id === themeId)
    const currentPref = currentTheme?.preference

    try {
      if (currentPref === preference) {
        // Remove preference
        const res = await fetch(`/api/theme-preferences?theme_id=${themeId}`, {
          method: 'DELETE',
        })

        if (!res.ok) throw new Error('Failed to remove preference')

        setThemes(prev =>
          prev.map(t =>
            t.theme.id === themeId ? { ...t, preference: null } : t
          )
        )
      } else {
        // Set or update preference
        const res = await fetch('/api/theme-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme_id: themeId, preference }),
        })

        if (!res.ok) throw new Error('Failed to save preference')

        setThemes(prev =>
          prev.map(t =>
            t.theme.id === themeId ? { ...t, preference } : t
          )
        )
      }

      onSave?.()
    } catch (err) {
      console.error('Error updating preference:', err)
      setError('Failed to update preference')
    } finally {
      setSaving(null)
    }
  }

  const getSeasonLabel = (peakSeasons: number[]) => {
    if (!peakSeasons || peakSeasons.length === 0) return 'Year-round'
    if (peakSeasons.length === 12) return 'Year-round'
    return peakSeasons.map(m => SEASON_NAMES[m]).join(', ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error && themes.length === 0) {
    return (
      <div className="text-red-600 bg-red-50 p-4 rounded-lg">
        {error}
      </div>
    )
  }

  const preferredThemes = themes.filter(t => t.preference === 'preferred')
  const blockedThemes = themes.filter(t => t.preference === 'blocked')

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">{preferredThemes.length} preferred</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">{blockedThemes.length} blocked</span>
        </div>
      </div>

      {/* Theme cards */}
      <div className="grid gap-4">
        {themes.map(({ theme, preference }) => {
          const isExpanded = expandedTheme === theme.id
          const isSaving = saving === theme.id
          const guidance = theme.ingredient_guidance as ThemeIngredientGuidance

          return (
            <div
              key={theme.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                preference === 'preferred'
                  ? 'border-green-300 bg-green-50'
                  : preference === 'blocked'
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Theme header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{theme.emoji || '🍽️'}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{theme.display_name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{theme.description}</p>
                      </div>
                    </div>
                  </button>

                  {/* Preference buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePreference(theme.id, 'preferred')}
                      disabled={isSaving}
                      className={`p-2 rounded-full transition-colors ${
                        preference === 'preferred'
                          ? 'bg-green-100 text-green-600'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      } disabled:opacity-50`}
                      title="Prefer this theme"
                    >
                      <svg className="w-5 h-5" fill={preference === 'preferred' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => togglePreference(theme.id, 'blocked')}
                      disabled={isSaving}
                      className={`p-2 rounded-full transition-colors ${
                        preference === 'blocked'
                          ? 'bg-red-100 text-red-600'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      } disabled:opacity-50`}
                      title="Block this theme"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  {theme.peak_seasons && theme.peak_seasons.length > 0 && theme.peak_seasons.length < 12 && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                      Peak: {getSeasonLabel(theme.peak_seasons)}
                    </span>
                  )}
                  {theme.compatible_diets && theme.compatible_diets.length > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {theme.compatible_diets.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && guidance && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Flavor Profile</h4>
                      <p className="text-sm text-gray-600">{guidance.flavor_profile}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Cooking Style</h4>
                      <p className="text-sm text-gray-600">{theme.cooking_style_guidance}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {guidance.proteins && guidance.proteins.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-red-600 mb-1">Proteins</h5>
                          <p className="text-xs text-gray-600">{guidance.proteins.slice(0, 5).join(', ')}{guidance.proteins.length > 5 ? '...' : ''}</p>
                        </div>
                      )}
                      {guidance.vegetables && guidance.vegetables.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-green-600 mb-1">Vegetables</h5>
                          <p className="text-xs text-gray-600">{guidance.vegetables.slice(0, 5).join(', ')}{guidance.vegetables.length > 5 ? '...' : ''}</p>
                        </div>
                      )}
                      {guidance.grains && guidance.grains.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-amber-600 mb-1">Grains</h5>
                          <p className="text-xs text-gray-600">{guidance.grains.slice(0, 5).join(', ')}{guidance.grains.length > 5 ? '...' : ''}</p>
                        </div>
                      )}
                      {guidance.seasonings && guidance.seasonings.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-purple-600 mb-1">Seasonings</h5>
                          <p className="text-xs text-gray-600">{guidance.seasonings.slice(0, 5).join(', ')}{guidance.seasonings.length > 5 ? '...' : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-sm text-gray-500">
        Preferred themes are more likely to be selected. Blocked themes will never be used.
        When generating a meal plan, you can also choose a specific theme or let us surprise you.
      </p>
    </div>
  )
}
