'use client';

import { Home, Heart, Camera, BarChart2, Folder } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();

  // Fonction pour vérifier si le lien est actif
  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-[70px] bg-[#0A072E] rounded-t-[20px] px-6 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5">
      
      {/* Home */}
      <button 
        onClick={() => router.push('/')} 
        className={`flex flex-col items-center justify-center transition-colors mt-1 ${isActive('/') ? 'text-[#AFFF25]' : 'text-white hover:text-[#AFFF25]/70'}`}
      >
        <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[10px] mt-1 italic font-bold">Home</span>
      </button>

      {/* Wishlist */}
      <button 
        onClick={() => router.push('/wishlist')} 
        className={`flex flex-col items-center justify-center transition-colors mt-1 ${isActive('/wishlist') ? 'text-[#AFFF25]' : 'text-white hover:text-[#AFFF25]/70'}`}
      >
        <Heart size={22} strokeWidth={isActive('/wishlist') ? 2.5 : 2} />
        <span className="text-[10px] mt-1 italic font-bold">Wishlist</span>
      </button>

      {/* BOUTON CENTRAL CAMERA (Sans ombre) */}
      <div className="relative -top-6">
        <button 
          onClick={() => router.push('/scanner')} 
          className="w-[68px] h-[68px] bg-[#AFFF25] rounded-full flex items-center justify-center text-black border-[6px] border-[#040221] transition-transform active:scale-95"
        >
          <Camera size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Stats */}
      <button 
        onClick={() => router.push('/stats')} 
        className={`flex flex-col items-center justify-center transition-colors mt-1 ${isActive('/stats') ? 'text-[#AFFF25]' : 'text-white hover:text-[#AFFF25]/70'}`}
      >
        <BarChart2 size={22} strokeWidth={isActive('/stats') ? 2.5 : 2} />
        <span className="text-[10px] mt-1 italic font-bold">Stats</span>
      </button>

      {/* Collection */}
      <button 
        onClick={() => router.push('/collection')} 
        className={`flex flex-col items-center justify-center transition-colors mt-1 ${isActive('/collection') ? 'text-[#AFFF25]' : 'text-white hover:text-[#AFFF25]/70'}`}
      >
        <Folder size={22} strokeWidth={isActive('/collection') ? 2.5 : 2} />
        <span className="text-[10px] mt-1 italic font-bold">Collection</span>
      </button>

    </div>
  );
}