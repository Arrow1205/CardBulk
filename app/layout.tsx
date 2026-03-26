import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import TabBar from '@/components/TabBar' 

const inter = Inter({ subsets: ['latin'] })

// 🚀 NOUVEAU : Un seul bloc viewport qui combine tout (encoche, zoom, couleurs)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Bloque le zoom intempestif sur mobile
  viewportFit: 'cover', // 🚨 LE SECRET EST ICI : Ça force l'app à passer sous la barre d'état !
  themeColor: '#040221',
};

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
