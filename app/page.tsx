'use client'

export default function Home(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold mb-4">Guru Dev</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Virtual guru chat interface with guidance grounded in Vedic scriptures
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            ℹ️ Spiritual guidance, not medical or mental health care
          </p>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Placeholder chat interface — Phase 1 scaffold complete
        </p>
      </div>
    </main>
  )
}
