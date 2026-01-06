import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MealPlanClient from './MealPlanClient'
import { getMealPlanNormalized, computeGroceryListFromPlan } from '@/lib/meal-plan-service'

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
    .select('user_id')
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

  return (
    <MealPlanClient
      mealPlan={{
        ...mealPlan,
        grocery_list: groceryList,
      }}
    />
  )
}
