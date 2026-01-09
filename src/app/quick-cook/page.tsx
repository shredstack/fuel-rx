import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuickCookClient from './QuickCookClient'

export default async function QuickCookPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  return <QuickCookClient profile={profile} />
}
