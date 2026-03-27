'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronDown, Plus, ExternalLink } from 'lucide-react';

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'NFL': { image: 'NFL', label: 'Football Am.' },
  'F1': { image: 'F1', label: 'Formule 1' }
};

// Fonction pour extraire le nom du site à partir de l'URL
const getSiteName = (url: string) => {
  if (!url) return '';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('ebay')) return 'eBay';
  if (lowerUrl.includes('vinted')) return 'Vinted';
  if (lowerUrl.includes('cardhobby')) return 'CardHobby';
  
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Lien';
  }
};

export default function WishlistPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id).eq('is_wishlist', true).order('created_at', { ascending: false });
    if (data) setCards(data);
    setLoading(false);
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
        <div className="flex flex-col gap-3 px-4">
          
          <div onClick={() => router.push('/scanner?wishlist=true')} className="w-full py-4 rounded-2xl border-2 border-dashed border-[#AFFF25]/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all bg-[#AFFF25]/5 hover:bg-[#AFFF25]/10 mb-2">
            <Plus size={20} className="text-[#AFFF25]" />
            <span className="text-sm font-bold text-[#AFFF25] uppercase tracking-widest">Ajouter une carte</span>
          </div>

          {filteredCards.length === 0 && (
            <div className="text-center py-10 text-white/40 italic text-sm">Aucune carte dans la wishlist.</div>
          )}

          {filteredCards.map((card) => (
            <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="flex flex-col sm:flex-row gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform shadow-lg group">
              
              <div className="flex gap-4 w-full">
                {/* IMAGE */}
                <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-[#080531] shadow-md border border-white/5 flex items-center justify-center">
                  {card.image_url ? (
                    <img src={card.image_url} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="Card" />
                  ) : (
                    <span className="text-[10px] text-white/30 font-bold italic">N/A</span>
                  )}
                </div>

                {/* INFOS */}
                <div className="flex flex-col justify-center flex-1 overflow-hidden">
                  <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold truncate mb-1">
                    {SPORT_CONFIG[card.sport]?.label || card.sport} • {card.brand} {card.series ? `— ${card.series}` : ''}
                  </div>
                  
                  <div className="text-xl font-black italic text-[#AFFF25] uppercase tracking-tighter leading-none truncate mb-2">
                    {card.firstname} {card.lastname}
                  </div>

                  {/* SPÉCIFICITÉS */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {card.is_patch && <span className="px-2 py-0.5 bg-[#AFFF25]/10 border border-[#AFFF25]/30 rounded-md text-[9px] font-bold text-[#AFFF25] uppercase">Patch</span>}
                    {card.is_auto && <span className="px-2 py-0.5 bg-[#AFFF25]/10 border border-[#AFFF25]/30 rounded-md text-[9px] font-bold text-[#AFFF25] uppercase">Auto</span>}
                    {card.is_numbered && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white uppercase">Num {card.numbering_max ? `/ ${card.numbering_max}` : ''}</span>}
                    {card.is_graded && <span className="px-2 py-0.5 bg-[#2544ff]/20 border border-[#2544ff]/50 rounded-md text-[9px] font-bold text-white uppercase">{card.grading_company} {card.grading_grade}</span>}
                  </div>

                  <div className="text-base font-black text-white">
                    {card.purchase_price ? `${card.purchase_price} €` : '-- €'}
                  </div>
                </div>
              </div>

              {/* BOUTON ACHAT */}
              {card.website_url && (
                <div className="sm:self-center mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(card.website_url, '_blank'); }} 
                    className="w-full sm:w-auto px-4 py-3 sm:py-2.5 bg-[#AFFF25] text-[#040221] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#9ee615] active:scale-95 transition-all shadow-[0_0_15px_rgba(175,255,37,0.2)] flex items-center justify-center gap-2"
                  >
                    Aller sur {getSiteName(card.website_url)} <ExternalLink size={14} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}