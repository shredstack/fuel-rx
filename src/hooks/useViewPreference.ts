'use client'

import { useState, useEffect } from 'react'
import type { MealPlanViewType } from '@/components/meal-plan/ViewToggle'

const STORAGE_KEY = 'fuelrx-mealplan-view'

export function useViewPreference(): [MealPlanViewType, (view: MealPlanViewType) => void] {
  const [view, setView] = useState<MealPlanViewType>('daily')

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'daily' || saved === 'meal-type') {
        setView(saved)
      }
    }
  }, [])

  // Save to localStorage when view changes
  const setViewWithPersistence = (newView: MealPlanViewType) => {
    setView(newView)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newView)
    }
  }

  return [view, setViewWithPersistence]
}
