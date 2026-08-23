'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatInterface } from '@/components/ChatInterface'

export default function ChatPage(): React.ReactElement {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async (): Promise<void> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/signin')
          return
        }

        setUser(user)
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
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Guru Dev</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Spiritual guidance from Vedic scriptures
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Authenticated</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-6xl w-full mx-auto h-full flex flex-col flex-1">
          <ChatInterface />
        </div>
      </main>

      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex-shrink-0 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          ℹ️ Spiritual guidance, not medical or mental health care
        </p>
      </footer>
    </div>
  )
}
