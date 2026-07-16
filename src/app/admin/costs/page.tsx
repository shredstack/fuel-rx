import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-service'
import AdminCostsClient from './AdminCostsClient'

export default async function AdminCostsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminStatus = await isAdmin(supabase, user.id)
  if (!adminStatus) {
    redirect('/dashboard')
  }

  return <AdminCostsClient />
}
