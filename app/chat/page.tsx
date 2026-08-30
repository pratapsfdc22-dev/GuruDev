'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatInterface } from '@/components/ChatInterface'
import { Header } from '@/components/Header'

export default function ChatPage(): React.ReactElement {
  const [user, setUser] = useState<{ email: string | undefined } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async (): Promise<void> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || !user.email) {
          router.push('/auth/signin')
          return
        }

        setUser({ email: user.email })
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/auth/signin')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase, router])

  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <div />
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <Header userEmail={user.email} showSignOut={true} onSignOut={handleSignOut} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-6xl w-full mx-auto h-full flex flex-col flex-1">
          <ChatInterface />
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex-shrink-0 text-center">
        <p className="text-xs text-slate-400">
          ℹ️ Spiritual guidance, not medical or mental health care
        </p>
      </footer>
    </div>
  )
}
