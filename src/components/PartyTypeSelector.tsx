'use client'

import { useState } from 'react'
import type { PartyType } from '@/lib/types'
import { PARTY_TYPE_LABELS } from '@/lib/types'

interface Props {
  value: PartyType
  onChange: (value: PartyType) => void
  disabled?: boolean
}

const PARTY_TYPE_ICONS: Record<PartyType, string> = {
  casual_gathering: '🏠',
  dinner_party: '🍷',
  game_day: '🏈',
  holiday: '🎄',
  potluck_contribution: '🥘',
}

const PARTY_TYPE_OPTIONS: PartyType[] = [
  'casual_gathering',
  'dinner_party',
  'game_day',
  'holiday',
  'potluck_contribution',
]

export default function PartyTypeSelector({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(false)

  const selectedLabel = PARTY_TYPE_LABELS[value].title
  const selectedDescription = PARTY_TYPE_LABELS[value].description
  const selectedIcon = PARTY_TYPE_ICONS[value]

  return (
    <div className="relative">
      {/* Selected option button */}
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
          <span className="text-2xl">{selectedIcon}</span>
          <div className="text-left">
            <p className="font-medium text-gray-900">{selectedLabel}</p>
            <p className="text-xs text-gray-500">{selectedDescription}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
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
          {PARTY_TYPE_OPTIONS.map((partyType) => {
            const isSelected = value === partyType
            const label = PARTY_TYPE_LABELS[partyType]
            return (
              <button
                key={partyType}
                type="button"
                onClick={() => {
                  onChange(partyType)
                  setExpanded(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  isSelected ? 'bg-primary-50' : ''
                }`}
              >
                <span className="text-2xl">{PARTY_TYPE_ICONS[partyType]}</span>
                <div className="text-left flex-1">
                  <p className="font-medium text-gray-900">{label.title}</p>
                  <p className="text-xs text-gray-500">{label.description}</p>
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
