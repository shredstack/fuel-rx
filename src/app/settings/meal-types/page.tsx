import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MealTypesSettingsClient from './MealTypesSettingsClient'
import { DEFAULT_SELECTED_MEAL_TYPES, DEFAULT_MEAL_CONSISTENCY_PREFS } from '@/lib/types'

export default async function MealTypesSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('selected_meal_types, snack_count, meals_per_day, include_workout_meals, meal_consistency_prefs')
    .eq('id', user.id)
    .single()

  // Handle migration: if selected_meal_types is null, derive from legacy fields
  let selectedMealTypes = profile?.selected_meal_types
  let snackCount = profile?.snack_count ?? 0

  if (!selectedMealTypes || selectedMealTypes.length === 0) {
    // Derive from legacy fields
    selectedMealTypes = [...DEFAULT_SELECTED_MEAL_TYPES]
    if (profile?.include_workout_meals) {
      selectedMealTypes = ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner']
    }
    // Derive snack count from meals_per_day
    const mealsPerDay = profile?.meals_per_day ?? 3
    snackCount = Math.max(0, mealsPerDay - 3)
  }

  // Use saved consistency prefs or default
  const mealConsistencyPrefs = profile?.meal_consistency_prefs ?? DEFAULT_MEAL_CONSISTENCY_PREFS

  return (
    <MealTypesSettingsClient
      initialSettings={{
        selected_meal_types: selectedMealTypes,
        snack_count: snackCount,
        meal_consistency_prefs: mealConsistencyPrefs,
      }}
    />
  )
}
