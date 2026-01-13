'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/log-meal', label: 'Log' },
  { href: '/community', label: 'Community' },
  { href: '/custom-meals', label: 'My Meals' },
  { href: '/history', label: 'My Plans' },
  { href: '/profile', label: 'Profile' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      setIsAdmin(data?.is_admin === true)
    }
    checkAdminStatus()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard">
          <Logo size="lg" />
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-gray-600 hover:text-gray-900 ${
                isActive(item.href) ? 'font-medium text-gray-900' : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin/ingredients"
              className={`text-purple-600 hover:text-purple-800 ${
                pathname.startsWith('/admin') ? 'font-medium' : ''
              }`}
            >
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900"
          >
            Log out
          </button>
        </nav>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-2 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive(item.href)
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/ingredients"
                className={`block px-3 py-2 rounded-md text-base ${
                  pathname.startsWith('/admin')
                    ? 'bg-purple-50 text-purple-700 font-medium'
                    : 'text-purple-600 hover:bg-purple-50 hover:text-purple-800'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                handleLogout()
              }}
              className="block w-full text-left px-3 py-2 rounded-md text-base text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
