'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { KeyboardAwareView } from '@/components/KeyboardAwareView'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href="/">
              <Logo size="xl" />
            </Link>
          </div>

          <div className="card text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              <h2 className="text-xl font-bold mb-2">Invalid Reset Link</h2>
              <p className="text-sm">
                This password reset link is invalid. Please request a new one.
              </p>
            </div>

            <Link href="/forgot-password" className="btn-primary w-full inline-block text-center">
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    )
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
              <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
              <p className="text-sm">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
            </div>

            <Link href="/login" className="btn-primary w-full inline-block text-center">
              Sign In
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
              Set new password
            </h2>
            <p className="mt-2 text-gray-600">
              Enter your new password below
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </KeyboardAwareView>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
