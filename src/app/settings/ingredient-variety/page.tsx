import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import IngredientVarietyClient from './IngredientVarietyClient'
import { DEFAULT_INGREDIENT_VARIETY_PREFS } from '@/lib/types'

export default async function IngredientVarietyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('ingredient_variety_prefs')
    .eq('id', user.id)
    .single()

  return (
    <IngredientVarietyClient
      initialSettings={profile?.ingredient_variety_prefs ?? DEFAULT_INGREDIENT_VARIETY_PREFS}
    />
  )
}
