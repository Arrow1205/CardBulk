'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Scan, Library, Trophy, BarChart3 } from 'lucide-react';

export default function TabBar() {
  const pathname = usePathname();

  // Fonction pour vérifier si l'onglet est actif
  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50">
      <div className="bg-[#8B5CF6]/20 backdrop-blur-2xl border border-white/10 rounded-[32px] px-6 py-3 shadow-2xl shadow-black/50">
        <ul className="flex justify-between items-center relative">
          
          {/* Accueil / Stats */}
          <li>
            <Link href="/stats" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/stats') ? 'text-[#DFFF00]' : 'text-white/60'}`}>
              <BarChart3 size={22} strokeWidth={2.5} />
            </Link>
          </li>

          {/* Collection */}
          <li>
            <Link href="/collection" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/collection') ? 'text-[#DFFF00]' : 'text-white/60'}`}>
              <Library size={22} strokeWidth={2.5} />
            </Link>
          </li>

          {/* Bouton Scanner Central (Le jaune fluo) */}
          <li className="-translate-y-6">
            <Link href="/scanner" className="flex items-center justify-center w-16 h-16 bg-[#DFFF00] text-black rounded-full shadow-[0_0_20px_rgba(223,255,0,0.3)] active:scale-90 transition-transform">
              <Scan size={30} strokeWidth={3} />
            </Link>
          </li>

          {/* Wishlist */}
          <li>
            <Link href="/wishlist" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/wishlist') ? 'text-[#DFFF00]' : 'text-white/60'}`}>
              <Trophy size={22} strokeWidth={2.5} />
            </Link>
          </li>

          {/* Home / Profil */}
          <li>
            <Link href="/" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/') ? 'text-[#DFFF00]' : 'text-white/60'}`}>
              <Home size={22} strokeWidth={2.5} />
            </Link>
          </li>

        </ul>
      </div>
    </nav>
  );
}