import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileSettingsClient from './ProfileSettingsClient'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, weight, profile_photo_url')
    .eq('id', user.id)
    .single()

  return (
    <ProfileSettingsClient
      initialSettings={{
        name: profile?.name ?? '',
        weight: profile?.weight ?? null,
        profile_photo_url: profile?.profile_photo_url ?? null,
      }}
    />
  )
}
