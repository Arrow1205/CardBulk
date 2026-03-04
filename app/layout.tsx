import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import TabBar from '@/components/TabBar' 

const inter = Inter({ subsets: ['latin'] })

// 🚀 NOUVEAU : Bloque le zoom sur mobile et définit la couleur du navigateur
export const viewport: Viewport = {
  themeColor: '#040221',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// 🚀 NOUVEAU : Active le mode "Application Native" (Plein écran sans URL)
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
    <html lang="fr">
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen relative`}>
        
        {/* LE DÉGRADÉ FIXÉ EN HAUT (z-0 pour qu'il reste en arrière-plan) */}
        <div 
          className="fixed top-0 left-0 w-full h-[85px] pointer-events-none z-0" 
          style={{ background: 'linear-gradient(0deg, rgba(217, 217, 217, 0.00) 0%, #AFFF25 100%)' }}
        ></div>
        
        {/* LE CONTENU DE TES PAGES (z-10 pour que les titres/textes passent au-dessus du dégradé) */}
        <div className="relative z-10">
          {children}
        </div>
        
        {/* LA TAB BAR */}
        <TabBar />
        
      </body>
    </html>
  )
}