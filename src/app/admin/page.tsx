import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-service'
import Navbar from '@/components/Navbar'

const ADMIN_SECTIONS = [
  {
    href: '/admin/ingredients',
    title: 'Manage Ingredients',
    description:
      'Search, edit, validate, and categorize ingredients. Run USDA matching and backfills.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    href: '/admin/costs',
    title: 'Cost Management',
    description:
      'Monitor AI spend: estimated cost per feature, daily trend, and highest-cost users from the LLM logs.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
]

export default async function AdminHubPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="mt-1 text-gray-600">Choose an area to manage.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <div className="text-purple-600 group-hover:text-purple-700">{section.icon}</div>
              <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-purple-700">
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{section.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
