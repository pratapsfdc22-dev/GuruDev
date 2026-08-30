import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Guru Dev',
  description: 'Virtual guru chat interface with guidance grounded in Vedic scriptures',
  icons: {
    icon: '/images/V4-halo-gurudev-icon-64.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
