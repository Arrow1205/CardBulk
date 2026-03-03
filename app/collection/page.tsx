'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, Home, Heart, Camera, BarChart2, Folder } from 'lucide-react';

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setCards(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-24 font-sans relative">
      {/* Halo lumineux en haut */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-[300px] bg-[#AFFF25]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="p-6 relative z-10">
        {/* Titre */}
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-center mb-6 mt-4 shadow-black drop-shadow-lg">
          COLLECTION
        </h1>

        {/* Barre de recherche */}
        <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Enter player name" 
            className="w-full bg-transparent border border-[#AFFF25] p-4 rounded-full text-sm outline-none text-white/80 placeholder:text-white/40 italic"
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-[#AFFF25]" size={20} />
        </div>

        {/* Filtres Dropdowns */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <select className="w-full bg-transparent border border-white/30 p-3 rounded-full text-sm font-bold italic appearance-none outline-none pl-10">
              <option className="bg-[#040221]">FOOTBALL</option>
              <option className="bg-[#040221]">BASKETBALL</option>
            </select>
            <img src="/asset/sports/football.png" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 object-contain" alt="sport" />
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white" size={16} />
          </div>
          <div className="relative w-1/3">
            <select className="w-full bg-transparent border border-white/30 p-3 rounded-full text-sm font-bold appearance-none outline-none pl-4">
              <option className="bg-[#040221]">Auto</option>
              <option className="bg-[#040221]">Patch</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white" size={16} />
          </div>
        </div>

        {/* Filtres Brands (Scroll horizontal) */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
          <button className="snap-start bg-[#AFFF25] text-black px-6 py-2 rounded-full font-black text-sm">Tout</button>
          {['topps', 'panini', 'daka', 'leaf'].map(brand => (
            <button key={brand} className="snap-start border border-white/20 px-4 py-2 rounded-full flex items-center justify-center min-w-[80px]">
              <img src={`/asset/brands/${brand}.png`} alt={brand} className="h-4 object-contain opacity-80" />
            </button>
          ))}
        </div>

        {/* Grille de cartes (3 colonnes) */}
        <div className="grid grid-cols-3 gap-3">
          {cards.map((card) => (
            <div 
              key={card.id} 
              onClick={() => router.push(`/card/${card.id}`)}
              className="aspect-[2.5/3.5] rounded-xl overflow-hidden border border-white/10 cursor-pointer active:scale-95 transition-transform"
            >
              {card.image_url ? (
                <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center text-[10px] text-white/30 font-bold">Image</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 w-full h-20 bg-[#040221]/90 backdrop-blur-lg border-t border-white/10 flex justify-between items-center px-6 pb-2 z-50">
        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <Home size={22} />
          <span className="text-[9px] italic">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <Heart size={22} />
          <span className="text-[9px] italic">Whishlist</span>
        </button>
        
        {/* Gros bouton Camera central */}
        <div className="relative -top-6">
          <button 
            onClick={() => router.push('/scanner')}
            className="w-16 h-16 bg-[#AFFF25] rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(175,255,37,0.4)] active:scale-95 transition-transform"
          >
            <Camera size={28} />
          </button>
        </div>

        <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
          <BarChart2 size={22} />
          <span className="text-[9px] italic">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white transition-colors">
          <Folder size={22} />
          <span className="text-[9px] italic">Collection</span>
        </button>
      </div>
    </div>
  );
}