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

const SPORT_FOLDERS: Record<string, string> = {
  'SOCCER': 'foot', 
  'BASKETBALL': 'NBA',
  'BASEBALL': 'MLB',
  'NFL': 'NFL',
  'NHL': 'NHL'
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
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', 
    transition: 'transform 0.3s ease-out' 
  });
  const [glareStyle, setGlareStyle] = useState({ 
    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0%, transparent 50%)', 
    opacity: 0,
    transition: 'opacity 0.3s ease-out'
  });
  
  const [showGyroOverlay, setShowGyroOverlay] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCard(); }, [cardId]);

  const fetchCard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login'); 
    
    const { data } = await supabase.from('cards').select('*').eq('id', cardId).eq('user_id', user.id).single();
    if (data) {
      setCard(data);
      setIsHorizontal(data.is_horizontal || false);
    } 
    else router.push('/collection');
    
    setLoading(false);
  };

  // ==========================================
  // 🧭 GYROSCOPE (Compatibilité iOS & Android)
  // ==========================================
  useEffect(() => {
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const savedPermission = localStorage.getItem('gyro_permission');
        if (savedPermission === 'granted') {
          startGyro();
        } else {
          setShowGyroOverlay(true);
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
          setShowGyroOverlay(false);
          startGyro();
        }
      }
    } catch (e) { 
      console.error("Erreur de permission gyroscope :", e); 
    }
  };

  const startGyro = () => { 
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true); 
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (!e || e.gamma === null || e.beta === null) return;
    
    let x = e.gamma; 
    let y = e.beta;  
    
    let adjustedY = y - 45;

    const maxTilt = 25;
    x = Math.max(-maxTilt, Math.min(maxTilt, x));
    adjustedY = Math.max(-maxTilt, Math.min(maxTilt, adjustedY)); 

    const rotateY = x * 0.8; 
    const rotateX = -adjustedY * 0.8;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`,
      transition: 'transform 0.1s ease-out'
    });

    const glareX = (x / maxTilt) * 100;
    const glareY = (adjustedY / maxTilt) * 100;
    setGlareStyle({
      background: `radial-gradient(circle at ${50 + glareX}% ${50 + glareY}%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
      opacity: Math.max(0.1, Math.abs(x) / maxTilt),
      transition: 'opacity 0.1s ease-out'
    });
  };

  // ==========================================
  // 👆 TACTILE & SOURIS (Fallback)
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

  // ==========================================
  // RECHERCHE EBAY INTELLIGENTE
  // ==========================================
  const checkEbayPrices = (soldOnly: boolean = true) => {
    if (!card) return;

    // Règle de formatage de l'année (ex: 2024 devient 2023-24)
    let formattedYear = card.year;
    if (card.year && /^\d{4}$/.test(card.year.toString())) {
      const yearNum = parseInt(card.year, 10);
      const prevYear = yearNum - 1;
      const shortYear = card.year.toString().slice(-2);
      formattedYear = `${prevYear}-${shortYear}`;
    }

    // Construction dynamique des mots-clés
    const keywords = [
      card.firstname, 
      card.lastname, 
      formattedYear, 
      card.brand, 
      card.series,
      card.is_auto ? 'auto' : '',
      card.is_patch ? 'patch' : '',
      (card.is_numbered && card.numbering_max) ? `/${card.numbering_max}` : '' 
    ].filter(Boolean).join(' ');

    const searchQuery = encodeURIComponent(keywords);
    let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}`;

    if (soldOnly) {
      ebayUrl += '&LH_Sold=1&LH_Complete=1';
    }

    window.open(ebayUrl, '_blank');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#040221]"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;
  if (!card) return null;

  const sportData = SPORT_CONFIG[card.sport] || { image: 'Soccer', label: card.sport || 'Sport' };
  const sportFolder = SPORT_FOLDERS[card.sport] || 'foot'; 
  
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
      <div className={`fixed ${isHorizontal ? 'top-[150px]' : 'top-[16px]'} left-0 w-full flex flex-col items-center justify-center z-10 perspective-[1000px] pointer-events-none px-6 transition-all duration-300`}>
        
        {/* LE CONTENEUR DE LA CARTE AVEC REF */}
        <div 
          ref={cardRef}
          style={{ ...tiltStyle, transformStyle: 'preserve-3d', borderRadius: '12px' }} 
          className="relative flex items-center justify-center max-w-full shadow-[0_20px_60px_rgba(0,0,0,0.6)] cursor-crosshair pointer-events-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleLeave}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleLeave}
          onTouchCancel={handleLeave}
        >
          {card.image_url ? (
            <img 
              src={card.image_url} 
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth > e.currentTarget.naturalHeight) {
                  setIsHorizontal(true);
                }
              }}
              style={{ borderRadius: '12px', pointerEvents: 'none' }} 
              className="w-auto h-auto max-w-full max-h-[420px] object-contain border border-white/10 relative z-10" 
              alt="Card" 
            />
          ) : (
            <div className="w-[250px] h-[350px] bg-white/5 flex items-center justify-center pointer-events-none rounded-[12px] relative z-10">No Image</div>
          )}
          
          {/* L'EFFET DE REFLET (GLARE) */}
          <div className="absolute inset-0 pointer-events-none rounded-[12px] mix-blend-overlay z-20" style={glareStyle}></div>

          {/* 📱 LE LAYER D'AUTORISATION POUR iOS */}
          {showGyroOverlay && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#040221]/80 backdrop-blur-md rounded-[12px] border border-[#AFFF25]/30 p-6 text-center shadow-xl">
              <Smartphone size={32} className="text-[#AFFF25] mb-3 animate-pulse" />
              <p className="text-white text-xs font-bold mb-5 px-2">Active le gyroscope pour profiter de l'effet 3D</p>
              <button 
                onClick={requestGyroPermission} 
                className="pointer-events-auto px-6 py-3 bg-[#AFFF25] text-[#040221] rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(175,255,37,0.4)] active:scale-95 transition-transform"
              >
                Activer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 📄 SECTION INFORMATIONS */}
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

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {card.is_patch && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Patch</span>}
          {card.is_auto && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Autographe</span>}
          {card.is_numbered && <span className="px-3 py-1 bg-[#10243E] border border-[#1E3A8A] rounded-full text-[11px] font-bold text-white">Numéroté</span>}
        </div>

        {/* Sport, Club et Numérotation alignés */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => router.push(`/collection?sport=${card.sport}`)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10">
              <img src={`/asset/sports/${sportData.image}.png`} className="w-4 h-4 object-contain" alt={sportData.label} />
              <span className="text-sm font-medium text-white">{sportData.label}</span>
            </button>
            {card.club_name && (
              <button onClick={() => router.push(`/club/${clubSlug}`)} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#AFFF25]/50 hover:bg-[#AFFF25]/10">
                <img src={`/asset/logo-club/${sportFolder}/${clubSlug}.svg`} className="w-4 h-4 object-contain" alt={card.club_name} onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="text-sm font-medium text-white">{card.club_name}</span>
              </button>
            )}
          </div>
          
          {/* Affichage du Numéro de carte (Set) et de la Numérotation (Série) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Numéro de la carte dans la série (ex: N° 45) */}
            {card.print_number && (
              <div className="text-sm font-bold text-white/60">
                N° {card.print_number}
              </div>
            )}

            {/* Numérotation de la carte (ex: 25/99) en jaune fluo avec numbering_low */}
            {card.is_numbered && card.numbering_max && (
              <div className="text-base font-medium text-[#AFFF25] whitespace-nowrap">
                {card.numbering_low ? `${card.numbering_low}/` : ''}{card.numbering_max}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-6 pt-6 border-t border-white/10">
          <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Brand</div><div className="text-lg font-bold text-white capitalize">{card.brand || "-"}</div></div>
          <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Set</div><div className="text-lg font-bold text-white capitalize">{card.series || "-"}</div></div>
          <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Année</div><div className="text-lg font-bold text-white">{card.year || "-"}</div></div>
          <div><div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Prix payé</div><div className="text-lg font-bold text-white">{card.purchase_price ? `${card.purchase_price}€` : "-"}</div></div>
        </div>

        {/* BOUTONS D'ACTION (Website + eBay) */}
        <div className="pt-8 flex flex-col gap-4 pb-6 items-center">
          
          {/* Les 2 boutons eBay sur la même ligne avec une police réduite (0.675rem) */}
          <div className="flex gap-3 w-full max-w-[320px]">
            <button 
              onClick={() => checkEbayPrices(true)} 
              className="flex-1 bg-[#AFFF25] text-[#040221] py-3.5 rounded-full font-black uppercase tracking-widest text-[0.675rem] hover:bg-[#9ee615] active:scale-95 transition-transform flex items-center justify-center shadow-[0_0_15px_rgba(175,255,37,0.3)]"
            >
              Ventes réussies
            </button>
            
            <button 
              onClick={() => checkEbayPrices(false)} 
              className="flex-1 bg-[#AFFF25] text-[#040221] py-3.5 rounded-full font-black uppercase tracking-widest text-[0.675rem] hover:bg-[#9ee615] active:scale-95 transition-transform flex items-center justify-center shadow-[0_0_15px_rgba(175,255,37,0.3)]"
            >
              Ventes en cours
            </button>
          </div>

          {/* Bouton vers le site web (s'il existe) */}
          {card.website_url && (
            <button 
              onClick={() => window.open(card.website_url, '_blank')} 
              className="w-full max-w-[320px] border-2 border-[#AFFF25]/30 text-[#AFFF25] py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#AFFF25]/10 active:scale-95 transition-transform"
            >
              Voir sur le site
            </button>
          )}

        </div>
      </div>
    </div>
  );
}