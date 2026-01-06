'use client'

import { useState, useEffect } from 'react'
import type { MealPlanTheme, ThemeIngredientGuidance } from '@/lib/types'

export type ThemeSelection =
  | { type: 'surprise' }  // Auto-select based on preferences and season
  | { type: 'none' }      // No theme - classic meal plan
  | { type: 'specific'; themeId: string; theme: MealPlanTheme }

interface Props {
  value: ThemeSelection
  onChange: (selection: ThemeSelection) => void
  disabled?: boolean
}

export default function ThemeSelector({ value, onChange, disabled }: Props) {
  const [themes, setThemes] = useState<MealPlanTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const res = await fetch('/api/themes')
        if (res.ok) {
          const data = await res.json()
          setThemes(data)
        }
      } catch (err) {
        console.error('Error fetching themes:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchThemes()
  }, [])

  const selectedLabel =
    value.type === 'surprise' ? 'Surprise me!' :
    value.type === 'none' ? 'No theme (classic)' :
    value.type === 'specific' && value.theme ? `${value.theme.emoji || ''} ${value.theme.display_name}` :
    'Choose a theme...'

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 h-12 rounded-lg" />
    )
  }

  return (
    <div className="relative">
      {/* Selected theme button */}
      <button
        type="button"
        onClick={() => !disabled && setExpanded(!expanded)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-primary-400 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          {value.type === 'surprise' && (
            <span className="text-2xl">🎲</span>
          )}
          {value.type === 'none' && (
            <span className="text-2xl">🍽️</span>
          )}
          {value.type === 'specific' && value.theme && (
            <span className="text-2xl">{value.theme.emoji || '🍽️'}</span>
          )}
          <div className="text-left">
            <p className="font-medium text-gray-900">{selectedLabel}</p>
            <p className="text-xs text-gray-500">
              {value.type === 'surprise' && 'We\'ll pick a theme based on your preferences'}
              {value.type === 'none' && 'Classic meal plan without theme styling'}
              {value.type === 'specific' && value.theme && value.theme.description.slice(0, 60) + '...'}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {expanded && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* Surprise me option */}
          <button
            type="button"
            onClick={() => {
              onChange({ type: 'surprise' })
              setExpanded(false)
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
              value.type === 'surprise' ? 'bg-primary-50' : ''
            }`}
          >
            <span className="text-2xl">🎲</span>
            <div className="text-left">
              <p className="font-medium text-gray-900">Surprise me!</p>
              <p className="text-xs text-gray-500">Auto-select based on your preferences and season</p>
            </div>
            {value.type === 'surprise' && (
              <svg className="w-5 h-5 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* No theme option */}
          <button
            type="button"
            onClick={() => {
              onChange({ type: 'none' })
              setExpanded(false)
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100 ${
              value.type === 'none' ? 'bg-primary-50' : ''
            }`}
          >
            <span className="text-2xl">🍽️</span>
            <div className="text-left">
              <p className="font-medium text-gray-900">No theme (classic)</p>
              <p className="text-xs text-gray-500">Generate without any theme styling</p>
            </div>
            {value.type === 'none' && (
              <svg className="w-5 h-5 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-gray-200 my-1" />
          <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Or pick a specific theme
          </p>

          {/* Theme options */}
          {themes.map((theme) => {
            const guidance = theme.ingredient_guidance as ThemeIngredientGuidance
            const isSelected = value.type === 'specific' && value.themeId === theme.id

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onChange({ type: 'specific', themeId: theme.id, theme })
                  setExpanded(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100 ${
                  isSelected ? 'bg-primary-50' : ''
                }`}
              >
                <span className="text-2xl">{theme.emoji || '🍽️'}</span>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{theme.display_name}</p>
                  <p className="text-xs text-gray-500 truncate">{guidance?.flavor_profile || theme.description}</p>
                </div>
                {isSelected && (
                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {expanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
