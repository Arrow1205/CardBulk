'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Edit, Star, Loader2 } from 'lucide-react';

// 🎯 LE DICTIONNAIRE MAGIQUE (Pour trouver la bonne icône de sport)
const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'F1': { image: 'F1', label: 'Formule 1' },
  'NFL': { image: 'NFL', label: 'Football Américain' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'POKEMON': { image: 'Pokemon', label: 'Pokémon' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' },
  'MARVEL': { image: 'MArvel', label: 'Marvel' }
};

export default function CardDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params.id as string;

  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavoriting, setIsFavoriting] = useState(false);

  useEffect(() => {
    fetchCard();
  }, [cardId]);

  const fetchCard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error("Erreur de chargement:", error);
      router.push('/collection'); // Si la carte n'existe pas, on retourne à la collection
    } else {
      setCard(data);
    }
    setLoading(false);
  };

  const toggleFavorite = async () => {
    if (!card) return;
    setIsFavoriting(true);
    const newFavStatus = !card.is_favorite;

    // Mise à jour optimiste (l'UI change tout de suite pour la fluidité)
    setCard({ ...card, is_favorite: newFavStatus });

    const { error } = await supabase
      .from('cards')
      .update({ is_favorite: newFavStatus })
      .eq('id', card.id);

    if (error) {
      console.error("Erreur lors de la mise en favori:", error);
      // On annule si la BDD a planté
      setCard({ ...card, is_favorite: !newFavStatus });
    }
    setIsFavoriting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040221]">
        <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
      </div>
    );
  }

  if (!card) return null;

  // Préparation des icônes
  const sportData = SPORT_CONFIG[card.sport] || { image: 'Soccer', label: card.sport || 'Sport' };
  const clubSlug = card.club_name ? card.club_name.toLowerCase().replace(/\s+/g, '-') : '';

  return (
    // On enlève le bg couleur ici pour laisser voir le background dynamique
    <div className="min-h-screen text-white pb-36 font-sans relative overflow-x-hidden">
      
      {/* 🚀 LE BACKGROUND DYNAMIQUE (Image agrandie à 20% d'opacité) */}
      <div className="fixed inset-0 z-0 bg-[#040221]">
        {card.image_url && (
          <>
            {/* L'image prend tout l'écran, est centrée, sans déborder (object-cover) */}
            <img 
              src={card.image_url} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20"
            />
            {/* Un léger voile par-dessus pour adoucir si l'image est trop claire */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#040221]/40 via-transparent to-[#040221]"></div>
          </>
        )}
      </div>

      {/* 🚀 TOUT LE CONTENU EST PAR-DESSUS (z-10) */}
      <div className="relative z-10">
        
        {/* HEADER (Bouton retour et édition) */}
        <header className="flex items-center justify-between p-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
            <ChevronLeft size={20} />
          </button>
          <button className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
            <Edit size={18} />
          </button>
        </header>

        {/* IMAGE DE LA CARTE PRINCIPALE */}
        <div className="px-6 flex justify-center mb-8">
          <div className="relative w-full max-w-[300px] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
            {card.image_url ? (
              <img src={card.image_url} className="w-full h-full object-cover" alt="Card" />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">Image introuvable</div>
            )}
          </div>
        </div>

        {/* INFOS DE LA CARTE */}
        <div className="px-6 space-y-6">
          
          {/* Ligne 1 : Tags de Spécificités + Étoile Favoris */}
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {card.is_patch && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Patch</span>}
              {card.is_auto && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Autographe</span>}
              {card.is_numbered && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Numéroté</span>}
              {card.is_rookie && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Rookie</span>}
            </div>
            
            <button 
              onClick={toggleFavorite} 
              disabled={isFavoriting}
              className="active:scale-90 transition-transform p-1"
            >
              <Star 
                size={28} 
                strokeWidth={card.is_favorite ? 0 : 1.5} 
                className={card.is_favorite ? "fill-[#AFFF25] text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)]" : "text-[#AFFF25]"} 
              />
            </button>
          </div>

          {/* Ligne 2 : Noms du joueur */}
          <div>
            <div className="text-xl text-white uppercase tracking-wider font-light mb-1">
              {card.firstname || "Prénom"}
            </div>
            <div className="text-6xl font-black italic text-[#AFFF25] uppercase leading-none tracking-tighter">
              {card.lastname || "Nom"}
            </div>
          </div>

          {/* Ligne 3 : Tags Sport et Club cliquables */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => router.push('/sport')} 
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10 transition-colors"
            >
              <img src={`/asset/sports/${sportData.image}.png`} className="w-4 h-4 object-contain" alt={sportData.label} />
              <span className="text-sm font-medium text-white">{sportData.label}</span>
            </button>
            
            {card.club_name && (
              <button 
                onClick={() => router.push('/club')} 
                className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10 transition-colors"
              >
                <img 
                  src={`/asset/logo-club/${clubSlug}.svg`} 
                  className="w-4 h-4 object-contain" 
                  alt={card.club_name} 
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
                <span className="text-sm font-medium text-white">{card.club_name}</span>
              </button>
            )}
          </div>

          {/* Ligne 4 : Grille d'informations (Brand, Set, Année, Prix) */}
          <div className="grid grid-cols-2 gap-y-6 pt-4 border-t border-white/10 mt-6">
            
            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Brand</div>
              <div className="text-lg font-bold text-white capitalize">{card.brand || "-"}</div>
            </div>

            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Set</div>
              <div className="text-lg font-bold text-white capitalize">{card.series || "-"}</div>
            </div>

            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Année</div>
              <div className="text-lg font-bold text-white">{card.year || "-"}</div>
            </div>

            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Prix</div>
              <div className="text-lg font-bold text-white">{card.purchase_price ? `${card.purchase_price}€` : "-"}</div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}