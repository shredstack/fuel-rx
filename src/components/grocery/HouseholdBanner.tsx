'use client'

import type { GroceryListHouseholdInfo } from '@/lib/types'

interface Props {
  householdInfo: GroceryListHouseholdInfo
}

export default function HouseholdBanner({ householdInfo }: Props) {
  return (
    <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </span>
        <div>
          <h3 className="font-medium text-primary-900">
            Cooking for {householdInfo.description}
          </h3>
          <p className="text-sm text-primary-700 mt-1">
            Amounts shown are per adult per meal. Expand each item to see which meals use it,
            then scale up as needed for your household.
          </p>
        </div>
      </div>
    </div>
  )
}
