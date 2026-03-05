'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, ChevronDown } from 'lucide-react';

import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import SET_DATA from '@/data/set.json';

export default function ClubPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');

  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  // Récupérer le vrai nom du club depuis le JSON grâce au slug
  const safeFootballClubs = Array.isArray(FOOTBALL_CLUBS) ? FOOTBALL_CLUBS : [];
  const clubObj = safeFootballClubs.find((c: any) => c.slug === slug);
  const clubName = clubObj ? clubObj.name : slug.replace(/-/g, ' ');

  useEffect(() => {
    fetchClubCards();
  }, [clubName]);

  const fetchClubCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 🚀 On cherche uniquement les cartes de ce club (ilike ignore les majuscules/minuscules)
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .ilike('club_name', clubName)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erreur Supabase:", error.message);
    } else if (data) {
      setCards(data);
    }
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

  // Liste des joueurs uniques du club pour le menu déroulant
  const uniquePlayers = Array.from(
    new Set(cards.map(c => `${c.firstname || ''} ${c.lastname || ''}`.trim()).filter(Boolean))
  );

  const filteredCards = cards.filter(card => {
    const fullName = `${card.firstname || ''} ${card.lastname || ''}`.trim();
    const matchesPlayer = selectedPlayer === '' || fullName === selectedPlayer;
    
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;

    const matchesBrand = selectedBrand === '' || (card.brand && card.brand.toLowerCase() === selectedBrand.toLowerCase());

    return matchesPlayer && matchesSpec && matchesBrand;
  });

  const availableBrands = SET_DATA.brands || [];

  return (
    <div className="min-h-screen text-white pb-36 overflow-x-hidden font-sans relative z-10">
      
      {/* 🚀 LE FAMEUX EFFET "AURA" DYNAMIQUE (Flou du logo en arrière-plan) */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        {/* Aura Haut (Couleur primaire) */}
        <img src={`/asset/logo-club/${slug}.svg`} className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[120%] h-auto opacity-50 blur-[100px]" />
        {/* Aura Bas (Couleur secondaire) */}
        <img src={`/asset/logo-club/${slug}.svg`} className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[150%] h-auto opacity-40 blur-[130px] rotate-180" />
        {/* Fondre avec le bleu de l'app en descendant */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040221]/10 via-[#040221]/60 to-[#040221]"></div>
      </div>

      <header className="flex items-center justify-between p-6">
        <button onClick={() => router.back()} className="w-10 h-10 bg-[#040221]/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
          <ChevronLeft size={20} />
        </button>
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* ZONE LOGO ET TITRE */}
      <div className="px-6 flex flex-col items-center mb-8">
        <img 
          src={`/asset/logo-club/${slug}.svg`} 
          alt={clubName} 
          className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-6 animate-in fade-in zoom-in duration-500" 
        />
        <h1 className="text-4xl text-center font-black italic uppercase tracking-tighter leading-none w-full">
          {clubName}
        </h1>
      </div>

      {/* FILTRES */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <select 
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full bg-[#040221]/80 backdrop-blur-md border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white"
            >
              <option value="">TOUS LES JOUEURS</option>
              {uniquePlayers.map(player => (
                <option key={player} value={player}>{player}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="relative w-1/3">
            <select 
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className="w-full bg-[#040221]/80 backdrop-blur-md border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white"
            >
              <option value="">FILTRES</option>
              <option value="auto">AUTO</option>
              <option value="patch">PATCH</option>
              <option value="rookie">ROOKIE</option>
              <option value="numbered">NUMÉROTÉE</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setSelectedBrand('')}
            className={`flex-shrink-0 px-5 h-9 rounded-full text-xs font-black italic uppercase transition-all ${
              selectedBrand === '' 
                ? 'bg-[#AFFF25] text-black shadow-[0_0_15px_rgba(175,255,37,0.3)]' 
                : 'bg-[#040221]/80 backdrop-blur-md text-white border border-white/20'
            }`}
          >
            Tout
          </button>
          
          {availableBrands.map((b: any, i: number) => {
            const brandSlug = b.name.toLowerCase().replace(/\s+/g, '-');
            const isSelected = selectedBrand === b.name;
            return (
              <button 
                key={i}
                onClick={() => setSelectedBrand(b.name)}
                className={`flex-shrink-0 h-9 px-4 rounded-full flex items-center justify-center transition-all border ${
                  isSelected 
                    ? 'border-[#AFFF25] bg-[#AFFF25]/10 shadow-[0_0_15px_rgba(175,255,37,0.2)]' 
                    : 'border-white/20 bg-[#040221]/80 backdrop-blur-md'
                }`}
              >
                <img 
                  src={`/asset/brands/${brandSlug}.png`} 
                  alt={b.name} 
                  className="h-4 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                  }}
                />
                <span className="text-[10px] font-black italic uppercase hidden">{b.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* GRILLE DE CARTES */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center mt-20 space-y-4">
          <p className="text-white/40 italic font-bold">Aucune carte trouvée pour ce club.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 grid-flow-dense px-4">
          {filteredCards.map((card) => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div 
                key={card.id} 
                onClick={() => router.push(`/card/${card.id}`)}
                style={{ borderRadius: '12px' }}
                className={`relative overflow-hidden border border-white/10 cursor-pointer active:scale-95 transition-all group flex items-center justify-center ${
                  isHorizontal ? 'col-span-2 aspect-[1.55] bg-[#080531]' : 'col-span-1 aspect-[3/4] bg-white/5'
                }`}
              >
                {card.image_url ? (
                  <img 
                    src={card.image_url} 
                    alt="Card" 
                    onLoad={(e) => handleImageLoad(e.currentTarget, card.id)}
                    ref={(img) => {
                      if (img && img.complete) handleImageLoad(img, card.id);
                    }}
                    className={`w-full h-full ${isHorizontal ? 'object-contain p-1' : 'object-cover'}`} 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20 p-2 text-center bg-[#080531]">
                    <span className="text-[10px] italic font-bold leading-tight">No Image</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}