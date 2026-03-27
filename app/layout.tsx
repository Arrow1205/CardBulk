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
  userScalable: false, // Bloque le zoom intempestif sur mobile
  viewportFit: 'cover', // Ça force l'app à passer sous la barre d'état
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
    {/* 🚨 SOLUTION ICI : Ajout de suppressHydrationWarning sur html et body 🚨 */}
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen relative`} suppressHydrationWarning>
        
        {/* LE CONTENU DE TES PAGES */}
        <div className="relative z-10">
          {children}
        </div>
        
        {/* LA TAB BAR */}
        <TabBar />
        
      </body>
    </html>
  )
}