'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AccountCard() {
  const supabase = createClient()
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete account')

      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Failed to delete account:', err)
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <span>⚙️</span> Account
      </h2>

      <div className="space-y-3">
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-4 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          Sign Out
        </button>

        <div className="border-t border-gray-200 pt-3">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 px-4 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800 mb-3">
                Are you sure? This will permanently delete all your meal plans,
                preferences, and account data.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-4 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 px-4 text-white bg-red-600 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
