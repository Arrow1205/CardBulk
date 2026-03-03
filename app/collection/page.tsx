'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutGrid, Search, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CollectionPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchCards() {
      const { data, error } = await supabase
        .from('cards')
        .select(`*, players(name)`)
        .order('created_at', { ascending: false });

      if (!error) setCards(data || []);
      setLoading(false);
    }
    fetchCards();
  }, []);

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-32">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Mon <span className="text-[#AFFF25]">Empire</span></h1>
        <div className="bg-white/5 p-3 rounded-full border border-white/10">
          <Trophy size={20} className="text-[#AFFF25]" />
        </div>
      </header>

      {/* Barre de recherche style futuriste */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
        <input 
          placeholder="Chercher un joueur..." 
          className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-[#AFFF25]/50 transition-all text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 opacity-20 animate-pulse font-black uppercase tracking-widest">Chargement du deck...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cards.map((card) => (
            <div 
              key={card.id} 
              className="bg-white/5 border border-white/10 rounded-[24px] overflow-hidden active:scale-95 transition-all"
            >
              <div className="aspect-[3/4] bg-gray-900 relative">
                <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
                {card.is_rookie && (
                  <span className="absolute top-2 left-2 bg-[#AFFF25] text-[#040221] text-[8px] font-black px-2 py-1 rounded-full uppercase">RC</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-[10px] text-white/40 uppercase font-bold truncate">{card.brand} • {card.series}</p>
                <p className="text-sm font-black uppercase leading-tight mt-1 truncate">{card.players?.name || 'Inconnu'}</p>
                <p className="text-[#AFFF25] font-bold text-xs mt-2">{card.purchase_price} €</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && cards.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/20 uppercase font-bold text-xs tracking-widest mb-4">Aucune carte dans ton deck</p>
          <button onClick={() => router.push('/scanner')} className="text-[#AFFF25] font-black uppercase italic border-b-2 border-[#AFFF25]">Lancer un scan</button>
        </div>
      )}
    </div>
  );
}