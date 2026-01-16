'use client'

import { useState, useMemo } from 'react'
import type { GroceryItemWithContext, GroceryListHouseholdInfo, DayOfWeek, MealType } from '@/lib/types'

interface Props {
  item: GroceryItemWithContext
  isChecked: boolean
  onToggle: () => void
  householdInfo?: GroceryListHouseholdInfo
}

const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-WO',
  lunch: 'Lunch',
  post_workout: 'Post-WO',
  snack: 'Snack',
  dinner: 'Dinner',
}

/**
 * Calculate the weekly total for an ingredient.
 * Returns null if amounts can't be summed (mixed units or non-numeric).
 */
function calculateWeeklyTotal(item: GroceryItemWithContext): { total: string; unit: string } | null {
  if (item.meals.length === 0) return null

  // Group by unit to check if units are consistent
  const unitGroups: Record<string, number[]> = {}

  for (const meal of item.meals) {
    const amount = parseFloat(meal.amount)
    if (isNaN(amount)) continue

    const unit = (meal.unit || '').toLowerCase().trim()
    if (!unitGroups[unit]) {
      unitGroups[unit] = []
    }
    unitGroups[unit].push(amount)
  }

  const units = Object.keys(unitGroups)

  // If no valid numeric amounts, return null
  if (units.length === 0) return null

  // If multiple different units, we can't sum them reliably
  // But we can try to find the dominant unit
  if (units.length > 1) {
    // Find the unit with the most entries
    const sortedUnits = units.sort((a, b) => unitGroups[b].length - unitGroups[a].length)
    const dominantUnit = sortedUnits[0]

    // Only use dominant unit if it accounts for majority of items
    if (unitGroups[dominantUnit].length < item.meals.length * 0.6) {
      return null // Too mixed to give a useful total
    }

    const total = unitGroups[dominantUnit].reduce((a, b) => a + b, 0)
    return { total: formatAmount(total), unit: dominantUnit }
  }

  // Single unit - sum all amounts
  const unit = units[0]
  const total = unitGroups[unit].reduce((a, b) => a + b, 0)

  return { total: formatAmount(total), unit }
}

/**
 * Format an amount for display (remove unnecessary decimals)
 */
function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return amount.toString()
  }
  // Round to 1 decimal place
  const rounded = Math.round(amount * 10) / 10
  if (Number.isInteger(rounded)) {
    return rounded.toString()
  }
  return rounded.toFixed(1)
}

export default function GroceryItemCard({ item, isChecked, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Calculate weekly total for 1 adult
  const weeklyTotal = useMemo(() => calculateWeeklyTotal(item), [item])

  // Generate display summary (e.g., "3 dinners, 1 lunch")
  const summary = useMemo(() => {
    const mealTypeCounts: Record<string, number> = {}
    item.meals.forEach(m => {
      mealTypeCounts[m.meal_type] = (mealTypeCounts[m.meal_type] || 0) + 1
    })

    const parts = Object.entries(mealTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)

    return parts.join(', ')
  }, [item.meals])

  return (
    <div className={`border rounded-lg transition-colors ${isChecked ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className={`font-medium ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {item.name}
            </span>
            {weeklyTotal && (
              <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {weeklyTotal.total} {weeklyTotal.unit}
              </span>
            )}
            <span className="text-sm text-gray-500">
              ({summary})
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable meal references */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100">
          <ul className="space-y-1 mt-2">
            {item.meals.map((meal, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-10 text-gray-400 font-medium">
                  {DAY_ABBREVIATIONS[meal.day]}
                </span>
                <span className="w-20 text-gray-500">
                  {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                </span>
                <span className="flex-1 truncate text-gray-700">
                  {meal.meal_name}
                </span>
                <span className="text-gray-400 font-mono text-xs whitespace-nowrap">
                  {meal.amount} {meal.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
