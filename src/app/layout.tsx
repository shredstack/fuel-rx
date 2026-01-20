import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/providers/QueryProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Coach Hill's FuelRx - AI Meal Planning for CrossFit Draper Athletes",
  description: 'AI-powered meal planning optimized for your macros, training schedule, and dietary preferences.',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  )
}
