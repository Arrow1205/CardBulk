'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, Scan, BarChart3, Folder } from 'lucide-react';

export default function TabBar() {
  const pathname = usePathname();

  // Couleur Jaune #AFFF25 si actif, Blanc si inactif
  const getItemColor = (path: string) => 
    pathname === path ? 'text-[#AFFF25]' : 'text-white';

  const menuItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Wishlist', path: '/wishlist', icon: Heart },
    { label: 'Scan', path: '/scanner', icon: Scan, isCenter: true },
    { label: 'Stats', path: '/stats', icon: BarChart3 },
    { label: 'Collection', path: '/collection', icon: Folder },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-50">
      <div className="bg-[#040221] border border-white/10 rounded-[28px] px-4 py-3 shadow-2xl">
        <ul className="flex justify-between items-end list-none p-0 m-0">
          {menuItems.map((item) => (
            <li key={item.path} className="flex-1">
              <Link 
                href={item.path} 
                className={`flex flex-col items-center gap-1 transition-all ${getItemColor(item.path)}`}
              >
                {item.isCenter ? (
                  /* Bouton SCAN Central en CERCLE PARFAIT */
                  <div className="flex items-center justify-center w-16 h-16 bg-[#AFFF25] text-[#040221] rounded-full -translate-y-8 shadow-[0_10px_25px_rgba(175,255,37,0.4)] active:scale-90 transition-transform">
                    <item.icon size={32} strokeWidth={2.5} />
                  </div>
                ) : (
                  /* Autres Icônes avec texte en blanc/jaune */
                  <div className="flex flex-col items-center gap-1 pb-1">
                    <item.icon size={22} strokeWidth={2} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}