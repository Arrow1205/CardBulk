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
      <body className={`${inter.className} bg-[#040221] text-white overflow-x-hidden min-h-screen`}>
        {/* LE NOUVEAU DÉGRADÉ EXACT */}
        <div 
          className="fixed top-0 left-0 w-full h-[85px] pointer-events-none z-50" 
          style={{ background: 'linear-gradient(0deg, rgba(217, 217, 217, 0.00) 0%, #AFFF25 100%)' }}
        ></div>
        
        {children}
        
        <TabBar />
      </body>
    </html>
  )
}