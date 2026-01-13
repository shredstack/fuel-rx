import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-service'
import AdminIngredientsClient from './AdminIngredientsClient'

export default async function AdminIngredientsPage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check admin status
  const adminStatus = await isAdmin(supabase, user.id)

  if (!adminStatus) {
    redirect('/dashboard')
  }

  // Fetch initial data (first page of ingredients)
  const { data: initialIngredients, count } = await supabase
    .from('ingredients')
    .select('*', { count: 'exact' })
    .order('name')
    .range(0, 19)

  return (
    <AdminIngredientsClient
      initialIngredients={initialIngredients || []}
      initialTotal={count || 0}
    />
  )
}
