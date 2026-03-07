'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ChevronDown, X } from 'lucide-react';
import SET_DATA from '@/data/set.json';

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'F1': { image: 'F1', label: 'Formule 1' },
  'NFL': { image: 'NFL', label: 'Football Américain' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' }
};

export default function CollectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>}>
      <CollectionContent />
    </Suspense>
  );
}

function CollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || searchParams.get('club') || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSport, setSelectedSport] = useState(searchParams.get('sport') || '');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');

  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setCards(data.filter(c => !c.is_wishlist));
    setLoading(false);
  };

  const handleImageLoad = (img: HTMLImageElement, id: string) => {
    if (img.naturalWidth > img.naturalHeight) {
      setHorizontalCards(prev => prev.has(id) ? prev : new Set(prev).add(id));
    }
  };

  const uniquePlayers = Array.from(new Set(cards.map(c => `${c.firstname || ''} ${c.lastname || ''}`.trim()).filter(Boolean)));
  const searchSuggestions = searchTerm.length >= 3 ? uniquePlayers.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase())) : [];

  const filteredCards = cards.filter(card => {
    const searchString = `${card.firstname || ''} ${card.lastname || ''} ${card.club_name || ''}`.toLowerCase();
    const matchesSearch = searchTerm === '' || searchString.includes(searchTerm.toLowerCase());
    const matchesSport = selectedSport === '' || card.sport === selectedSport;
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;
    const matchesBrand = selectedBrand === '' || (card.brand && card.brand.toLowerCase() === selectedBrand.toLowerCase());

    return matchesSearch && matchesSport && matchesSpec && matchesBrand;
  });

  const availableBrands = SET_DATA.brands || [];

  return (
    <div className="min-h-screen bg-[#040221] text-white p-2 pb-36 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      {/* 🚀 LE DEGRADÉ EST DE RETOUR */}
      <div className="absolute top-0 left-0 w-full h-[70px] pointer-events-none -z-10" style={{ background: 'linear-gradient(0deg, #040221 15.71%, #AFFF25 100%)', opacity: 0.8 }}></div>

      <div className="px-4">
        <header className="mb-6 pt-4 text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none drop-shadow-lg">COLLECTION</h1>
        </header>

        <div className="relative mb-4 z-50">
          <Search className="absolute left-4 top-3.5 text-[#AFFF25]" size={18} />
          <input 
            type="text" 
            placeholder="Nom de joueur ou club..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#040221]/60 backdrop-blur-md border border-[#AFFF25] rounded-full py-3 pl-12 pr-10 text-sm outline-none text-white italic placeholder:text-white/40 shadow-[0_0_15px_rgba(175,255,37,0.1)]"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(''); setShowSuggestions(false); }} className="absolute right-4 top-3.5 text-white/50 hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}

          {showSuggestions && searchSuggestions.length > 0 && (
            <ul className="absolute w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl z-50">
              {searchSuggestions.map((name, i) => (
                <li key={i} onClick={() => { setSearchTerm(name); setShowSuggestions(false); }} className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0">
                  <Search className="text-white/30" size={14} />
                  <span className="text-sm font-bold uppercase">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 🚀 LIGNE 1 : MARQUES ET FILTRES */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-[#040221]/60 backdrop-blur-md border border-white/20 rounded-full py-2.5 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white">
              <option value="">TOUTES MARQUES</option>
              {availableBrands.map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="relative flex-1">
            <select value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value)} className="w-full bg-[#040221]/60 backdrop-blur-md border border-white/20 rounded-full py-2.5 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white">
              <option value="">TOUS FILTRES</option>
              <option value="auto">AUTO</option>
              <option value="patch">PATCH</option>
              <option value="rookie">ROOKIE</option>
              <option value="numbered">NUMÉROTÉE</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>
        </div>

        {/* 🚀 LIGNE 2 : SCROLL HORIZONTAL DES SPORTS (GÉLULES) */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide snap-x">
          <button 
            onClick={() => setSelectedSport('')} 
            className={`snap-start whitespace-nowrap px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${selectedSport === '' ? 'bg-[#AFFF25] text-black border-[#AFFF25] shadow-[0_0_15px_rgba(175,255,37,0.4)]' : 'bg-transparent text-white/60 border-white/20 hover:border-white/50'}`}
          >
            TOUT
          </button>
          
          {Object.keys(SPORT_CONFIG).map(key => (
            <button 
              key={key}
              onClick={() => setSelectedSport(key)} 
              className={`snap-start flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${selectedSport === key ? 'bg-[#AFFF25] text-black border-[#AFFF25] shadow-[0_0_15px_rgba(175,255,37,0.4)]' : 'bg-transparent text-white/60 border-white/20 hover:border-white/50'}`}
            >
              {SPORT_CONFIG[key].image && (
                <img 
                  src={`/asset/sports/${SPORT_CONFIG[key].image}.png`} 
                  className={`w-4 h-4 object-contain ${selectedSport === key ? 'brightness-0' : ''}`} // Passe en noir si sélectionné
                  alt={SPORT_CONFIG[key].label} 
                />
              )}
              {SPORT_CONFIG[key].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>
      ) : (
        <div className="grid grid-cols-3 gap-2 grid-flow-dense px-2">
          {filteredCards.map((card) => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div 
                key={card.id} 
                onClick={() => router.push(`/card/${card.id}`)}
                style={{ borderRadius: '12px' }}
                className={`relative overflow-hidden border border-white/10 cursor-pointer active:scale-95 transition-all group flex items-center justify-center ${isHorizontal ? 'col-span-2 aspect-[1.55] bg-[#080531]' : 'col-span-1 aspect-[3/4] bg-white/5'}`}
              >
                {card.image_url ? (
                  <img src={card.image_url} loading="lazy" decoding="async" onLoad={(e) => handleImageLoad(e.currentTarget, card.id)} className="w-full h-full object-cover" alt="Card" />
                ) : (
                  <div className="text-[10px] italic font-bold text-white/30">No Image</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}