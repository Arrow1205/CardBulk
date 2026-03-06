'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronDown, Plus } from 'lucide-react';

import SET_DATA from '@/data/set.json';

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

export default function WishlistPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');

  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 🚀 On ne récupère QUE les cartes de la Wishlist
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_wishlist', true)
      .order('created_at', { ascending: false });

    if (data) setCards(data);
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

  const filteredCards = cards.filter(card => {
    const matchesSport = selectedSport === '' || card.sport === selectedSport;
    
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;

    const matchesBrand = selectedBrand === '' || (card.brand && card.brand.toLowerCase() === selectedBrand.toLowerCase());

    return matchesSport && matchesSpec && matchesBrand;
  });

  const availableBrands = SET_DATA.brands || [];
  const sportImage = selectedSport ? SPORT_CONFIG[selectedSport]?.image : null;

  return (
    <div className="min-h-screen bg-[#040221] text-white p-2 pb-36 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      {/* 🚀 LE HALO VERT EN HAUT */}
      <div className="absolute top-0 left-0 w-full h-[450px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#AFFF25]/40 via-transparent to-transparent pointer-events-none -z-10"></div>

      <div className="px-4">
        <header className="pt-8 pb-8 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none drop-shadow-lg">WISHLIST</h1>
        </header>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            {sportImage && <img src={`/asset/sports/${sportImage}.png`} className="absolute left-4 top-2.5 w-4 h-4 object-contain z-10" alt="Sport" />}
            <select 
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className={`w-full bg-[#040221]/60 backdrop-blur-xl border border-white/20 rounded-full py-2.5 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg ${sportImage ? 'pl-10' : 'pl-4'}`}
            >
              <option value="">TOUS SPORTS</option>
              {Object.keys(SPORT_CONFIG).map(key => (
                <option key={key} value={key}>{SPORT_CONFIG[key].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="relative flex-1">
            <select 
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className="w-full bg-[#040221]/60 backdrop-blur-xl border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg"
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

        <div className="flex gap-2 overflow-x-auto pb-6 [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setSelectedBrand('')}
            className={`flex-shrink-0 px-5 h-9 rounded-full text-xs font-black italic uppercase transition-all shadow-lg ${
              selectedBrand === '' 
                ? 'bg-[#AFFF25] text-black shadow-[0_0_15px_rgba(175,255,37,0.3)]' 
                : 'bg-[#040221]/60 backdrop-blur-xl text-white border border-white/20'
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
                className={`flex-shrink-0 h-9 px-4 rounded-full flex items-center justify-center transition-all border shadow-lg ${
                  isSelected 
                    ? 'border-[#AFFF25] bg-[#AFFF25]/20 shadow-[0_0_15px_rgba(175,255,37,0.2)]' 
                    : 'border-white/20 bg-[#040221]/60 backdrop-blur-xl'
                }`}
              >
                <img 
                  src={`/asset/brands/${brandSlug}.png`} 
                  alt={b.name} 
                  className="h-4 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                  }}
                />
                <span className="text-[10px] font-black italic uppercase hidden">{b.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 grid-flow-dense px-2">
          
          {/* 🚀 BOUTON AJOUTER WISHLIST (Le bloc du début) */}
          <div 
            onClick={() => router.push('/scanner?wishlist=true')}
            className="col-span-1 aspect-[3/4] rounded-xl border-2 border-[#AFFF25] flex items-center justify-center cursor-pointer active:scale-95 transition-all bg-[#AFFF25]/5 hover:bg-[#AFFF25]/20 shadow-[0_0_20px_rgba(175,255,37,0.15)]"
          >
            <div className="w-12 h-12 rounded-full border-2 border-[#AFFF25] flex items-center justify-center">
              <Plus size={28} className="text-[#AFFF25]" />
            </div>
          </div>

          {/* LA GRILLE DES CARTES */}
          {filteredCards.map((card) => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div 
                key={card.id} 
                onClick={() => router.push(`/card/${card.id}`)}
                style={{ borderRadius: '12px' }}
                className={`relative overflow-hidden border border-white/10 cursor-pointer active:scale-95 transition-all group flex items-center justify-center shadow-lg ${
                  isHorizontal ? 'col-span-2 aspect-[1.55] bg-[#080531]/80 backdrop-blur-sm' : 'col-span-1 aspect-[3/4] bg-white/5 backdrop-blur-sm'
                }`}
              >
                {card.image_url ? (
                  <img 
                    src={card.image_url} 
                    alt="Card" 
                    onLoad={(e) => handleImageLoad(e.currentTarget, card.id)}
                    ref={(img) => { if (img && img.complete) handleImageLoad(img, card.id); }}
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