'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/Header'
import { LogoWithText } from '@/components/LogoWithText'

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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-12 text-center">
          {/* Logo - Centered on home page */}
          <div className="flex justify-center mb-8 scale-150">
            <LogoWithText href={false} size="default" />
          </div>

        {/* Tagline */}
        <div className="space-y-2">
          <p className="text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
            Chat with Guru Dev — spiritual guidance grounded in Vedic scriptures
          </p>
        </div>

        {/* Disclaimer */}
        <div className="bg-slate-800/50 border border-yellow-600/30 rounded-lg p-6 backdrop-blur-sm">
          <p className="text-sm text-slate-200">
            ℹ️ Spiritual guidance, not medical or mental health care
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-6 justify-center flex-wrap pt-8">
          <Link
            href="/auth/signup"
            className="px-10 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-lg font-semibold hover:from-yellow-700 hover:to-yellow-800 transition shadow-xl hover:shadow-yellow-600/50"
          >
            Create Account
          </Link>
          <Link
            href="/auth/signin"
            className="px-10 py-4 border-2 border-yellow-600 text-slate-50 rounded-lg font-semibold hover:bg-yellow-600/20 transition backdrop-blur-sm hover:border-yellow-500"
          >
            Sign In
          </Link>
        </div>
      </div>
      </main>
    </div>
  )
}
