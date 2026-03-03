'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Edit, Star, Loader2 } from 'lucide-react';

export default function CardDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) fetchCard();
  }, [params.id]);

  const fetchCard = async () => {
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (data) setCard(data);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;
  if (!card) return <div className="min-h-screen bg-[#040221] text-white p-6">Carte introuvable.</div>;

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-hidden">
      
      {/* Fond Flouté (utilise l'image de la carte) */}
      {card.image_url && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110"
            style={{ backgroundImage: `url(${card.image_url})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#040221]/80 to-[#040221] h-full" />
        </>
      )}

      {/* Header */}
      <div className="relative z-10 p-6 flex justify-between items-center">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20 bg-black/20 backdrop-blur-md">
          <ChevronLeft size={20} />
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-md border border-white/20">
          <Edit size={18} />
        </button>
      </div>

      {/* Contenu principal */}
      <div className="relative z-10 px-6 flex flex-col items-center">
        
        {/* Carte Centrale */}
        <div className="w-[85%] max-w-[320px] aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl shadow-black/50 mb-6 border border-white/10">
          {card.image_url ? (
            <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#080531] flex justify-center items-center">Image</div>
          )}
        </div>

        {/* Header Carte (Tags + Etoile) */}
        <div className="w-full flex justify-between items-center mb-6">
          <div className="flex flex-wrap gap-2">
            {card.is_patch && <span className="bg-[#0B1B3D] text-[#AFFF25] px-3 py-1 rounded-full text-[10px] font-medium">Patch</span>}
            {card.is_auto && <span className="bg-[#0B1B3D] text-white px-3 py-1 rounded-full text-[10px] font-medium">Autographe</span>}
            {card.is_numbered && <span className="bg-[#0B1B3D] text-white px-3 py-1 rounded-full text-[10px] font-medium">Numéroté</span>}
            {card.is_rookie && <span className="bg-[#0B1B3D] text-white px-3 py-1 rounded-full text-[10px] font-medium">Rookie</span>}
          </div>
          <button className="text-[#AFFF25]">
            <Star size={24} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nom du Joueur Géant */}
        <div className="w-full mb-4">
          <h2 className="text-2xl font-light tracking-wide uppercase leading-none">
            {card.player_firstname || "PRÉNOM"}
          </h2>
          <h1 className="text-[64px] font-black italic uppercase text-[#AFFF25] leading-[0.85] tracking-tighter shadow-black drop-shadow-lg">
            {card.player_lastname || "NOM"}
          </h1>
        </div>

        {/* Badges Sport & Club */}
        <div className="w-full flex gap-3 mb-10">
          <div className="flex items-center gap-2 border border-[#AFFF25]/50 rounded-full px-4 py-1.5 bg-[#AFFF25]/5 backdrop-blur-sm">
            <img src={`/asset/sports/${card.sport?.toLowerCase() || 'football'}.png`} className="w-4 h-4 object-contain" alt="sport" />
            <span className="text-sm font-medium">{card.sport || "Football"}</span>
          </div>
          <div className="flex items-center gap-2 border border-white/20 rounded-full px-4 py-1.5 bg-white/5 backdrop-blur-sm">
            <img src={`/asset/logo-club/${card.club_name?.toLowerCase()}.svg`} className="w-4 h-4 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} alt="club" />
            <span className="text-sm font-medium">{card.club_name || "Club"}</span>
          </div>
        </div>

        {/* Grille d'infos (Brand, Set, Année, Prix) */}
        <div className="w-full grid grid-cols-2 gap-y-6 gap-x-4 pb-10">
          <div>
            <span className="text-[#AFFF25] text-[10px] block mb-1">Brand</span>
            <span className="font-bold text-lg">{card.brand || "-"}</span>
          </div>
          <div>
            <span className="text-[#AFFF25] text-[10px] block mb-1">Set</span>
            <span className="font-bold text-lg">{card.series || "-"}</span>
          </div>
          <div>
            <span className="text-[#AFFF25] text-[10px] block mb-1">Année</span>
            <span className="font-bold text-lg">{card.year || "-"}</span>
          </div>
          <div>
            <span className="text-[#AFFF25] text-[10px] block mb-1">Prix</span>
            <span className="font-bold text-lg">{card.purchase_price ? `${card.purchase_price}€` : "-"}</span>
          </div>
        </div>

      </div>
    </div>
  );
}