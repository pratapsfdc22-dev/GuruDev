'use client'

import Link from 'next/link'

export default function CheckEmailPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold">Check Your Email</h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            We've sent a confirmation link to your email address. Please click the link
            to verify your account and complete the sign-up process.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-left">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            ℹ️ Don't see the email? Check your spam folder or{' '}
            <Link href="/auth/signup" className="underline font-medium">
              try signing up again
            </Link>
            .
          </p>
        </div>

        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already verified?{' '}
            <Link href="/auth/signin" className="text-blue-600 hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
