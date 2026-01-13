import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WorkoutMealsSettingsClient from './WorkoutMealsSettingsClient'

export default async function WorkoutMealsSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('include_workout_meals, workout_time, pre_workout_preference')
    .eq('id', user.id)
    .single()

  return (
    <WorkoutMealsSettingsClient
      initialSettings={{
        include_workout_meals: profile?.include_workout_meals ?? false,
        workout_time: profile?.workout_time ?? 'morning',
        pre_workout_preference: profile?.pre_workout_preference ?? 'light',
      }}
    />
  )
}
