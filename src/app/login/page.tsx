'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import { KeyboardAwareView } from '@/components/KeyboardAwareView'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showEmailNotConfirmed, setShowEmailNotConfirmed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam)
    }

    const verified = searchParams.get('verified')
    if (verified === 'true') {
      setSuccess('Your email has been verified! You can now sign in.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setShowEmailNotConfirmed(false)
    setResendSuccess(false)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Check if this is an email not confirmed error
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setShowEmailNotConfirmed(true)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // Verify we actually have a session before redirecting
    if (!data.session) {
      setError('Sign in succeeded but no session was created. Please try again.')
      setLoading(false)
      return
    }

    // Use window.location for a full page reload to ensure cookies are properly sent
    window.location.href = '/dashboard'
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }
    setResending(true)
    setResendSuccess(false)

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setResendSuccess(true)
      }
    } catch {
      // Silently fail
    } finally {
      setResending(false)
    }
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
              Welcome back
            </h2>
            <p className="mt-2 text-gray-600">
              Sign in to access your meal plans
            </p>
          </div>

          <div className="card">
            <form onSubmit={handleLogin} className="space-y-6">
              {success && (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
                  {success}
                </div>
              )}
              {resendSuccess && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                  A new verification email has been sent! Check your inbox (and spam folder).
                </div>
              )}
              {showEmailNotConfirmed && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm">
                  <p className="font-medium mb-1">Email not verified</p>
                  <p className="mb-2">
                    Please check your inbox (and spam folder) for an email from fuelrx@shredstack.net and click the verification link.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-primary-600 hover:text-primary-700 font-medium underline"
                  >
                    {resending ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              )}
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

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </KeyboardAwareView>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
