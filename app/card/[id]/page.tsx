'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Edit, Star, Loader2, Smartphone } from 'lucide-react';

import FOOTBALL_CLUBS from '@/data/football-clubs.json';

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'F1': { image: 'F1', label: 'Formule 1' },
  'NFL': { image: 'NFL', label: 'Football Américain' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' }
};

export default function CardDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params.id as string;

  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);

  const [tiltStyle, setTiltStyle] = useState({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' });
  const [glareStyle, setGlareStyle] = useState({ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0%, transparent 50%)', opacity: 0 });
  const [showGyroButton, setShowGyroButton] = useState(false);

  useEffect(() => { fetchCard(); }, [cardId]);

  const fetchCard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data } = await supabase.from('cards').select('*').eq('id', cardId).eq('user_id', user.id).single();
    if (data) setCard(data); else router.push('/collection');
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const savedPermission = localStorage.getItem('gyro_permission');
        if (savedPermission === 'granted') {
          startGyro();
        } else {
          setShowGyroButton(true);
        }
      } else {
        startGyro();
      }
    }
    return () => { window.removeEventListener('deviceorientation', handleOrientation); };
  }, []);

  const requestGyroPermission = async () => {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('gyro_permission', 'granted');
        setShowGyroButton(false);
        startGyro();
      }
    } catch (e) { console.error("Erreur Gyro", e); }
  };

  const startGyro = () => { window.addEventListener('deviceorientation', handleOrientation); };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (!e.gamma || !e.beta) return;

    let x = e.gamma; 
    let y = e.beta;  

    x = Math.max(-30, Math.min(30, x));
    y = Math.max(-30, Math.min(30, y - 45)); 

    // 🚀 GYROSCOPE ADOUCI : 3x MOINS RAPIDE (x * 0.5)
    const rotateY = x * 0.5; 
    const rotateX = -y * 0.5;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      // 🚀 TRANSITION PLUS LENTE ET FLUIDE
      transition: 'transform 0.3s ease-out'
    });

    const glareX = (x / 30) * 100;
    const glareY = (y / 30) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${50 + glareX}% ${50 + glareY}%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
      opacity: Math.max(0.1, Math.abs(x) / 30)
    });
  };

  const toggleFavorite = async () => {
    if (!card || card.is_wishlist) return;
    setIsFavoriting(true);
    const newFavStatus = !card.is_favorite;
    setCard({ ...card, is_favorite: newFavStatus });
    await supabase.from('cards').update({ is_favorite: newFavStatus }).eq('id', card.id);
    setIsFavoriting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#040221]"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;
  if (!card) return null;

  const sportData = SPORT_CONFIG[card.sport] || { image: 'Soccer', label: card.sport || 'Sport' };

  const safeFootballClubs = Array.isArray(FOOTBALL_CLUBS) ? FOOTBALL_CLUBS : [];
  const searchName = card.club_name ? card.club_name.toLowerCase() : '';
  const selectedClub = safeFootballClubs.find((c: any) => {
    const cName = c.name?.toLowerCase() || '';
    const cSlug = c.slug?.toLowerCase() || '';
    return searchName === cName || searchName === cSlug || cSlug.includes(searchName) || searchName.includes(cName.replace(' fc', ''));
  });
  const clubSlug = selectedClub ? selectedClub.slug : searchName.replace(/\s+/g, '-');

  return (
    <div className="min-h-screen text-white pb-36 font-sans relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 bg-[#040221]">
        {card.image_url && <><img src={card.image_url} alt="Background" className="w-full h-full object-cover opacity-20" /><div className="absolute inset-0 bg-gradient-to-b from-[#040221]/40 via-transparent to-[#040221]"></div></>}
      </div>

      <div className="relative z-10">
        <header className="flex items-center justify-between p-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
          <button onClick={() => router.push(`/scanner?edit=${card.id}`)} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><Edit size={18} /></button>
        </header>

        <div className="px-6 flex flex-col items-center justify-center mb-10 perspective-1000">
          <div style={{ ...tiltStyle, transformStyle: 'preserve-3d', borderRadius: '12px' }} className={`relative w-full max-w-[340px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${isHorizontal ? 'aspect-[1.55]' : 'aspect-[3/4]'}`}>
            {card.image_url ? (
              <img src={card.image_url} onLoad={(e) => setIsHorizontal(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)} style={{ borderRadius: '12px' }} className="w-full h-full object-cover border border-white/10" alt="Card" />
            ) : <div className="w-full h-full bg-white/5 flex items-center justify-center">No Image</div>}
            
            <div className="absolute inset-0 pointer-events-none rounded-[12px] mix-blend-overlay transition-opacity duration-200" style={glareStyle}></div>
          </div>

          {showGyroButton && (
            <button onClick={requestGyroPermission} className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest text-[#AFFF25]">
              <Smartphone size={16} /> Activer l'effet 3D
            </button>
          )}
        </div>

        <div className="px-6">
          <div className="flex justify-between items-center mb-1">
            <div onClick={() => router.push(`/collection?search=${encodeURIComponent(card.firstname + ' ' + card.lastname)}`)} className="cursor-pointer active:opacity-50 flex-1">
              <div className="text-xl text-white uppercase tracking-wider font-light">{card.firstname || "Prénom"}</div>
              <div className="text-6xl font-black italic text-[#AFFF25] uppercase leading-none tracking-tighter mb-4">{card.lastname || "Nom"}</div>
            </div>
            
            {!card.is_wishlist && (
              <button onClick={toggleFavorite} disabled={isFavoriting} className="active:scale-90 transition-transform p-1 self-start mt-2">
                <Star size={28} strokeWidth={card.is_favorite ? 0 : 1.5} className={card.is_favorite ? "fill-[#AFFF25] text-[#AFFF25]" : "text-[#AFFF25]"} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {card.is_patch && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Patch</span>}
            {card.is_auto && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Autographe</span>}
            {card.is_numbered && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Numéroté</span>}
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={() => router.push(`/collection?sport=${card.sport}`)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10">
              <img src={`/asset/sports/${sportData.image}.png`} className="w-4 h-4 object-contain" alt={sportData.label} />
              <span className="text-sm font-medium text-white">{sportData.label}</span>
            </button>
            {card.club_name && (
              <button onClick={() => router.push(`/club/${clubSlug}`)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10">
                <img src={`/asset/logo-club/${clubSlug}.svg`} className="w-4 h-4 object-contain" alt={card.club_name} onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="text-sm font-medium text-white">{card.club_name}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-y-6 pt-6 border-t border-white/10">
            <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Brand</div><div className="text-lg font-bold text-white capitalize">{card.brand || "-"}</div></div>
            <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Set</div><div className="text-lg font-bold text-white capitalize">{card.series || "-"}</div></div>
            <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Année</div><div className="text-lg font-bold text-white">{card.year || "-"}</div></div>
            <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Prix</div><div className="text-lg font-bold text-white">{card.purchase_price ? `${card.purchase_price}€` : "-"}</div></div>
          </div>

          {card.website_url && (
            <div className="pt-8 flex justify-center pb-6">
              <button onClick={() => window.open(card.website_url, '_blank')} className="w-[80%] max-w-[300px] border-2 border-[#AFFF25] text-[#AFFF25] py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#AFFF25]/10">View on website</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}