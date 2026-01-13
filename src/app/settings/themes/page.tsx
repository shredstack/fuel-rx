import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ThemePreferencesEditor from '@/components/ThemePreferencesEditor'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

export default async function ThemePreferencesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/settings" className="text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-primary-600">Meal Plan Themes</h1>
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Theme Preferences</h2>
          <p className="text-gray-600">
            Mark themes you love as &quot;preferred&quot; to see them more often, or block themes you&apos;d rather avoid.
            Each week, we&apos;ll automatically select a theme based on your preferences and the season.
          </p>
        </div>

        <div className="card">
          <ThemePreferencesEditor />
        </div>
      </main>

      <MobileTabBar />
    </div>
  )
}
