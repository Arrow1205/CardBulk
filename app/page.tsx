'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour le carousel 3D
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // On récupère toutes les cartes, triées par date d'ajout
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setCards(data);
    }
    setLoading(false);
  };

  // 🚀 CAROUSEL AUTO-PLAY (Toutes les 5 secondes)
  useEffect(() => {
    if (cards.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselCards.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [cards, activeIndex]);

  // Gérer le swipe tactile pour le carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };
  const handleSwipe = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > 50) {
      // Swipe Gauche -> Carte suivante
      setActiveIndex((prev) => Math.min(prev + 1, carouselCards.length - 1));
    } else if (swipeDistance < -50) {
      // Swipe Droite -> Carte précédente
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  // Sélection des cartes pour le carousel (Favoris en priorité, sinon les 5 dernières)
  const favoriteCards = cards.filter(c => c.is_favorite);
  const carouselCards = favoriteCards.length > 0 ? favoriteCards : cards.slice(0, 5);
  
  // Sélection pour les "Derniers ajouts"
  const recentCards = cards.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040221] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-36 font-sans overflow-x-hidden">
      
      {/* HEADER LOGO */}
      <header className="pt-6 pb-2 text-center">
        <div className="inline-block border-2 border-[#AFFF25] px-4 py-1 rounded-xl shadow-[0_0_15px_rgba(175,255,37,0.3)]">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            <span className="text-[#AFFF25]">CARD</span>BULK
          </h1>
        </div>
      </header>

      {/* 🚀 CAROUSEL 3D COVERFLOW (70% de l'écran environ) */}
      <div 
        className="relative w-full h-[55vh] flex items-center justify-center overflow-hidden"
        style={{ perspective: '1200px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {carouselCards.length === 0 ? (
          <div className="text-white/40 italic">Aucune carte dans la collection</div>
        ) : (
          carouselCards.map((card, index) => {
            // Calcul mathématique de la 3D
            const offset = index - activeIndex;
            const absOffset = Math.abs(offset);
            const direction = Math.sign(offset);
            
            // Si la carte est trop loin, on la cache
            if (absOffset > 2) return null;

            const translateX = direction * (absOffset * 50); // Décalage horizontal
            const translateZ = absOffset * -150; // Recul en profondeur
            const rotateY = direction * -35; // Rotation sur le côté
            const zIndex = 10 - absOffset;
            const opacity = absOffset > 1 ? 0 : 1; // On ne voit que la centrale et les 2 adjacentes

            return (
              <div 
                key={card.id}
                onClick={() => {
                  if (offset === 0) router.push(`/card/${card.id}`);
                  else setActiveIndex(index);
                }}
                className="absolute w-[60%] max-w-[280px] aspect-[3/4] rounded-2xl transition-all duration-500 ease-out cursor-pointer"
                style={{
                  transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                  zIndex: zIndex,
                  opacity: absOffset > 1 ? 0.4 : opacity,
                  boxShadow: offset === 0 ? '0 20px 50px rgba(175,255,37,0.2)' : '0 10px 30px rgba(0,0,0,0.8)'
                }}
              >
                {card.image_url ? (
                  <img src={card.image_url} className="w-full h-full object-cover rounded-2xl border border-white/10" alt="Card" />
                ) : (
                  <div className="w-full h-full bg-[#080531] rounded-2xl border border-white/10 flex items-center justify-center text-white/30 text-xs">No Image</div>
                )}
                
                {/* Petit reflet brillant sur la carte active */}
                {offset === 0 && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 rounded-2xl pointer-events-none"></div>
                )}
              </div>
            );
          })
        )}

        {/* Petits points de pagination */}
        <div className="absolute bottom-2 flex gap-1.5">
          {carouselCards.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-[#AFFF25] w-3' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      {/* SECTION DERNIERS AJOUTS */}
      <div className="px-6 mt-8">
        <h2 className="text-xl font-black italic uppercase tracking-tighter mb-4">Derniers ajouts</h2>
        
        <div className="space-y-3">
          {recentCards.map(card => (
            <div 
              key={card.id}
              onClick={() => router.push(`/card/${card.id}`)}
              className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-3 cursor-pointer active:scale-95 transition-transform"
            >
              {/* Miniature */}
              <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-[#080531] shadow-lg">
                {card.image_url ? (
                  <img src={card.image_url} className="w-full h-full object-cover" alt="Thumb" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-white/30">N/A</div>
                )}
              </div>

              {/* Infos */}
              <div className="flex flex-col justify-center flex-1 overflow-hidden">
                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold truncate mb-1">
                  {card.brand} — {card.series || 'Base'}
                </div>
                
                <div className="text-2xl font-black italic text-[#AFFF25] uppercase tracking-tighter leading-none truncate mb-2">
                  {card.firstname} {card.lastname}
                </div>

                {/* Tags alignés */}
                <div className="flex flex-wrap gap-1">
                  {card.is_patch && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Patch</span>}
                  {card.is_auto && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Auto</span>}
                  {card.is_numbered && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Num</span>}
                  {card.is_rookie && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">RC</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
