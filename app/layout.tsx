import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
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
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen relative`}>
        
        {/* LE DÉGRADÉ (z-0 au lieu de z-50) */}
        <div 
          className="absolute top-0 left-0 w-full h-[85px] pointer-events-none z-0" 
          style={{ background: 'linear-gradient(0deg, rgba(217, 217, 217, 0.00) 0%, #AFFF25 100%)' }}
        ></div>
        
        {/* On s'assure que le contenu passe par-dessus avec un z-10 */}
        <div className="relative z-10">
          {children}
        </div>
        
        <TabBar />
      </body>
    </html>
  )
}