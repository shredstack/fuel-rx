import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MealPlanClient from './MealPlanClient'
import { getMealPlanNormalized, computeGroceryListFromPlan } from '@/lib/meal-plan-service'
import type { PrepSession, HouseholdServingsPrefs, DailyAssembly } from '@/lib/types'
import { DEFAULT_HOUSEHOLD_SERVINGS_PREFS } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MealPlanPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Verify the meal plan belongs to this user
  const { data: mealPlanCheck, error: checkError } = await supabase
    .from('meal_plans')
    .select('user_id, prep_style')
    .eq('id', id)
    .single()

  if (checkError || !mealPlanCheck) {
    notFound()
  }

  if (mealPlanCheck.user_id !== user.id) {
    notFound()
  }

  // Fetch the normalized meal plan with all meals expanded
  const mealPlan = await getMealPlanNormalized(id)

  if (!mealPlan) {
    notFound()
  }

  // Compute the grocery list
  const groceryList = await computeGroceryListFromPlan(id)

  // Fetch prep sessions for detailed cooking info (equipment, temps, tips)
  const { data: prepSessions } = await supabase
    .from('prep_sessions')
    .select('*')
    .eq('meal_plan_id', id)
    .order('display_order', { ascending: true })

  // Fetch user profile for household servings
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('household_servings')
    .eq('id', user.id)
    .single()

  const householdServings: HouseholdServingsPrefs =
    (profile?.household_servings as HouseholdServingsPrefs) || DEFAULT_HOUSEHOLD_SERVINGS_PREFS

  // Extract daily_assembly from prep sessions (for batch prep users)
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
    <MealPlanClient
      mealPlan={{
        ...mealPlan,
        grocery_list: groceryList,
      }}
      prepSessions={(prepSessions || []) as PrepSession[]}
      householdServings={householdServings}
      prepStyle={mealPlanCheck.prep_style || 'day_of'}
      dailyAssembly={dailyAssembly}
    />
  )
}
