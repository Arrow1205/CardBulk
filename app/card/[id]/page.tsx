'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Edit, Star, Loader2 } from 'lucide-react';

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
  const [isHorizontal, setIsHorizontal] = useState(false);

  const [tiltStyle, setTiltStyle] = useState({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
    transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
  });
  const [glareStyle, setGlareStyle] = useState({
    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0%, transparent 50%)',
    opacity: 0
  });

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
      router.push('/collection');
    } else {
      setCard(data);
    }
    setLoading(false);
  };

  const handleMainImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > img.naturalHeight) {
      setIsHorizontal(true);
    } else {
      setIsHorizontal(false);
    }
  };

  const toggleFavorite = async () => {
    if (!card) return;
    setIsFavoriting(true);
    const newFavStatus = !card.is_favorite;

    setCard({ ...card, is_favorite: newFavStatus });

    const { error } = await supabase
      .from('cards')
      .update({ is_favorite: newFavStatus })
      .eq('id', card.id);

    if (error) {
      setCard({ ...card, is_favorite: !newFavStatus });
    }
    setIsFavoriting(false);
  };

  const handleMove = (e: any) => {
    if (!card?.image_url) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left; 
    const y = clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -15; 
    const rotateY = ((x - centerX) / centerX) * 15;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'transform 0.1s ease-out'
    });

    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.3) 0%, transparent 60%)`,
      opacity: 1
    });
  };

  const handleLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
    });
    setGlareStyle(prev => ({ ...prev, opacity: 0 }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040221]">
        <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
      </div>
    );
  }

  if (!card) return null;

  const sportData = SPORT_CONFIG[card.sport] || { image: 'Soccer', label: card.sport || 'Sport' };
  const clubSlug = card.club_name ? card.club_name.toLowerCase().replace(/\s+/g, '-') : '';

  return (
    <div className="min-h-screen text-white pb-36 font-sans relative overflow-x-hidden">
      
      <div className="fixed inset-0 z-0 bg-[#040221]">
        {card.image_url && (
          <>
            <img 
              src={card.image_url} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#040221]/40 via-transparent to-[#040221]"></div>
          </>
        )}
      </div>

      <div className="relative z-10">
        
        <header className="flex items-center justify-between p-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => router.push(`/scanner?edit=${card.id}`)} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
            <Edit size={18} />
          </button>
        </header>

        <div className="px-6 flex justify-center mb-10 perspective-1000">
          <div 
            style={{ ...tiltStyle, transformStyle: 'preserve-3d', borderRadius: '12px' }}
            className={`relative w-full max-w-[340px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] cursor-grab active:cursor-grabbing ${isHorizontal ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onTouchMove={handleMove}
            onTouchEnd={handleLeave}
          >
            {card.image_url ? (
              <>
                <img 
                  src={card.image_url} 
                  onLoad={handleMainImageLoad} 
                  style={{ borderRadius: '12px' }}
                  className="w-full h-full object-cover border border-white/10" 
                  alt="Card" 
                />
                <div 
                  style={{ ...glareStyle, borderRadius: '12px' }}
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                ></div>
                <div 
                   style={{ borderRadius: '12px' }}
                   className="absolute inset-0 border border-white/20 opacity-50 mix-blend-overlay pointer-events-none"
                ></div>
              </>
            ) : (
              <div 
                 style={{ borderRadius: '12px' }}
                 className="w-full h-full bg-white/5 flex items-center justify-center border border-white/10">Image introuvable</div>
            )}
          </div>
        </div>

        <div className="px-6">
          
          <div className="flex justify-between items-center mb-1">
            <div className="text-xl text-white uppercase tracking-wider font-light">
              {card.firstname || "Prénom"}
            </div>
            <button onClick={toggleFavorite} disabled={isFavoriting} className="active:scale-90 transition-transform p-1">
              <Star 
                size={28} 
                strokeWidth={card.is_favorite ? 0 : 1.5} 
                className={card.is_favorite ? "fill-[#AFFF25] text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)]" : "text-[#AFFF25]"} 
              />
            </button>
          </div>

          <div className="text-6xl font-black italic text-[#AFFF25] uppercase leading-none tracking-tighter mb-4">
            {card.lastname || "Nom"}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {card.is_patch && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Patch</span>}
            {card.is_auto && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Autographe</span>}
            {card.is_numbered && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Numéroté</span>}
            {card.is_rookie && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white shadow-md">Rookie</span>}
          </div>

          {/* 🚀 NOUVEAU : REDIRECTIONS FILTRÉES VERS LA COLLECTION */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button 
              onClick={() => router.push(`/collection?sport=${card.sport}`)} 
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10 transition-colors"
            >
              <img src={`/asset/sports/${sportData.image}.png`} className="w-4 h-4 object-contain" alt={sportData.label} />
              <span className="text-sm font-medium text-white">{sportData.label}</span>
            </button>
            
            {card.club_name && (
              <button 
                onClick={() => router.push(`/collection?club=${encodeURIComponent(card.club_name)}`)} 
                className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10 transition-colors"
              >
                <img src={`/asset/logo-club/${clubSlug}.svg`} className="w-4 h-4 object-contain" alt={card.club_name} onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="text-sm font-medium text-white">{card.club_name}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-y-6 pt-6 border-t border-white/10">
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