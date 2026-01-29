import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrepViewClient from './PrepViewClient'
import type { PrepSession, DailyAssembly, DayPlanNormalized, MealSlot, MealEntity, DayOfWeek, MealType, HouseholdServingsPrefs, PrepModeResponse, BatchPrepStatus } from '@/lib/types'
import { DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'

const DAYS_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']

export default async function PrepViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch meal plan with new prep session columns
  const { data: mealPlan, error: planError } = await supabase
    .from('meal_plans')
    .select('id, user_id, week_start_date, title, theme_id, core_ingredients, is_favorite, created_at, prep_style, prep_sessions_day_of, prep_sessions_batch, batch_prep_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (planError || !mealPlan) {
    redirect('/dashboard')
  }

  // Fetch meal_plan_meals with their linked meals (normalized structure)
  const { data: mealPlanMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      meal_plan_id,
      meal_id,
      day,
      meal_type,
      snack_number,
      position,
      is_original,
      swapped_from_meal_id,
      swapped_at,
      created_at,
      updated_at,
      meals!meal_plan_meals_meal_id_fkey (
        id,
        name,
        name_normalized,
        meal_type,
        ingredients,
        instructions,
        calories,
        protein,
        carbs,
        fat,
        prep_time_minutes,
        prep_instructions,
        is_user_created,
        is_nutrition_edited_by_user,
        source_type,
        source_user_id,
        source_meal_plan_id,
        is_public,
        theme_id,
        theme_name,
        times_used,
        times_swapped_in,
        times_swapped_out,
        image_url,
        created_at,
        updated_at
      )
    `)
    .eq('meal_plan_id', id)
    .order('day')
    .order('meal_type')
    .order('position')

  if (mealsError) {
    console.error('Error fetching meal plan meals:', mealsError)
    redirect('/dashboard')
  }

  // Organize meals into days (same logic as getMealPlanNormalized)
  const daysMap = new Map<DayOfWeek, MealSlot[]>()

  for (const mpm of mealPlanMeals || []) {
    const day = mpm.day as DayOfWeek
    if (!daysMap.has(day)) {
      daysMap.set(day, [])
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mealData = mpm.meals as any
    if (!mealData) continue

    const slot: MealSlot = {
      id: mpm.id,
      meal: {
        ...mealData,
        meal_type: mealData.meal_type as MealType,
      } as MealEntity,
      meal_type: mpm.meal_type as MealType,
      snack_number: mpm.snack_number ?? undefined,
      position: mpm.position,
      is_original: mpm.is_original,
      swapped_at: mpm.swapped_at ?? undefined,
    }

    daysMap.get(day)!.push(slot)
  }

  // Create days array in order
  const days: DayPlanNormalized[] = DAYS_ORDER.map((day) => {
    const meals = daysMap.get(day) || []

    // Sort meals by meal type order, then by position
    meals.sort((a, b) => {
      const typeOrderA = MEAL_TYPE_ORDER.indexOf(a.meal_type)
      const typeOrderB = MEAL_TYPE_ORDER.indexOf(b.meal_type)
      if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB
      return a.position - b.position
    })

    // Calculate daily totals
    const daily_totals = meals.reduce(
      (acc, slot) => ({
        calories: acc.calories + slot.meal.calories,
        protein: acc.protein + slot.meal.protein,
        carbs: acc.carbs + slot.meal.carbs,
        fat: acc.fat + slot.meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    return {
      day,
      meals,
      daily_totals,
    }
  })

  // Fetch prep sessions
  const { data: prepSessions } = await supabase
    .from('prep_sessions')
    .select('*')
    .eq('meal_plan_id', id)
    .order('display_order', { ascending: true })

  // Fetch user profile for household servings (prep_style now comes from meal plan)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('household_servings')
    .eq('id', user.id)
    .single()

  const householdServings: HouseholdServingsPrefs = (profile?.household_servings as HouseholdServingsPrefs) || DEFAULT_HOUSEHOLD_SERVINGS_PREFS

  // Extract daily_assembly from prep sessions (it's stored in the first session with data)
  let dailyAssembly: DailyAssembly | undefined
  if (prepSessions && prepSessions.length > 0) {
    for (const session of prepSessions) {
      if (session.daily_assembly && Object.keys(session.daily_assembly).length > 0) {
        dailyAssembly = session.daily_assembly as DailyAssembly
        break
      }
    }
  }

  return (
    <PrepViewClient
      mealPlan={{
        id: mealPlan.id,
        week_start_date: mealPlan.week_start_date,
      }}
      days={days}
      prepSessions={(prepSessions || []) as PrepSession[]}
      prepStyle={mealPlan.prep_style || 'day_of'}
      dailyAssembly={dailyAssembly}
      householdServings={householdServings}
      // New batch prep data from meal_plans table
      prepSessionsDayOf={mealPlan.prep_sessions_day_of as PrepModeResponse | null}
      prepSessionsBatch={mealPlan.prep_sessions_batch as PrepModeResponse | null}
      batchPrepStatus={(mealPlan.batch_prep_status || 'pending') as BatchPrepStatus}
    />
  )
}
