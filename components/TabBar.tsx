'use client';

import { Home, Heart, Camera, BarChart2, Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TabBar() {
  const router = useRouter();

  return (
    // Ajout de h-[70px] et centrage vertical automatique
    <div className="fixed bottom-0 left-0 w-full h-[70px] bg-[#0A072E] rounded-t-[20px] px-6 flex justify-between items-center z-50">
      
      {/* Home */}
      <button onClick={() => router.push('/')} className="flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors mt-1">
        <Home size={22} strokeWidth={2} />
        <span className="text-[10px] mt-1 italic font-medium">Home</span>
      </button>

      {/* Wishlist */}
      <button onClick={() => router.push('/wishlist')} className="flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors mt-1">
        <Heart size={22} strokeWidth={2} />
        <span className="text-[10px] mt-1 italic font-medium">Wishlist</span>
      </button>

      {/* BOUTON CENTRAL CAMERA */}
      <div className="relative -top-6">
        <button 
          onClick={() => router.push('/scanner')} 
          className="w-[68px] h-[68px] bg-[#AFFF25] rounded-full flex items-center justify-center text-black border-[6px] border-[#040221] transition-transform active:scale-95"
        >
          <Camera size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Stats */}
      <button onClick={() => router.push('/stats')} className="flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors mt-1">
        <BarChart2 size={22} strokeWidth={2} />
        <span className="text-[10px] mt-1 italic font-medium">Stats</span>
      </button>

      {/* Collection */}
      <button onClick={() => router.push('/collection')} className="flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors mt-1">
        <Folder size={22} strokeWidth={2} />
        <span className="text-[10px] mt-1 italic font-medium">Collection</span>
      </button>

    </div>
  );
}