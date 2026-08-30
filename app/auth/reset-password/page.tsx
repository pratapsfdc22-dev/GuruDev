'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'

export default function ResetPasswordPage(): React.ReactElement {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const verifyToken = async (): Promise<void> => {
      try {
        // Supabase automatically handles the token from URL hash, but we need to wait for it
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // If there's a session, the token was valid and exchanged
        if (session?.user) {
          setValidToken(true)
        } else {
          // Check if we're coming from a reset link (Supabase will set this up on auth state change)
          const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' && session) {
              setValidToken(true)
            } else if (!session && !validToken) {
              setError('Invalid or expired reset link. Please request a new one.')
            }
          })

          return () => {
            data?.subscription?.unsubscribe()
          }
        }
      } catch (err) {
        setError('Failed to verify reset link')
        console.error(err)
      }
    }

    verifyToken()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/chat')
      }, 2000)
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!validToken && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 px-4">
        <div className="w-full max-w-md">
          <p className="text-center text-slate-400">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="default" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-50">Set New Password</h1>
          <p className="text-slate-400">
            Enter a new password for your account
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-900/40 border border-green-600/50 p-4 text-sm text-green-200 backdrop-blur-sm">
              ✓ Password reset successfully! Redirecting to chat...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-900/40 border border-red-600/50 p-3 text-sm text-red-200 backdrop-blur-sm">
                {error}
              </div>
            )}

            {validToken && !error && (
              <>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-lg font-semibold hover:from-yellow-700 hover:to-yellow-800 disabled:opacity-50 transition shadow-lg hover:shadow-yellow-600/50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </>
            )}
          </form>
        )}

        <p className="text-center text-sm text-slate-400">
          <Link href="/auth/signin" className="text-yellow-400 hover:text-yellow-300 transition">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
