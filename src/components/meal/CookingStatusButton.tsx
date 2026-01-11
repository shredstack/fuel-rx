'use client'

import { useState } from 'react'
import type { CookingStatus } from '@/lib/types'
import { COOKING_STATUS_LABELS } from '@/lib/types'
import CookingStatusModal from './CookingStatusModal'

interface Props {
  status: CookingStatus
  mealName: string
  currentInstructions?: string[]
  onStatusChange: (status: CookingStatus, notes?: string, updatedInstructions?: string[]) => Promise<void>
  variant?: 'button' | 'icon'
  className?: string
}

export default function CookingStatusButton({
  status,
  mealName,
  currentInstructions = [],
  onStatusChange,
  variant = 'button',
  className = '',
}: Props) {
  const [showModal, setShowModal] = useState(false)

  const statusConfig = COOKING_STATUS_LABELS[status]

  const handleSubmit = async (
    newStatus: CookingStatus,
    notes?: string,
    updatedInstructions?: string[]
  ) => {
    await onStatusChange(newStatus, notes, updatedInstructions)
  }

  // Icon-only variant (for compact displays)
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className={`p-2 rounded-lg transition-all ${
            status === 'not_cooked'
              ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              : status === 'cooked_as_is'
                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          } ${className}`}
          title={statusConfig.label}
        >
          {status === 'not_cooked' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          )}
        </button>

        <CookingStatusModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          currentStatus={status}
          mealName={mealName}
          currentInstructions={currentInstructions}
        />
      </>
    )
  }

  // Button variant (default)
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          status === 'not_cooked'
            ? 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            : status === 'cooked_as_is'
              ? 'text-green-700 bg-green-100 hover:bg-green-200'
              : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
        } ${className}`}
      >
        {status === 'not_cooked' ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Mark as Cooked
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {statusConfig.shortLabel}
          </>
        )}
      </button>

      <CookingStatusModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        currentStatus={status}
        mealName={mealName}
        currentInstructions={currentInstructions}
      />
    </>
  )
}
