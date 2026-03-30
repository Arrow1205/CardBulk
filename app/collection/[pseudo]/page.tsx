'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, SlidersHorizontal, Star, Award, ShieldCheck, Layers3, ChevronLeft } from 'lucide-react';

import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import BASKETBALL_CLUBS from '@/data/basketball-clubs.json';
import BASEBALL_CLUBS from '@/data/baseball-clubs.json';

const SPORT_CONFIG: Record<string, { image: string, folder: string, label: string }> = {
  'SOCCER': { image: 'Soccer', folder: 'foot', label: 'Football' },
  'BASKETBALL': { image: 'Basket', folder: 'NBA', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', folder: 'MLB', label: 'Baseball' },
  'F1': { image: 'F1', folder: 'f1', label: 'F1' },
  'NFL': { image: 'NFL', folder: 'NFL', label: 'NFL' },
  'NHL': { image: 'NHL', folder: 'NHL', label: 'NHL' },
  'TENNIS': { image: 'Tennis', folder: 'tennis', label: 'Tennis' }
};

const CLUB_DATA: Record<string, any[]> = {
  'SOCCER': FOOTBALL_CLUBS,
  'BASKETBALL': BASKETBALL_CLUBS,
  'BASEBALL': BASEBALL_CLUBS,
};

type PublicCard = {
  id: string; sport: string; firstname: string; lastname: string; club_name: string; brand: string; series: string; variation: string; year: number; numbering_max: number | null; image_url: string; image_url_back: string | null; is_rookie: boolean; is_auto: boolean; is_patch: boolean; is_graded: boolean; grading_company: string | null; grading_grade: string | null; club_slug?: string;
};

type OwnerProfile = {
  full_name: string | null;
  pseudo: string | null;
};

export default function PublicCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const pseudo = params.pseudo as string;

  const [cards, setCards] = useState<PublicCard[]>([]);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSport, setActiveSport] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ rookie: false, auto: false, patch: false, graded: false, numbered: false });

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!pseudo) return;

      const { data: ownerId, error: ownerError } = await supabase.rpc('get_user_id_by_pseudo', { p_pseudo: pseudo });

      if (ownerError || !ownerId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const publicColumns = 'id, sport, firstname, lastname, club_name, brand, series, variation, year, numbering_max, image_url, image_url_back, is_rookie, is_auto, is_patch, is_graded, grading_company, grading_grade';

      const [profileRes, cardsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, pseudo').eq('id', ownerId).single(),
        supabase.from('cards')
          .select(publicColumns)
          .eq('user_id', ownerId)
          .eq('is_wishlist', false)
          .order('year', { ascending: false })
      ]);

      if (profileRes.data) setOwner(profileRes.data);
      
      if (cardsRes.data) {
        const enhancedCards = cardsRes.data.map(card => {
          if (!card.club_name || !CLUB_DATA[card.sport]) return card;
          const club = CLUB_DATA[card.sport].find(c => c.name.toLowerCase().trim() === card.club_name.toLowerCase().trim());
          return { ...card, club_slug: club ? club.slug : null };
        });
        setCards(enhancedCards);
      }
      setLoading(false);
    };
    fetchPublicData();
  }, [pseudo]);

  const sportsPresent = ['ALL', ...Array.from(new Set(cards.map(c => c.sport)))];

  const filteredCards = cards.filter(card => {
    const searchMatch = searchTerm === '' || `${card.firstname} ${card.lastname} ${card.club_name} ${card.brand} ${card.series} ${card.year}`.toLowerCase().includes(searchTerm.toLowerCase());
    const sportMatch = activeSport === 'ALL' || card.sport === activeSport;
    const rookieMatch = !filters.rookie || card.is_rookie;
    const autoMatch = !filters.auto || card.is_auto;
    const patchMatch = !filters.patch || card.is_patch;
    const gradedMatch = !filters.graded || card.is_graded;
    const numberedMatch = !filters.numbered || card.numbering_max !== null;
    return searchMatch && sportMatch && rookieMatch && autoMatch && patchMatch && gradedMatch && numberedMatch;
  });

  const stats = {
    total: cards.length,
    auto: cards.filter(c => c.is_auto).length,
    patch: cards.filter(c => c.is_patch).length,
    graded: cards.filter(c => c.is_graded).length,
    graded10: cards.filter(c => c.grading_grade === '10' || c.grading_grade === '10+').length,
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  if (notFound) return (
    <div className="min-h-screen bg-[#040221] text-white flex flex-col items-center justify-center p-6 text-center">
      <Layers3 size={60} className="text-red-500 mb-6" />
      <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter mb-2">Collection Introuvable</h1>
      <p className="text-white/60 mb-8">La vitrine associée au pseudo "{pseudo}" n'existe pas ou est privée.</p>
      <button onClick={() => router.push('/')} className="bg-[#AFFF25] text-[#040221] px-8 py-3 rounded-full font-bold uppercase text-sm active:scale-95 transition-all">Retour à l'accueil</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-20">
      
      <header className="flex items-center justify-between px-6 pt-12 pb-6 sticky top-0 bg-[#040221]/90 backdrop-blur-sm z-40">
        <div className='flex items-center gap-3'>
            <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white active:scale-95 transition-all border border-white/10">
                <ChevronLeft size={20} />
            </button>
            <div className="flex-col">
                <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter">Vitrine</h1>
                <p className='text-xs text-[#AFFF25] font-bold tracking-widest uppercase'>de @{owner?.pseudo || pseudo}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0A072E] flex items-center justify-center border border-[#AFFF25]/30 shadow-[0_0_15px_rgba(175,255,37,0.2)]">
            <Layers3 size={24} className="text-[#AFFF25]" />
          </div>
        </div>
      </header>

      <section className="px-6 mb-8 mt-2 scrollbar-hide overflow-x-auto">
        <div className="flex items-center gap-2.5 pb-2">
          {sportsPresent.map(sport => (
            <button key={sport} onClick={() => setActiveSport(sport)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full border whitespace-nowrap transition-all duration-300 text-xs font-bold uppercase tracking-wider ${activeSport === sport ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25] shadow-[0_0_15px_rgba(175,255,37,0.5)]' : 'bg-[#0A072E] text-white/70 border-white/10 hover:border-white/30 hover:text-white'}`}>
              {sport !== 'ALL' && SPORT_CONFIG[sport] && <img src={`/asset/sports/${SPORT_CONFIG[sport].image}.png`} alt={sport} className="w-4 h-4 object-contain" />}
              {sport === 'ALL' ? 'Toutes' : SPORT_CONFIG[sport]?.label || sport}
            </button>
          ))}
        </div>
      </section>

      <section className="px-6 mb-10 grid grid-cols-2 gap-4">
        {[ { label: 'Cartes', value: stats.total.toLocaleString(), icon: Layers3 }, { label: 'Autographes', value: stats.auto, icon: Award }, { label: 'Mémos / Patchs', value: stats.patch, icon: Layers3 }, { label: 'Gradées 10', value: stats.graded10, icon: ShieldCheck, highlight: true } ].map((stat, i) => (
          <div key={i} className={`bg-[#0A072E] p-5 rounded-2xl border ${stat.highlight ? 'border-[#AFFF25]/50 shadow-[0_0_20px_rgba(175,255,37,0.15)]' : 'border-white/5'} flex items-start gap-4`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.highlight ? 'bg-[#AFFF25]/10 text-[#AFFF25]' : 'bg-white/5 text-white/50'}`}><stat.icon size={20} /></div>
            <div><p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">{stat.label}</p><p className={`text-2xl font-black italic uppercase leading-none ${stat.highlight ? 'text-[#AFFF25]' : 'text-white'}`}>{stat.value}</p></div>
          </div>
        ))}
      </section>

      <section className="px-6 mb-8 sticky top-[108px] z-30 bg-[#040221] py-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            <input type="text" placeholder="Chercher dans cette vitrine..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A072E] border border-white/10 p-4 pl-12 rounded-full text-sm outline-none focus:border-[#AFFF25]/50 focus:bg-[#080531] transition-all" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${showFilters ? 'bg-[#AFFF25] border-[#AFFF25] text-[#040221]' : 'bg-[#0A072E] border-white/10 text-white/70 hover:border-white/30'}`}><SlidersHorizontal size={18} /></button>
        </div>
        {showFilters && (
          <div className="bg-[#0A072E] border border-white/10 rounded-2xl p-5 mt-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold uppercase tracking-wider text-white">Filtres rapides</h3><button onClick={() => setFilters({ rookie: false, auto: false, patch: false, graded: false, numbered: false })} className="text-xs text-[#AFFF25] font-bold">Réinitialiser</button></div>
            <div className="flex flex-wrap gap-2.5">
              {[ { key: 'rookie', label: 'Rookie', icon: Star }, { key: 'auto', label: 'Auto', icon: Award }, { key: 'patch', label: 'Patch / Mémo', icon: Layers3 }, { key: 'numbered', label: 'Numérotée', icon: Layers3 }, { key: 'graded', label: 'Gradée', icon: ShieldCheck } ].map(filter => (
                <button key={filter.key} onClick={() => setFilters(prev => ({ ...prev, [filter.key]: !prev[filter.key as keyof typeof filters] }))} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all ${filters[filter.key as keyof typeof filters] ? 'bg-[#AFFF25]/10 border-[#AFFF25]/50 text-[#AFFF25]' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10'}`}>
                  <filter.icon size={14} />{filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {filteredCards.length > 0 ? filteredCards.map(card => (
          <div key={card.id} className="bg-[#0A072E] rounded-2xl overflow-hidden border border-white/5 group transform transition-all duration-300 hover:border-[#AFFF25]/30 hover:-translate-y-1 relative aspect-[3/4]">
            <img src={card.image_url} alt={`${card.firstname} ${card.lastname}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end">
              <div className="flex items-center gap-2 mb-2">
                {card.club_slug && SPORT_CONFIG[card.sport] && (
                  <img src={`/asset/logo-club/${SPORT_CONFIG[card.sport].folder}/${card.club_slug}.svg`} alt={card.club_name} className="w-5 h-5 object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                )}
                <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider truncate">{card.club_name || card.sport}</p>
              </div>
              <p className="text-lg font-black italic uppercase leading-tight text-white mb-0.5 truncate">{card.firstname}<br />{card.lastname}</p>
              <p className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest truncate">{card.year} • {card.brand} {card.series}</p>
              {(card.is_rookie || card.is_auto || card.is_graded) && (
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  {card.is_graded && <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#AFFF25] font-black text-xs shadow-lg">{card.grading_grade}</div>}
                  {card.is_rookie && <div className="w-7 h-7 rounded-full bg-[#AFFF25] flex items-center justify-center text-[#040221] shadow-lg"><Star size={14} fill="#040221" /></div>}
                  {card.is_auto && <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white shadow-lg"><Award size={14} /></div>}
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-2 sm:col-span-3 md:col-span-4 text-center py-20 bg-[#0A072E] rounded-2xl border border-dashed border-white/10">
            <Layers3 size={40} className="text-white/20 mx-auto mb-4" />
            <p className="text-white/50 font-medium">Cette vitrine est vide pour le moment.</p>
          </div>
        )}
      </section>
    </div>
  );
}