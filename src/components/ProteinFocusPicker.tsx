'use client'

import { useState, useEffect, useRef } from 'react'
import type { ProteinFocusConstraint, FocusMealType, FocusMealCount } from '@/lib/types'

// Common proteins organized by category
const PROTEIN_OPTIONS = {
  poultry: [
    { value: 'chicken breast', label: 'Chicken Breast', emoji: '🍗' },
    { value: 'chicken thighs', label: 'Chicken Thighs', emoji: '🍗' },
    { value: 'ground turkey', label: 'Ground Turkey', emoji: '🦃' },
    { value: 'turkey breast', label: 'Turkey Breast', emoji: '🦃' },
  ],
  seafood: [
    { value: 'shrimp', label: 'Shrimp', emoji: '🦐' },
    { value: 'salmon', label: 'Salmon', emoji: '🐟' },
    { value: 'cod', label: 'Cod', emoji: '🐟' },
    { value: 'tuna', label: 'Tuna', emoji: '🐟' },
    { value: 'tilapia', label: 'Tilapia', emoji: '🐟' },
    { value: 'mahi mahi', label: 'Mahi Mahi', emoji: '🐟' },
  ],
  beef_pork: [
    { value: 'ground beef', label: 'Ground Beef (lean)', emoji: '🥩' },
    { value: 'beef sirloin', label: 'Beef Sirloin', emoji: '🥩' },
    { value: 'pork tenderloin', label: 'Pork Tenderloin', emoji: '🥓' },
    { value: 'pork chops', label: 'Pork Chops', emoji: '🥓' },
  ],
  other: [
    { value: 'eggs', label: 'Eggs', emoji: '🥚' },
    { value: 'tofu', label: 'Tofu', emoji: '🫘' },
    { value: 'tempeh', label: 'Tempeh', emoji: '🫘' },
    { value: 'greek yogurt', label: 'Greek Yogurt', emoji: '🥛' },
  ],
}

const MEAL_TYPE_OPTIONS: { value: FocusMealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfasts' },
  { value: 'lunch', label: 'Lunches' },
  { value: 'dinner', label: 'Dinners' },
  { value: 'snack', label: 'Snacks' },
]

const COUNT_OPTIONS: { value: FocusMealCount; label: string; description: string }[] = [
  { value: '3-4', label: '3-4 meals', description: 'Half the week' },
  { value: '5-7', label: '5-7 meals', description: 'Most of the week' },
  { value: 'all', label: 'All 7 meals', description: 'Every day' },
]

interface Props {
  value: ProteinFocusConstraint | null
  onChange: (constraint: ProteinFocusConstraint | null) => void
  disabled?: boolean
}

export default function ProteinFocusPicker({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(!!value)
  const [proteinSearch, setProteinSearch] = useState('')
  const [showProteinDropdown, setShowProteinDropdown] = useState(false)
  const [recentProteins, setRecentProteins] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch recent proteins on mount
  useEffect(() => {
    const fetchRecentProteins = async () => {
      try {
        const res = await fetch('/api/protein-focus-history')
        if (res.ok) {
          const data = await res.json()
          setRecentProteins(data.map((item: { protein: string }) => item.protein))
        }
      } catch (err) {
        console.error('Error fetching protein history:', err)
      }
    }
    fetchRecentProteins()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProteinDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter proteins by search
  const filteredProteins = Object.entries(PROTEIN_OPTIONS).map(([category, proteins]) => ({
    category,
    proteins: proteins.filter(p =>
      p.label.toLowerCase().includes(proteinSearch.toLowerCase()) ||
      p.value.toLowerCase().includes(proteinSearch.toLowerCase())
    ),
  })).filter(group => group.proteins.length > 0)

  const handleExpand = () => {
    if (disabled) return

    if (!expanded) {
      // Initialize with defaults when expanding
      onChange({
        mealType: 'dinner',
        protein: '',
        count: '5-7',
        varyCuisines: true,
      })
    }
    setExpanded(!expanded)
  }

  const handleClear = () => {
    onChange(null)
    setExpanded(false)
    setProteinSearch('')
  }

  const handleMealTypeChange = (mealType: FocusMealType) => {
    if (value) {
      onChange({ ...value, mealType })
    }
  }

  const handleProteinSelect = (protein: string) => {
    if (value) {
      onChange({ ...value, protein })
    }
    setProteinSearch('')
    setShowProteinDropdown(false)
  }

  const handleCountChange = (count: FocusMealCount) => {
    if (value) {
      onChange({ ...value, count })
    }
  }

  const handleVaryCuisinesToggle = () => {
    if (value) {
      onChange({ ...value, varyCuisines: !value.varyCuisines })
    }
  }

  const selectedProtein = value?.protein
    ? Object.values(PROTEIN_OPTIONS).flat().find(p => p.value === value.protein)
    : null

  return (
    <div className="mt-4">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={handleExpand}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : expanded
            ? 'bg-primary-50 border-primary-300'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="target">🎯</span>
          <span className={`font-medium ${expanded ? 'text-primary-700' : 'text-gray-700'}`}>
            {expanded ? 'Protein Focus' : 'Add Protein Focus (optional)'}
          </span>
        </div>
        <span className={`text-xl transition-transform ${expanded ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>

      {/* Expanded content */}
      {expanded && value && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {/* Meal type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              For my <span className="text-primary-600">{MEAL_TYPE_OPTIONS.find(o => o.value === value.mealType)?.label || 'meals'}</span> this week:
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleMealTypeChange(option.value)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    value.mealType === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Protein selector */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Focus on this protein:
            </label>
            <button
              type="button"
              onClick={() => !disabled && setShowProteinDropdown(!showProteinDropdown)}
              disabled={disabled}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border bg-white transition-colors ${
                disabled
                  ? 'border-gray-200 cursor-not-allowed'
                  : 'border-gray-300 hover:border-primary-400 cursor-pointer'
              }`}
            >
              {selectedProtein ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedProtein.emoji}</span>
                  <span className="font-medium text-gray-900">{selectedProtein.label}</span>
                </div>
              ) : (
                <span className="text-gray-500">Select a protein...</span>
              )}
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Protein dropdown */}
            {showProteinDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                {/* Search input */}
                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                  <input
                    type="text"
                    value={proteinSearch}
                    onChange={(e) => setProteinSearch(e.target.value)}
                    placeholder="Search proteins..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-primary-400"
                    autoFocus
                  />
                </div>

                {/* Recent proteins */}
                {recentProteins.length > 0 && !proteinSearch && (
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-1">Recent</p>
                    {recentProteins.slice(0, 3).map((protein) => {
                      const proteinData = Object.values(PROTEIN_OPTIONS).flat().find(p => p.value === protein)
                      if (!proteinData) return null
                      return (
                        <button
                          key={protein}
                          type="button"
                          onClick={() => handleProteinSelect(protein)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-md"
                        >
                          <span>{proteinData.emoji}</span>
                          <span className="text-sm text-gray-700">{proteinData.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Categorized protein list */}
                {filteredProteins.map(({ category, proteins }) => (
                  <div key={category} className="p-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-1">
                      {category.replace('_', ' & ')}
                    </p>
                    {proteins.map((protein) => (
                      <button
                        key={protein.value}
                        type="button"
                        onClick={() => handleProteinSelect(protein.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-md ${
                          value.protein === protein.value ? 'bg-primary-50' : ''
                        }`}
                      >
                        <span>{protein.emoji}</span>
                        <span className="text-sm text-gray-700">{protein.label}</span>
                        {value.protein === protein.value && (
                          <svg className="w-4 h-4 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                ))}

                {filteredProteins.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No proteins found matching &quot;{proteinSearch}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Count selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How many {value.mealType}s?
            </label>
            <div className="flex flex-wrap gap-2">
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCountChange(option.value)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    value.count === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs opacity-75 ml-1">({option.description})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vary cuisines toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Vary cuisines</p>
              <p className="text-xs text-gray-500">Asian, Mexican, Mediterranean, etc.</p>
            </div>
            <button
              type="button"
              onClick={handleVaryCuisinesToggle}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                value.varyCuisines ? 'bg-primary-600' : 'bg-gray-200'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  value.varyCuisines ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Clear protein focus
          </button>
        </div>
      )}
    </div>
  )
}
