'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, ChevronLeft, Loader2 } from 'lucide-react';

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("Utilisateur non connecté !");
        setLoading(false);
        return;
      }

      // On récupère les cartes
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 🚨 Le Mouchard : Si Supabase bloque, on va le savoir !
      if (error) {
        console.error("Erreur Supabase:", error.message);
        alert("Erreur Supabase : " + error.message);
      }

      if (data) {
        setCards(data);
      }
    } catch (err) {
      console.error("Erreur inattendue :", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // 🔥 FIX DU SCROLL : Ajout de overflow-x-hidden ici
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-24 overflow-y-auto overflow-x-hidden font-sans">
      
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/')} className="w-10 h-10 bg-transparent rounded-full flex items-center justify-center border border-white/20">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">MA COLLECTION</h1>
          <p className="text-[#AFFF25] text-[10px] italic tracking-widest mt-1">{cards.length} CARTES</p>
        </div>
        <button onClick={() => router.push('/scanner')} className="w-10 h-10 bg-[#AFFF25] text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(175,255,37,0.4)]">
          <Plus size={20} className="font-bold" />
        </button>
      </header>

      {/* Grille de cartes */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center mt-20 space-y-4">
          <p className="text-white/40 italic font-bold">Ta collection est vide.</p>
          <button onClick={() => router.push('/scanner')} className="bg-[#AFFF25] text-black font-black italic py-3 px-8 rounded-full text-sm uppercase">Scanner ma 1ère carte</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cards.map((card) => (
            <div 
              key={card.id} 
              onClick={() => router.push(`/card/${card.id}`)}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform group"
            >
              {card.image_url ? (
                <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-xs italic font-bold">Sans Image</div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-[#040221] via-[#040221]/40 to-transparent opacity-90" />
              
              <div className="absolute bottom-0 left-0 w-full p-3 z-10">
                {card.is_numbered && (
                  <span className="bg-[#AFFF25] text-black text-[9px] font-black italic px-2 py-0.5 rounded-sm uppercase mb-1 inline-block">
                    {card.numbering_low}/{card.numbering_max}
                  </span>
                )}
                <h3 className="font-black italic uppercase text-sm leading-tight truncate">
                  {card.club_name || "Joueur Inconnu"}
                </h3>
                <p className="text-white/60 text-[10px] font-bold uppercase truncate mt-0.5">{card.brand} {card.series}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
