'use client'

import { useState } from 'react'
import type { GeneratedMeal } from '@/lib/types'
import { MEAL_TYPE_LABELS } from '@/lib/types'
import NutritionDisclaimer from '@/components/NutritionDisclaimer'

interface Props {
  meal: GeneratedMeal
  onSave: () => void
  onRegenerate: () => void
  saving?: boolean
  socialFeedEnabled?: boolean
  shareWithCommunity?: boolean
  onShareWithCommunityChange?: (value: boolean) => void
}

function MacroDisplay({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{Math.round(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xs text-gray-400">{unit}</p>
    </div>
  )
}

export default function SingleMealResult({
  meal,
  onSave,
  onRegenerate,
  saving,
  socialFeedEnabled,
  shareWithCommunity,
  onShareWithCommunityChange,
}: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = formatMealAsText(meal)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {meal.emoji} {meal.name}
          </h2>
          <p className="text-gray-600 mt-1">{meal.description}</p>
        </div>
        <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
          {MEAL_TYPE_LABELS[meal.type]}
        </span>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg mb-4">
        <MacroDisplay label="Calories" value={meal.macros.calories} unit="kcal" />
        <MacroDisplay label="Protein" value={meal.macros.protein} unit="g" />
        <MacroDisplay label="Carbs" value={meal.macros.carbs} unit="g" />
        <MacroDisplay label="Fat" value={meal.macros.fat} unit="g" />
      </div>

      {/* Nutrition Disclaimer - Required by Apple App Store Guideline 1.4.1 */}
      <NutritionDisclaimer variant="compact" className="mb-6" />

      {/* Time and Servings */}
      <div className="flex gap-6 mb-6 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Prep: {meal.prep_time_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
          Cook: {meal.cook_time_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Serves: {meal.servings}
        </span>
      </div>

      {/* Ingredients */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ingredients
        </h3>
        <ul className="space-y-2">
          {meal.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-800">
                <span className="font-medium">{ing.amount} {ing.unit}</span> {ing.name}
              </span>
              <span className="text-gray-400 text-sm">
                {ing.calories}cal | {ing.protein}p
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Instructions
        </h3>
        <ol className="space-y-3">
          {meal.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-gray-700 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Tips */}
      {meal.tips && meal.tips.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Pro Tips
          </h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {meal.tips.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-600">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Share with Community Toggle */}
      {socialFeedEnabled && onShareWithCommunityChange && (
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-4">
          <input
            type="checkbox"
            id="share-with-community"
            checked={shareWithCommunity}
            onChange={(e) => onShareWithCommunityChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
          />
          <label htmlFor="share-with-community" className="flex-1 cursor-pointer">
            <span className="text-sm font-medium text-gray-900">Share with community</span>
            <p className="text-xs text-gray-500 mt-0.5">
              This meal will be visible to other FuelRx users
            </p>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save to My Meals
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className="btn-outline px-4"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <button
          onClick={onRegenerate}
          className="btn-outline px-4"
          title="Generate another meal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function formatMealAsText(meal: GeneratedMeal): string {
  let text = `${meal.emoji} ${meal.name}\n\n`
  text += `${meal.description}\n\n`
  text += `Macros: ${meal.macros.calories} cal | ${meal.macros.protein}g protein | ${meal.macros.carbs}g carbs | ${meal.macros.fat}g fat\n`
  text += `Prep: ${meal.prep_time_minutes} min | Cook: ${meal.cook_time_minutes} min | Serves: ${meal.servings}\n\n`

  text += `INGREDIENTS:\n`
  meal.ingredients.forEach(ing => {
    text += `• ${ing.amount} ${ing.unit} ${ing.name}\n`
  })

  text += `\nINSTRUCTIONS:\n`
  meal.instructions.forEach((step, i) => {
    text += `${i + 1}. ${step}\n`
  })

  if (meal.tips && meal.tips.length > 0) {
    text += `\nPRO TIPS:\n`
    meal.tips.forEach(tip => {
      text += `• ${tip}\n`
    })
  }

  return text
}
