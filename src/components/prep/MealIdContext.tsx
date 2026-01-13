'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface MealIdMapEntry {
  id: string
  name: string
}

type MealIdMap = Record<string, MealIdMapEntry>

const MealIdContext = createContext<MealIdMap>({})

export function MealIdProvider({
  children,
  mealIdMap,
}: {
  children: ReactNode
  mealIdMap: MealIdMap
}) {
  return (
    <MealIdContext.Provider value={mealIdMap}>
      {children}
    </MealIdContext.Provider>
  )
}

/**
 * Get the actual meal UUID from a composite meal ID (e.g., meal_monday_breakfast_0)
 */
export function useMealIdMap() {
  return useContext(MealIdContext)
}

/**
 * Resolve a composite meal ID to the actual meal UUID and name
 */
export function useResolvedMealId(compositeMealId: string | undefined): MealIdMapEntry | null {
  const mealIdMap = useContext(MealIdContext)
  if (!compositeMealId) return null
  return mealIdMap[compositeMealId] || null
}
