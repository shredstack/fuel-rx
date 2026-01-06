'use client'

import { useState } from 'react'
import type { MealPlanTheme, ThemeIngredientGuidance } from '@/lib/types'

interface Props {
  theme: MealPlanTheme
  showDetails?: boolean
}

export default function ThemeBadge({ theme, showDetails = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const guidance = theme.ingredient_guidance as ThemeIngredientGuidance

  if (!showDetails) {
    // Simple inline badge
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
        <span>{theme.emoji || '🍽️'}</span>
        <span>{theme.display_name}</span>
      </span>
    )
  }

  // Expandable card with details
  return (
    <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-primary-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{theme.emoji || '🍽️'}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{theme.display_name} Theme</h3>
            <p className="text-sm text-gray-600 line-clamp-1">{theme.description}</p>
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

      {expanded && guidance && (
        <div className="px-4 pb-4 pt-2 border-t border-primary-200/50">
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
                  <h5 className="text-xs font-medium text-red-600 mb-1">Key Proteins</h5>
                  <p className="text-xs text-gray-600">{guidance.proteins.slice(0, 4).join(', ')}</p>
                </div>
              )}
              {guidance.vegetables && guidance.vegetables.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-green-600 mb-1">Key Vegetables</h5>
                  <p className="text-xs text-gray-600">{guidance.vegetables.slice(0, 4).join(', ')}</p>
                </div>
              )}
              {guidance.seasonings && guidance.seasonings.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-purple-600 mb-1">Key Seasonings</h5>
                  <p className="text-xs text-gray-600">{guidance.seasonings.slice(0, 4).join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
