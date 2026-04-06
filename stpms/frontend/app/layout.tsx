import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/ui/ToastProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'STPMS - AI Powered Task Management',
  description: 'Smart Task & Project Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ToastProvider>
            <div className="flex h-screen bg-gray-50">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-8">
                {children}
              </main>
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
