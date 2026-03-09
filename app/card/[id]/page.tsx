'use client';

import { useEffect, useState, useRef } from 'react';
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

  const [tiltStyle, setTiltStyle] = useState({ 
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', 
    transition: 'transform 0.3s ease-out' 
  });
  const [glareStyle, setGlareStyle] = useState({ 
    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0%, transparent 50%)', 
    opacity: 0,
    transition: 'opacity 0.3s ease-out'
  });
  
  const [showGyroButton, setShowGyroButton] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCard(); }, [cardId]);

  // 🚀 VRAIE CONNEXION SUPABASE
  const fetchCard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login'); 
    
    const { data } = await supabase.from('cards').select('*').eq('id', cardId).eq('user_id', user.id).single();
    if (data) setCard(data); 
    else router.push('/collection');
    
    setLoading(false);
  };

  // ==========================================
  // 🧭 GYROSCOPE (Ajusté pour plus de réactivité)
  // ==========================================
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
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          localStorage.setItem('gyro_permission', 'granted');
          setShowGyroButton(false);
          startGyro();
        }
      }
    } catch (e) { console.error(e); }
  };

  const startGyro = () => { 
    window.addEventListener('deviceorientation', handleOrientation, true); 
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (!e || e.gamma === null || e.beta === null) return;
    
    let x = e.gamma; 
    let y = e.beta;  
    
    // Centrage de l'axe Y (Téléphone tenu à ~45°)
    let adjustedY = y - 45;

    const maxTilt = 30;
    x = Math.max(-maxTilt, Math.min(maxTilt, x));
    adjustedY = Math.max(-maxTilt, Math.min(maxTilt, adjustedY)); 

    // Mouvements amplifiés pour que l'effet soit plus visible
    const rotateY = x * 0.8; 
    const rotateX = -adjustedY * 0.8;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`,
      transition: 'transform 0.1s ease-out'
    });

    const glareX = (x / maxTilt) * 100;
    const glareY = (adjustedY / maxTilt) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${50 + glareX}% ${50 + glareY}%, rgba(255,255,255,0.35) 0%, transparent 60%)`,
      opacity: Math.max(0.1, Math.abs(x) / maxTilt),
      transition: 'opacity 0.1s ease-out'
    });
  };

  // ==========================================
  // 👆 TACTILE
  // ==========================================
  const handleMove = (clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    window.removeEventListener('deviceorientation', handleOrientation);

    const rect = cardRef.current.getBoundingClientRect();
    const x = clientX - rect.left; 
    const y = clientY - rect.top;  
    const centerX = rect.width / 2; 
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -12; 
    const rotateY = ((x - centerX) / centerX) * 12;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'none' 
    });
    
    const glareX = (x / rect.width) * 100; 
    const glareY = (y / rect.height) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.5) 0%, transparent 50%)`,
      opacity: 0.8,
      transition: 'none'
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => handleMove(e.clientX, e.clientY);
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => handleMove(e.touches[0].clientX, e.touches[0].clientY);

  const handleLeave = () => {
    const savedPermission = localStorage.getItem('gyro_permission');
    if (savedPermission === 'granted' || typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      startGyro();
    }

    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)' 
    });
    setGlareStyle(prev => ({ ...prev, opacity: 0, transition: 'opacity 0.6s ease-out' }));
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
  const selectedClub = safeFootballClubs.find((c: any) => searchName === c.name?.toLowerCase() || searchName === c.slug?.toLowerCase() || c.slug?.includes(searchName));
  const clubSlug = selectedClub ? selectedClub.slug : searchName.replace(/\s+/g, '-');

  return (
    <div className="min-h-screen text-white font-sans relative overflow-x-hidden bg-[#040221]">
      
      {/* 🌌 FOND FIXE DE L'APP */}
      <div className="fixed inset-0 z-0 bg-[#040221]">
        {card.image_url && <><img src={card.image_url} alt="Background" className="w-full h-full object-cover opacity-20" /><div className="absolute inset-0 bg-gradient-to-b from-[#040221]/40 via-transparent to-[#040221]"></div></>}
      </div>

      {/* 🔝 HEADER FIXE */}
      <header className="fixed top-0 left-0 w-full h-[88px] z-50 flex items-center justify-between px-6">
        <button onClick={() => router.back()} className="pointer-events-auto w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
        <button onClick={() => router.push(`/scanner?edit=${card.id}`)} className="pointer-events-auto w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><Edit size={18} /></button>
      </header>

      {/* 🃏 CARTE 3D FIXE EN ARRIÈRE PLAN */}
      {/* 🚀 Modifié : Top à 74px exactement */}
      <div className="fixed top-[74px] left-0 w-full flex flex-col items-center justify-center z-10 perspective-1000 pointer-events-none px-4">
        
        {/* 🚀 Modifié : inline-block pour que la div épouse la taille exacte de l'image (Shrink-to-fit) */}
        <div 
          ref={cardRef}
          style={{ ...tiltStyle, transformStyle: 'preserve-3d', borderRadius: '12px' }} 
          className="relative inline-block shadow-[0_20px_60px_rgba(0,0,0,0.6)] cursor-crosshair pointer-events-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleLeave}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleLeave}
          onTouchCancel={handleLeave}
        >
          {card.image_url ? (
            // 🚀 Modifié : w-auto h-auto max-h-[420px] max-w-full pour ne pas couper l'image et l'afficher au max
            <img 
              src={card.image_url} 
              style={{ borderRadius: '12px', pointerEvents: 'none' }} 
              className="block w-auto h-auto max-w-full max-h-[420px] border border-white/10" 
              alt="Card" 
            />
          ) : (
            <div className="w-[250px] h-[350px] bg-white/5 flex items-center justify-center pointer-events-none rounded-[12px]">No Image</div>
          )}
          
          {/* Glare (Lumière) */}
          <div className="absolute inset-0 pointer-events-none rounded-[12px] mix-blend-overlay" style={glareStyle}></div>
        </div>

        {/* Bouton Gyroscope collé à la carte pour iOS */}
        {showGyroButton && (
          <button onClick={requestGyroPermission} className="pointer-events-auto mt-6 flex items-center gap-2 px-6 py-3 bg-[#AFFF25] text-black rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(175,255,37,0.4)] active:scale-95">
            <Smartphone size={16} /> Activer la 3D
          </button>
        )}
      </div>

      {/* 📄 SECTION INFORMATIONS */}
      {/* 🚀 Modifié : mt-[450px] */}
      <div className="relative z-30 w-full mt-[450px] bg-[#040221] rounded-t-[32px] px-6 pt-8 pb-12 min-h-[calc(100vh-88px)] shadow-[0_-20px_40px_rgba(0,0,0,0.8)] border-t border-white/5">
        
        <div className="flex justify-between items-start mb-6">
          <div onClick={() => router.push(`/collection?search=${encodeURIComponent(card.firstname + ' ' + card.lastname)}`)} className="cursor-pointer active:opacity-50 flex-1">
            <div className="text-xl text-white uppercase tracking-wider font-light">{card.firstname || "Prénom"}</div>
            <div className="text-6xl font-black italic text-[#AFFF25] uppercase leading-none tracking-tighter">{card.lastname || "Nom"}</div>
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
  );
}