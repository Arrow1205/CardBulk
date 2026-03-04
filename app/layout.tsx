import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
// Si tu as un composant TabBar, importe-le ici (on le crée juste après)
import TabBar from '@/components/TabBar' 

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CardBulk',
  description: 'Application de scan de cartes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen`}>
        {/* LE FAMEUX DÉGRADÉ FLUO EN HAUT */}
        <div className="fixed top-0 left-0 w-full h-40 bg-gradient-to-b from-[#AFFF25]/15 via-[#AFFF25]/5 to-transparent pointer-events-none z-50"></div>
        
        {children}
        
        {/* LA TAB BAR EN BAS */}
        <TabBar />
      </body>
    </html>
  )
}