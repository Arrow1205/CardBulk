import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import TabBar from '@/components/TabBar' 

const inter = Inter({ subsets: ['latin'] })

// Un seul bloc viewport qui combine tout (encoche, zoom, couleurs)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#040221',
};

// Active le mode "Application Native"
export const metadata: Metadata = {
  title: 'CardBulk',
  description: 'Application de scan de cartes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CardBulk',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen relative`} suppressHydrationWarning>
        
        <div className="relative z-10">
          {children}
        </div>
        
        <TabBar />
        
      </body>
    </html>
  )
}