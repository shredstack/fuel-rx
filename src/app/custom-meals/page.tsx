import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CustomMealsClient from './CustomMealsClient'

export default async function CustomMealsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's custom meals from meals table
  // Include user_created, quick_cook, and party_meal source types
  const { data: mealsData } = await supabase
    .from('meals')
    .select('*')
    .eq('source_user_id', user.id)
    .in('source_type', ['user_created', 'quick_cook', 'party_meal'])
    .order('created_at', { ascending: false })

  // Transform to the format expected by CustomMealsClient
  const customMeals = (mealsData || []).map(meal => ({
    id: meal.id,
    meal_name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    ingredients: meal.ingredients,
    is_user_created: meal.is_user_created,
    image_url: meal.image_url,
    share_with_community: meal.is_public,
    prep_time: meal.prep_time_minutes,
    meal_prep_instructions: meal.prep_instructions,
    created_at: meal.created_at,
  }))

  return <CustomMealsClient initialMeals={customMeals} />
}
