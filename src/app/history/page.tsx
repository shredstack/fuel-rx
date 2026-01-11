import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: mealPlans } = await supabase
    .from('meal_plans')
    .select('id, week_start_date, title, is_favorite, created_at, theme_id, shared_from_user_id, shared_from_user_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch themes for all meal plans that have one
  const themeIds = [...new Set((mealPlans || []).filter(p => p.theme_id).map(p => p.theme_id))]
  let themesMap: Record<string, { display_name: string; emoji: string | null }> = {}

  if (themeIds.length > 0) {
    const { data: themes } = await supabase
      .from('meal_plan_themes')
      .select('id, display_name, emoji')
      .in('id', themeIds)

    if (themes) {
      themesMap = Object.fromEntries(themes.map(t => [t.id, { display_name: t.display_name, emoji: t.emoji }]))
    }
  }

  // Add theme info to meal plans
  const mealPlansWithThemes = (mealPlans || []).map(plan => ({
    ...plan,
    theme: plan.theme_id ? themesMap[plan.theme_id] : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
            Coach Hill&apos;s FuelRx
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/log-meal" className="text-gray-600 hover:text-gray-900">
              Log
            </Link>
            <Link href="/custom-meals" className="text-gray-600 hover:text-gray-900">
              My Meals
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          My Meal Plans
        </h1>

        <HistoryClient mealPlans={mealPlansWithThemes} />
      </main>
    </div>
  )
}
