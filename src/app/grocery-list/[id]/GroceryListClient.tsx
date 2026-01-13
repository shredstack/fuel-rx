'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Ingredient, CoreIngredients } from '@/lib/types'
import Logo from '@/components/Logo'
import CoreIngredientsCard from '@/components/CoreIngredientsCard'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'
import { useOnboardingState } from '@/hooks/useOnboardingState'

interface Props {
  mealPlanId: string
  weekStartDate: string
  groceryList: Ingredient[]
  coreIngredients?: CoreIngredients | null
}

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  grains: 'Grains & Bread',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
}

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other']

export default function GroceryListClient({ mealPlanId, weekStartDate, groceryList, coreIngredients }: Props) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  // Onboarding state
  const { state: onboardingState, markMilestone, shouldShowTip, dismissTip } = useOnboardingState()

  // Mark grocery_list_viewed milestone on mount
  useEffect(() => {
    if (onboardingState && !onboardingState.grocery_list_viewed) {
      markMilestone('grocery_list_viewed')
    }
  }, [onboardingState, markMilestone])

  // Group items by category
  const groupedItems = groceryList.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, Ingredient[]>)

  // Sort categories
  const sortedCategories = CATEGORY_ORDER.filter(cat => groupedItems[cat])

  const toggleItem = (itemKey: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey)
      } else {
        newSet.add(itemKey)
      }
      return newSet
    })
  }

  const totalItems = groceryList.length
  const checkedCount = checkedItems.size

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/meal-plan/${mealPlanId}`} className="hover:text-gray-700">
              Meal Plan
            </Link>
            <span>/</span>
            <span>Grocery List</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Grocery List
          </h1>
          <p className="text-gray-600">
            Week of {new Date(weekStartDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Core Ingredients Summary */}
        {coreIngredients && (
          <div className="mb-6">
            <CoreIngredientsCard coreIngredients={coreIngredients} />
          </div>
        )}

        {/* Onboarding tip for checklist feature */}
        {shouldShowTip('grocery_list_checklist') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <p className="text-blue-800">
                  <strong>Pro tip:</strong> Check off items as you shop! Your progress is saved locally.
                </p>
              </div>
              <button
                onClick={() => dismissTip('grocery_list_checklist')}
                className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
                aria-label="Dismiss tip"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Shopping Progress</span>
            <span className="text-sm text-gray-500">
              {checkedCount} of {totalItems} items
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Grocery list by category */}
        <div className="space-y-6">
          {sortedCategories.map(category => (
            <div key={category} className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className="space-y-3">
                {groupedItems[category].map((item, idx) => {
                  const itemKey = `${category}-${item.name}-${idx}`
                  const isChecked = checkedItems.has(itemKey)

                  return (
                    <li key={itemKey}>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(itemKey)}
                          className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span
                          className={`flex-1 ${
                            isChecked ? 'line-through text-gray-400' : 'text-gray-700'
                          }`}
                        >
                          <span className="font-medium">{item.amount} {item.unit}</span>{' '}
                          {item.name}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <Link
            href={`/meal-plan/${mealPlanId}`}
            className="btn-outline flex-1 text-center"
          >
            Back to Meal Plan
          </Link>
          <button
            onClick={() => setCheckedItems(new Set())}
            className="btn-secondary"
            disabled={checkedCount === 0}
          >
            Clear All
          </button>
        </div>
      </main>

      <MobileTabBar />
    </div>
  )
}
