'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home(): React.ReactElement {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          router.push('/chat')
        }
      } catch (error) {
        console.error('Auth check error:', error)
      }
    }

    checkAuth()
  }, [supabase, router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-4">Guru Dev</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Virtual guru chat interface with guidance grounded in Vedic scriptures
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ Spiritual guidance, not medical or mental health care
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Create Account
          </Link>
          <Link
            href="/auth/signin"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Sign In
          </Link>
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
          Phase 1: Supabase Auth integration complete
        </p>
      </div>
    </main>
  )
}
