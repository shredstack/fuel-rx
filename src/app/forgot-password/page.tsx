'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { KeyboardAwareView } from '@/components/KeyboardAwareView'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href="/">
              <Logo size="xl" />
            </Link>
          </div>

          <div className="card text-center">
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">
              <h2 className="text-xl font-bold mb-2">Check your email!</h2>
              <p className="text-sm">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
                <strong> If not in your inbox, check your spam!</strong>
              </p>
            </div>

            <Link href="/login" className="btn-primary w-full inline-block text-center">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <KeyboardAwareView className="min-h-screen flex flex-col bg-gray-50 overflow-auto">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href="/">
              <Logo size="xl" />
            </Link>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Reset your password
            </h2>
            <p className="mt-2 text-gray-600">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Remember your password?{' '}
                <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </KeyboardAwareView>
  )
}
