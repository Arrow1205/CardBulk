'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronDown, Plus, Check } from 'lucide-react';
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

export default function WishlistPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id).eq('is_wishlist', true).order('created_at', { ascending: false });
    if (data) setCards(data);
    setLoading(false);
  };

  const handleImageLoad = (img: HTMLImageElement, id: string) => {
    if (img.naturalWidth > img.naturalHeight) setHorizontalCards(prev => prev.has(id) ? prev : new Set(prev).add(id));
  };

  const markAsPurchased = async (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation(); 
    await supabase.from('cards').update({ is_wishlist: false, website_url: null }).eq('id', cardId);
    setCards(cards.filter(c => c.id !== cardId));
  };

  const filteredCards = cards.filter(card => {
    const matchesSport = selectedSport === '' || card.sport === selectedSport;
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;
    return matchesSport && matchesSpec;
  });

  const sportImage = selectedSport ? SPORT_CONFIG[selectedSport]?.image : null;

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-32 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      {/* 🚨 HEADER ADAPTÉ : Centré et sans ombre (drop-shadow retiré) 🚨 */}
      <header className="w-full px-6 pb-6 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none text-white">WISHLIST</h1>
      </header>

      <div className="px-4">
        <div className="flex gap-2 mb-8">
          <div className="relative flex-1">
            {sportImage && <img src={`/asset/sports/${sportImage}.png`} className="absolute left-4 top-2.5 w-4 h-4 object-contain z-10" alt="Sport" />}
            <select value={selectedSport} onChange={(e) => setSelectedSport(e.target.value)} className={`w-full bg-[#040221]/60 backdrop-blur-xl border border-white/20 rounded-full py-2.5 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg ${sportImage ? 'pl-10' : 'pl-4'}`}>
              <option value="">TOUS SPORTS</option>
              {Object.keys(SPORT_CONFIG).map(key => <option key={key} value={key}>{SPORT_CONFIG[key].label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="relative flex-1">
            <select value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value)} className="w-full bg-[#040221]/60 backdrop-blur-xl border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg">
              <option value="">FILTRES</option>
              <option value="auto">AUTO</option>
              <option value="patch">PATCH</option>
              <option value="rookie">ROOKIE</option>
              <option value="numbered">NUMÉROTÉE</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>
      ) : (
        <div className="grid grid-cols-3 gap-2 grid-flow-dense px-4">
          <div onClick={() => router.push('/scanner?wishlist=true')} className="col-span-1 aspect-[3/4] rounded-xl border-2 border-[#AFFF25] flex items-center justify-center cursor-pointer active:scale-95 transition-all bg-[#AFFF25]/5 hover:bg-[#AFFF25]/20 shadow-[0_0_20px_rgba(175,255,37,0.15)]">
            <div className="w-12 h-12 rounded-full border-2 border-[#AFFF25] flex items-center justify-center"><Plus size={28} className="text-[#AFFF25]" /></div>
          </div>

          {filteredCards.map((card) => {
            const isHorizontal = horizontalCards.has(card.id);
            return (
              <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} style={{ borderRadius: '12px' }} className={`relative overflow-hidden border border-white/10 cursor-pointer active:scale-95 transition-all group shadow-lg ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'}`}>
                
                <button 
                  onClick={(e) => markAsPurchased(e, card.id)}
                  className="absolute top-2 right-2 z-20 bg-[#AFFF25] text-black px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 hover:bg-white active:scale-90 transition-all"
                >
                  <Check size={10} strokeWidth={4} /> Acheté
                </button>

                {card.image_url ? <img src={card.image_url} loading="lazy" decoding="async" onLoad={(e) => handleImageLoad(e.currentTarget, card.id)} className="w-full h-full object-cover" alt="Card" /> : <div className="text-[10px] italic font-bold">No Image</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}