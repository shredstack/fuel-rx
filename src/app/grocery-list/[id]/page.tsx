import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeCoreIngredients } from '@/lib/types'
import type { MealPlanStapleWithDetails, GroceryStaple, MealPlanCustomItem } from '@/lib/types'
import { getContextualGroceryListWithHousehold } from '@/lib/meal-plan-service'
import GroceryListClient from './GroceryListClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroceryListPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: mealPlan, error } = await supabase
    .from('meal_plans')
    .select('id, week_start_date, core_ingredients')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !mealPlan) {
    notFound()
  }

  // Compute contextual grocery list with household info
  const groceryList = await getContextualGroceryListWithHousehold(id, user.id)

  // Fetch staples for this meal plan
  const { data: planStaples } = await supabase
    .from('meal_plan_staples')
    .select(`
      id,
      meal_plan_id,
      staple_id,
      is_checked,
      created_at,
      staple:user_grocery_staples(*)
    `)
    .eq('meal_plan_id', id)
    .order('created_at', { ascending: true })

  // Get available staples not in this plan
  const stapleIdsInPlan = planStaples?.map(ps => ps.staple_id) || []

  let availableQuery = supabase
    .from('user_grocery_staples')
    .select('*')
    .eq('user_id', user.id)
    .order('times_added', { ascending: false })

  if (stapleIdsInPlan.length > 0) {
    availableQuery = availableQuery.not('id', 'in', `(${stapleIdsInPlan.join(',')})`)
  }

  const { data: availableStaples } = await availableQuery

  // Transform the nested staple array to a single object (Supabase returns array for single relations)
  const transformedStaples: MealPlanStapleWithDetails[] = (planStaples || []).map(ps => ({
    id: ps.id,
    meal_plan_id: ps.meal_plan_id,
    staple_id: ps.staple_id,
    is_checked: ps.is_checked,
    created_at: ps.created_at,
    staple: Array.isArray(ps.staple) ? ps.staple[0] : ps.staple,
  })).filter(ps => ps.staple) // Filter out any staples that might have been deleted

  // Fetch custom one-off items for this meal plan
  const { data: customItems } = await supabase
    .from('meal_plan_custom_items')
    .select('*')
    .eq('meal_plan_id', id)
    .order('created_at', { ascending: true })

  return (
    <GroceryListClient
      mealPlanId={mealPlan.id}
      weekStartDate={mealPlan.week_start_date}
      groceryList={groceryList}
      coreIngredients={normalizeCoreIngredients(mealPlan.core_ingredients)}
      initialStaples={transformedStaples}
      availableStaples={(availableStaples || []) as GroceryStaple[]}
      initialCustomItems={(customItems || []) as MealPlanCustomItem[]}
    />
  )
}
