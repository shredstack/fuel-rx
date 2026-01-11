'use client'

import type { CookingStatus } from '@/lib/types'
import { COOKING_STATUS_LABELS } from '@/lib/types'

interface Props {
  status: CookingStatus
  size?: 'sm' | 'md'
  className?: string
}

export default function CookingStatusBadge({ status, size = 'sm', className = '' }: Props) {
  // Don't render anything for not_cooked status
  if (status === 'not_cooked') {
    return null
  }

  const statusConfig = COOKING_STATUS_LABELS[status]

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  const colorClasses = {
    cooked_as_is: 'bg-green-100 text-green-700',
    cooked_with_modifications: 'bg-blue-100 text-blue-700',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${colorClasses[status]} ${className}`}
    >
      <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {statusConfig.shortLabel}
    </span>
  )
}
