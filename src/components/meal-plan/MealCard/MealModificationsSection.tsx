'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { MealPlanMealCookingStatus, MealEntity } from '@/lib/types'

interface MealModificationsSectionProps {
  cookingStatusData: MealPlanMealCookingStatus
  meal: MealEntity
  mealPlanId: string
  mealSlotId: string
}

export function MealModificationsSection({
  cookingStatusData,
  meal,
  mealPlanId,
  mealSlotId,
}: MealModificationsSectionProps) {
  const [savingAsCustom, setSavingAsCustom] = useState(false)
  const [savedAsCustom, setSavedAsCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasModifications = cookingStatusData.modification_notes || cookingStatusData.cooked_photo_url

  const handleSaveAsCustomMeal = async () => {
    setSavingAsCustom(true)
    setError(null)

    try {
      const response = await fetch('/api/meals/save-as-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMealId: meal.id,
          mealPlanId,
          mealSlotId,
          includeNotes: true,
          includePhoto: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save as custom meal')
      }

      setSavedAsCustom(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingAsCustom(false)
    }
  }

  if (!hasModifications) return null

  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
      <div className="flex items-center justify-between mb-3">
        <h5 className="font-medium text-blue-900 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Your Modifications
        </h5>
        {!savedAsCustom ? (
          <button
            onClick={handleSaveAsCustomMeal}
            disabled={savingAsCustom}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {savingAsCustom ? (
              'Saving...'
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save as My Meal
              </>
            )}
          </button>
        ) : (
          <span className="text-sm text-green-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved to My Meals
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        {/* Photo */}
        {cookingStatusData.cooked_photo_url && (
          <div className="flex-shrink-0">
            <div className="relative w-full md:w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={cookingStatusData.cooked_photo_url}
                alt="Your cooked meal"
                fill
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        {cookingStatusData.modification_notes && (
          <div className="flex-1">
            <p className="text-xs text-blue-700 font-medium mb-1">Your Notes</p>
            <p className="text-sm text-gray-700">{cookingStatusData.modification_notes}</p>
          </div>
        )}
      </div>

      {/* Cooked timestamp */}
      {cookingStatusData.cooked_at && (
        <p className="text-xs text-blue-600 mt-3">
          Cooked on {new Date(cookingStatusData.cooked_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
