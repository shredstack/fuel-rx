import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Fetch ingredient preferences with details
  const { data: ingredientPrefs } = await supabase
    .from('ingredient_preferences_with_details')
    .select('*')
    .eq('user_id', user.id)

  // Fetch meal preferences
  const { data: mealPrefs } = await supabase
    .from('meal_preferences')
    .select('*')
    .eq('user_id', user.id)

  // Get meal plan count for fun stats
  const { count: mealPlanCount } = await supabase
    .from('meal_plans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <ProfileClient
      profile={profile}
      ingredientPrefs={ingredientPrefs || []}
      mealPrefs={mealPrefs || []}
      mealPlanCount={mealPlanCount || 0}
    />
  )
}
