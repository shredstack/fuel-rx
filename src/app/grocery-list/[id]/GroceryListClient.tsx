'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { ContextualGroceryList, GroceryItemWithContext, CoreIngredients, GroceryCategory, MealType, MealPlanStapleWithDetails, GroceryStaple, MealPlanCustomItem } from '@/lib/types'
import CoreIngredientsCard from '@/components/CoreIngredientsCard'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'
import GroceryItemCard from '@/components/grocery/GroceryItemCard'
import HouseholdBanner from '@/components/grocery/HouseholdBanner'
import GroceryStaplesSection from '@/components/grocery/GroceryStaplesSection'
import { useOnboardingState } from '@/hooks/useOnboardingState'

interface Props {
  mealPlanId: string
  weekStartDate: string
  groceryList: ContextualGroceryList
  coreIngredients?: CoreIngredients | null
  initialStaples: MealPlanStapleWithDetails[]
  availableStaples: GroceryStaple[]
  initialCustomItems: MealPlanCustomItem[]
  initialCheckedItems: string[]
}

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  grains: 'Grains & Bread',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
}

const CATEGORY_ORDER: GroceryCategory[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other']

// Meal types that can be filtered
const FILTERABLE_MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snacks' },
]

export default function GroceryListClient({ mealPlanId, weekStartDate, groceryList, coreIngredients, initialStaples, availableStaples: initialAvailableStaples, initialCustomItems, initialCheckedItems }: Props) {
  // Initialize checked items from persisted data (normalized names from database)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(initialCheckedItems)
  )
  const [selectedMealTypes, setSelectedMealTypes] = useState<Set<MealType>>(
    new Set(FILTERABLE_MEAL_TYPES.map(m => m.type))
  )
  const [staples, setStaples] = useState<MealPlanStapleWithDetails[]>(initialStaples)
  const [customItems, setCustomItems] = useState<MealPlanCustomItem[]>(initialCustomItems)

  // Compute available staples based on current staples in list
  const availableStaples = useMemo(() => {
    const stapleIdsInPlan = new Set(staples.map(s => s.staple_id))
    return initialAvailableStaples.filter(s => !stapleIdsInPlan.has(s.id))
  }, [staples, initialAvailableStaples])

  // Onboarding state
  const { state: onboardingState, markMilestone, shouldShowTip, dismissTip } = useOnboardingState()

  // Mark grocery_list_viewed milestone on mount
  useEffect(() => {
    if (onboardingState && !onboardingState.grocery_list_viewed) {
      markMilestone('grocery_list_viewed')
    }
  }, [onboardingState, markMilestone])

  // Determine which meal types are present in the grocery list
  const availableMealTypes = useMemo(() => {
    const types = new Set<MealType>()
    for (const item of groceryList.items) {
      for (const meal of item.meals) {
        types.add(meal.meal_type)
      }
    }
    return FILTERABLE_MEAL_TYPES.filter(m => types.has(m.type))
  }, [groceryList.items])

  // Filter items based on selected meal types
  const filteredItems = useMemo(() => {
    const allSelected = selectedMealTypes.size === availableMealTypes.length

    // If all meal types selected, return original items
    if (allSelected) {
      return groceryList.items
    }

    // Filter each item's meals and recalculate
    return groceryList.items
      .map(item => {
        const filteredMeals = item.meals.filter(meal => selectedMealTypes.has(meal.meal_type))
        if (filteredMeals.length === 0) return null

        return {
          ...item,
          meals: filteredMeals,
        }
      })
      .filter((item): item is GroceryItemWithContext => item !== null)
  }, [groceryList.items, selectedMealTypes, availableMealTypes.length])

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const category = item.category || 'other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {} as Record<GroceryCategory, GroceryItemWithContext[]>)
  }, [filteredItems])

  // Sort categories
  const sortedCategories = CATEGORY_ORDER.filter(cat => groupedItems[cat])

  // Toggle item check and persist to database
  const toggleItem = useCallback(async (itemName: string) => {
    const normalizedName = itemName.toLowerCase().trim()
    const newChecked = !checkedItems.has(normalizedName)

    // Optimistic update
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (newChecked) {
        next.add(normalizedName)
      } else {
        next.delete(normalizedName)
      }
      return next
    })

    // Persist to database
    try {
      const response = await fetch(`/api/meal-plans/${mealPlanId}/grocery-checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: normalizedName, isChecked: newChecked }),
      })

      if (!response.ok) {
        // Revert on failure
        setCheckedItems(prev => {
          const next = new Set(prev)
          if (newChecked) {
            next.delete(normalizedName)
          } else {
            next.add(normalizedName)
          }
          return next
        })
      }
    } catch (error) {
      console.error('Error persisting check:', error)
      // Revert on failure
      setCheckedItems(prev => {
        const next = new Set(prev)
        if (newChecked) {
          next.delete(normalizedName)
        } else {
          next.add(normalizedName)
        }
        return next
      })
    }
  }, [checkedItems, mealPlanId])

  const toggleMealType = (mealType: MealType) => {
    setSelectedMealTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mealType)) {
        // Don't allow deselecting all meal types
        if (newSet.size > 1) {
          newSet.delete(mealType)
        }
      } else {
        newSet.add(mealType)
      }
      return newSet
    })
  }

  const selectAllMealTypes = () => {
    setSelectedMealTypes(new Set(availableMealTypes.map(m => m.type)))
  }

  // Clear all checked items and persist to database
  const clearAllChecks = useCallback(async () => {
    const previousChecked = checkedItems

    // Optimistic update
    setCheckedItems(new Set())

    // Persist each unchecked item to database
    try {
      const promises = Array.from(previousChecked).map(normalizedName =>
        fetch(`/api/meal-plans/${mealPlanId}/grocery-checks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemName: normalizedName, isChecked: false }),
        })
      )
      await Promise.all(promises)
    } catch (error) {
      console.error('Error clearing checks:', error)
      // Revert on failure
      setCheckedItems(previousChecked)
    }
  }, [checkedItems, mealPlanId])

  const totalItems = filteredItems.length
  const checkedCount = Array.from(checkedItems).filter(normalizedName =>
    filteredItems.some(item => item.name.toLowerCase().trim() === normalizedName)
  ).length

  const isFiltered = selectedMealTypes.size < availableMealTypes.length

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

        {/* Meal Type Filter */}
        {availableMealTypes.length > 1 && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Shop for</h3>
              {isFiltered && (
                <button
                  onClick={selectAllMealTypes}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Select all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableMealTypes.map(({ type, label }) => {
                const isSelected = selectedMealTypes.has(type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleMealType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                        : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {isFiltered && (
              <p className="mt-3 text-xs text-gray-500">
                Showing ingredients only for selected meal types. Totals are adjusted accordingly.
              </p>
            )}
          </div>
        )}

        {/* Scaling Notice - always shown */}
        {groceryList.householdInfo?.hasHousehold ? (
          <HouseholdBanner householdInfo={groceryList.householdInfo} />
        ) : (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Amounts shown are for 1 adult.</span>{' '}
                Multiply as needed if cooking for more people.
              </p>
            </div>
          </div>
        )}

        {/* Core Ingredients Summary */}
        {coreIngredients && (
          <div className="mb-6">
            <CoreIngredientsCard coreIngredients={coreIngredients} />
          </div>
        )}

        {/* My Staples Section */}
        <GroceryStaplesSection
          mealPlanId={mealPlanId}
          staples={staples}
          availableStaples={availableStaples}
          onStaplesChange={setStaples}
          customItems={customItems}
          onCustomItemsChange={setCustomItems}
        />

        {/* Onboarding tip for checklist feature */}
        {shouldShowTip('grocery_list_checklist') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">*</span>
                <p className="text-blue-800">
                  <strong>Pro tip:</strong> Check off items as you shop! Expand any item to see which meals use it.
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
          {sortedCategories.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500">No ingredients needed for the selected meal types.</p>
            </div>
          ) : (
            sortedCategories.map(category => (
              <div key={category} className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {CATEGORY_LABELS[category]}
                </h2>
                <div className="space-y-2">
                  {groupedItems[category].map((item) => (
                    <GroceryItemCard
                      key={item.name}
                      item={item}
                      isChecked={checkedItems.has(item.name.toLowerCase().trim())}
                      onToggle={() => toggleItem(item.name)}
                      householdInfo={groceryList.householdInfo}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
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
            onClick={clearAllChecks}
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
