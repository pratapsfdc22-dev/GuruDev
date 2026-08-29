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
    <main
      className="flex min-h-screen flex-col items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(139, 69, 19, 0.85) 0%, rgba(184, 115, 51, 0.85) 100%), url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><pattern id="temple" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse"><rect fill="%238B4513" width="200" height="200"/><path fill="%23B87333" d="M100,20 L120,60 L140,20 Z M80,20 L60,60 L40,20 Z"/><rect fill="%23A0522D" x="80" y="70" width="40" height="80"/></pattern></defs><rect fill="%23654321" width="1200" height="800"/><rect fill="url(%23temple)" width="1200" height="800"/></svg>')`,
      }}
    >
      <div className="max-w-2xl w-full space-y-8 backdrop-blur-sm bg-black/40 p-8 rounded-2xl border border-amber-600/30">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 text-amber-50">Guru Dev</h1>
          <p className="text-xl text-amber-100 mb-8 leading-relaxed">
            Virtual guru chat interface with guidance grounded in Vedic scriptures
          </p>
          <div className="bg-amber-900/40 border border-amber-500/50 rounded-lg p-4 mb-8 backdrop-blur-sm">
            <p className="text-sm text-amber-100">
              ℹ️ Spiritual guidance, not medical or mental health care
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/auth/signup"
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg"
          >
            Create Account
          </Link>
          <Link
            href="/auth/signin"
            className="px-8 py-3 border-2 border-amber-400 text-amber-50 rounded-lg font-semibold hover:bg-amber-500/20 transition backdrop-blur-sm"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  )
}
