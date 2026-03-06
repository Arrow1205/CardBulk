'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setCards(data.filter(c => !c.is_wishlist));
    setLoading(false);
  };

  const handleImageLoad = (img: HTMLImageElement, id: string) => {
    if (img.naturalWidth > img.naturalHeight) {
      setHorizontalCards(prev => {
        if (prev.has(id)) return prev; 
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    }
  };

  const favoriteCards = cards.filter(c => c.is_favorite);
  const carouselCards = favoriteCards.length > 0 ? favoriteCards : cards.slice(0, 5);
  const recentCards = cards.slice(0, 5);

  useEffect(() => {
    if (carouselCards.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselCards.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselCards.length]);

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.targetTouches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > 50) setActiveIndex((prev) => Math.min(prev + 1, carouselCards.length - 1));
    else if (swipeDistance < -50) setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-36 font-sans overflow-x-hidden relative z-10">
      
      <div className="absolute top-0 left-0 w-full h-[70px] pointer-events-none -z-10" style={{ background: 'linear-gradient(0deg, #040221 15.71%, #AFFF25 100%)', opacity: 0.8 }}></div>

      <header className="pt-6 pb-2 text-center">
        <div className="inline-block border-2 border-[#AFFF25] px-4 py-1 rounded-xl shadow-[0_0_15px_rgba(175,255,37,0.3)] bg-[#040221]/50 backdrop-blur-md">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter"><span className="text-[#AFFF25]">CARD</span>BULK</h1>
        </div>
      </header>

      {/* 🚀 PADDING DE RESPIRATION px-[2%] */}
      <div className="relative w-full h-[55vh] flex items-center justify-center overflow-hidden mt-2 px-[2%]" style={{ perspective: '1200px' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {carouselCards.length === 0 ? (
          <div className="text-white/40 italic font-bold">Aucune carte à afficher</div>
        ) : (
          carouselCards.map((card, index) => {
            const isHorizontal = horizontalCards.has(card.id);
            const offset = index - activeIndex;
            const absOffset = Math.abs(offset);
            
            if (absOffset > 2) return null;

            return (
              <div 
                key={card.id}
                onClick={() => offset === 0 ? router.push(`/card/${card.id}`) : setActiveIndex(index)}
                // 🚀 CONDITION DE HAUTEUR : 110px pour horizontales, 320px pour verticales
                className={`absolute max-h-[45vh] flex items-center justify-center rounded-2xl transition-all duration-500 ease-out cursor-pointer overflow-hidden bg-white/5 border border-white/10 ${
                  isHorizontal ? 'h-[110px] aspect-[1.55]' : 'h-[320px] aspect-[3/4]'
                }`}
                style={{
                  transform: `translateX(${Math.sign(offset) * (absOffset * 50)}%) translateZ(${absOffset * -150}px) rotateY(${Math.sign(offset) * -35}deg)`,
                  zIndex: 10 - absOffset,
                  opacity: absOffset > 1 ? 0.4 : (absOffset > 1 ? 0 : 1),
                  boxShadow: offset === 0 ? '0 20px 50px rgba(175,255,37,0.2)' : '0 10px 30px rgba(0,0,0,0.8)'
                }}
              >
                {card.image_url ? (
                  <img src={card.image_url} onLoad={(e) => handleImageLoad(e.currentTarget, card.id)} className="w-full h-full object-cover" alt="Card" />
                ) : (
                  <div className="w-full h-full bg-[#080531] flex items-center justify-center text-white/30 text-xs">No Image</div>
                )}
              </div>
            );
          })
        )}
        <div className="absolute bottom-2 flex gap-1.5">
          {carouselCards.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-[#AFFF25] w-3' : 'bg-white/30'}`} />)}
        </div>
      </div>

      <div className="px-6 mt-8">
        <h2 className="text-xl font-black italic uppercase tracking-tighter mb-4">Derniers ajouts</h2>
        <div className="space-y-3">
          {recentCards.map(card => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-3 cursor-pointer active:scale-95 transition-transform">
                <div className={`h-24 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-[#080531] shadow-lg ${isHorizontal ? 'w-32' : 'w-16'}`}>
                  {card.image_url ? <img src={card.image_url} className="w-full h-full object-cover" alt="Thumb" /> : <div className="text-[8px] text-white/30">N/A</div>}
                </div>
                <div className="flex flex-col justify-center flex-1 overflow-hidden">
                  <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold truncate mb-1">{card.brand} — {card.series || 'Base'}</div>
                  <div className="text-2xl font-black italic text-[#AFFF25] uppercase tracking-tighter leading-none truncate mb-2">{card.firstname} {card.lastname}</div>
                  <div className="flex flex-wrap gap-1">
                    {card.is_patch && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Patch</span>}
                    {card.is_auto && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Auto</span>}
                    {card.is_numbered && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Num</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}