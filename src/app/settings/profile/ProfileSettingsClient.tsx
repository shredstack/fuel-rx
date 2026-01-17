'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BasicInfoEditor from '@/components/BasicInfoEditor'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  initialSettings: {
    name: string
    weight: number | null
    profile_photo_url: string | null
  }
}

export default function ProfileSettingsClient({ initialSettings }: Props) {
  const supabase = createClient()
  const [values, setValues] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          name: values.name || null,
          weight: values.weight,
          profile_photo_url: values.profile_photo_url,
        })
        .eq('id', user.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/profile" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Profile</span>
          </Link>
          <h1 className="text-2xl font-bold text-primary-600">Profile Settings</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">
              Dismiss
            </button>
          </div>
        )}

        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <p className="text-gray-600 mb-4">
            Update your profile information. This helps personalize your meal plans.
          </p>

          <BasicInfoEditor values={values} onChange={setValues} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-6"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mt-4">
              Profile updated successfully!
            </div>
          )}
        </div>
      </main>

      <MobileTabBar />
    </div>
  )
}
