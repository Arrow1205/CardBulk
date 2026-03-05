'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ChevronDown } from 'lucide-react';

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

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');

  // Mémoire pour savoir quelles cartes sont horizontales
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

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erreur Supabase:", error.message);
    } else if (data) {
      setCards(data);
    }
    setLoading(false);
  };

  // Vérifie les proportions de l'image quand elle a fini de charger
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>, id: string) => {
    const img = e.currentTarget;
    if (img.naturalWidth > img.naturalHeight) {
      setHorizontalCards(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    }
  };

  const uniquePlayers = Array.from(
    new Set(cards.map(c => `${c.firstname || ''} ${c.lastname || ''}`.trim()).filter(Boolean))
  );

  const searchSuggestions = searchTerm.length >= 3 
    ? uniquePlayers.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const filteredCards = cards.filter(card => {
    const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
    const matchesSearch = searchTerm === '' || fullName.includes(searchTerm.toLowerCase());
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
  const sportImage = selectedSport ? SPORT_CONFIG[selectedSport]?.image : null;

  return (
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      <header className="mb-6 pt-4 text-center">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">COLLECTION</h1>
      </header>

      <div className="relative mb-4 z-50">
        <Search className="absolute left-4 top-3.5 text-[#AFFF25]" size={18} />
        <input 
          type="text" 
          placeholder="Enter player name" 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full bg-[#040221] border border-[#AFFF25] rounded-full py-3 pl-12 pr-4 text-sm outline-none text-white italic placeholder:text-white/40 shadow-[0_0_15px_rgba(175,255,37,0.1)] transition-colors focus:shadow-[0_0_20px_rgba(175,255,37,0.3)]"
        />
        
        {showSuggestions && searchSuggestions.length > 0 && (
          <ul className="absolute w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl z-50">
            {searchSuggestions.map((name, i) => (
              <li 
                key={i} 
                onClick={() => {
                  setSearchTerm(name);
                  setShowSuggestions(false);
                }}
                className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
              >
                <Search className="text-white/30" size={14} />
                <span className="text-sm font-bold uppercase">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          {sportImage && <img src={`/asset/sports/${sportImage}.png`} className="absolute left-4 top-2.5 w-4 h-4 object-contain z-10" alt="Sport" />}
          <select 
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className={`w-full bg-[#040221] border border-white/20 rounded-full py-2.5 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white ${sportImage ? 'pl-10' : 'pl-4'}`}
          >
            <option value="">TOUS SPORTS</option>
            <option value="SOCCER">FOOTBALL</option>
            <option value="BASKETBALL">BASKETBALL</option>
            <option value="BASEBALL">BASEBALL</option>
            <option value="F1">FORMULE 1</option>
            <option value="NFL">NFL</option>
            <option value="NHL">NHL</option>
            <option value="TENNIS">TENNIS</option>
            <option value="POKEMON">POKÉMON</option>
            <option value="MARVEL">MARVEL</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
        </div>

        <div className="relative flex-1">
          <select 
            value={selectedSpec}
            onChange={(e) => setSelectedSpec(e.target.value)}
            className="w-full bg-[#040221] border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white"
          >
            <option value="">FILTRER PAR...</option>
            <option value="auto">AUTO</option>
            <option value="patch">PATCH</option>
            <option value="rookie">ROOKIE</option>
            <option value="numbered">NUMÉROTÉE</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 [&::-webkit-scrollbar]:hidden">
        <button 
          onClick={() => setSelectedBrand('')}
          className={`flex-shrink-0 px-5 h-9 rounded-full text-xs font-black italic uppercase transition-all ${
            selectedBrand === '' 
              ? 'bg-[#AFFF25] text-black shadow-[0_0_15px_rgba(175,255,37,0.3)]' 
              : 'bg-[#040221] text-white border border-white/20'
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
                  : 'border-white/20 bg-[#040221]'
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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center mt-20 space-y-4">
          <p className="text-white/40 italic font-bold">Aucune carte trouvée.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 auto-rows-max grid-flow-dense">
          {filteredCards.map((card) => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div 
                key={card.id} 
                onClick={() => router.push(`/card/${card.id}`)}
                className={`relative rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-all group ${
                  isHorizontal ? 'col-span-2 aspect-[4/3]' : 'col-span-1 aspect-[3/4]'
                }`}
              >
                {card.image_url ? (
                  <img 
                    src={card.image_url} 
                    alt="Card" 
                    onLoad={(e) => handleImageLoad(e, card.id)}
                    ref={(img) => {
                      if (img && img.complete) {
                        handleImageLoad({ currentTarget: img } as any, card.id);
                      }
                    }}
                    className="w-full h-full object-cover" 
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