'use client'

import { useState, useEffect } from 'react'
import type { MealPlanViewType } from '@/components/meal-plan/ViewToggle'

const STORAGE_KEY = 'fuelrx-mealplan-view'

interface UseViewPreferenceOptions {
  urlOverride?: MealPlanViewType | null
}

export function useViewPreference(options?: UseViewPreferenceOptions): [MealPlanViewType, (view: MealPlanViewType) => void] {
  // Use URL override if provided, otherwise default to 'daily'
  const initialView = options?.urlOverride || 'daily'
  const [view, setView] = useState<MealPlanViewType>(initialView)

  // Load from localStorage on mount (unless URL override is present)
  useEffect(() => {
    if (options?.urlOverride) {
      // URL override takes precedence - don't load from localStorage
      setView(options.urlOverride)
      return
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'daily' || saved === 'meal-type') {
        setView(saved)
      }
    }
  }, [options?.urlOverride])

  // Save to localStorage when view changes
  const setViewWithPersistence = (newView: MealPlanViewType) => {
    setView(newView)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newView)
    }
  }

  return [view, setViewWithPersistence]
}
