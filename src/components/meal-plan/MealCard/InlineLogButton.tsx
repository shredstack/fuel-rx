'use client'

import { useState } from 'react'
import type { MealSlot, MealType } from '@/lib/types'
import { LogMealModal } from '../LogMealModal'

interface InlineLogButtonProps {
  mealSlot: MealSlot
  mealPlanMealId: string
  defaultMealType?: MealType
  onLogSuccess?: () => void
}

export function InlineLogButton({
  mealSlot,
  mealPlanMealId,
  defaultMealType,
  onLogSuccess,
}: InlineLogButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleLogSuccess = () => {
    // Show success feedback
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
    onLogSuccess?.()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`p-2 rounded-full transition-colors ${
          showSuccess
            ? 'bg-green-100 text-green-600'
            : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
        }`}
        title="Log this meal"
      >
        {showSuccess ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      <LogMealModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        mealSlot={mealSlot}
        mealPlanMealId={mealPlanMealId}
        defaultMealType={defaultMealType}
        onLogSuccess={handleLogSuccess}
      />
    </>
  )
}
