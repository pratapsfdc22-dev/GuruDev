'use client'

import { LogoWithText } from '@/components/LogoWithText'

interface HeaderProps {
  userEmail?: string
  showSignOut?: boolean
  onSignOut?: () => Promise<void>
}

export function Header({ userEmail, showSignOut = false, onSignOut }: HeaderProps): React.ReactElement {
  const handleSignOut = async (): Promise<void> => {
    if (onSignOut) {
      await onSignOut()
    }
  }

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-4 py-3 flex-shrink-0">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
        {/* Logo + Branding */}
        <div className="hover:opacity-80 transition">
          <LogoWithText href={userEmail ? '/chat' : '/'} size="default" />
        </div>

        {/* Right side: User info + Sign Out */}
        {showSignOut && userEmail && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{userEmail}</p>
              <p className="text-xs text-slate-400">Authenticated</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
