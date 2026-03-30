'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, X, LayoutGrid, ChevronDown, Euro, Hash, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, Tooltip, Legend, ArcElement } from 'chart.js';

// Initialisation de Chart.js pour le Donut
ChartJS.register(ArcElement, Tooltip, Legend);

const SPORT_ORDER = ['SOCCER', 'TENNIS', 'BASKETBALL', 'BASEBALL', 'NHL', 'NFL', 'F1'];

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'NFL': { image: 'NFL', label: 'Football Am.' },
  'F1': { image: 'F1', label: 'Formule 1' }
};

const BRANDS = ['Panini', 'Topps', 'Upper Deck', 'Leaf', 'Futera'];

export default function StatsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Onglets (Général vs Comparatif)
  const [activeTab, setActiveTab] = useState<'general' | 'comparatif'>('general');

  // Toggle Nombre vs Valeur €
  const [displayMode, setDisplayMode] = useState<'count' | 'value'>('count');

  // Filtres
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showAuto, setShowAuto] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [showNumbered, setShowNumbered] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'brand' | 'spec' | null>(null);

  // Pop-in de détails
  const [activeDetail, setActiveDetail] = useState<'auto' | 'patch' | 'numbered' | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data, error } = await supabase
      .from('cards')
      .select(`
        *,
        card_prices (
          price,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (data) {
      const processedCards = data.map(card => {
        let latestPrice = 0;
        if (card.card_prices && card.card_prices.length > 0) {
          const sortedPrices = card.card_prices.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          latestPrice = parseFloat(sortedPrices[0].price) || 0;
        }
        
        const pPrice = parseFloat(card.purchase_price) || 0;
        
        return {
          ...card,
          // FIX LOGIQUE: Si on n'a pas de prix eBay, on conserve la valeur d'achat pour ne pas fausser le delta
          current_price: latestPrice > 0 ? latestPrice : pPrice 
        };
      });
      
      setCards(processedCards.filter(c => !c.is_wishlist));
    }
    
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const uniqueSports = new Set(cards.map(c => c.sport));
  const availableSports = SPORT_ORDER.filter(sportKey => uniqueSports.has(sportKey));

  const filteredCards = cards.filter(card => {
    const sportMatch = !selectedSport || card.sport === selectedSport;
    const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(card.brand);
    const autoMatch = !showAuto || card.is_auto;
    const patchMatch = !showPatch || card.is_patch;
    const numberedMatch = !showNumbered || card.is_numbered;
    return sportMatch && brandMatch && autoMatch && patchMatch && numberedMatch;
  });

  const getVal = (list: any[]) => displayMode === 'count' ? list.length : list.reduce((acc, c) => acc + (Number(c.purchase_price) || 0), 0);

  // ----------------------------------------------------------------------
  // 1. DATA: SPÉCIFICITÉS & SOUS-CATÉGORIES
  // ----------------------------------------------------------------------
  const autosGlobal = filteredCards.filter(c => c.is_auto);
  const patchesGlobal = filteredCards.filter(c => c.is_patch);
  const numberedsGlobal = filteredCards.filter(c => c.is_numbered);

  const autosSeuls = filteredCards.filter(c => c.is_auto && !c.is_patch);
  const autosPatchs = filteredCards.filter(c => c.is_auto && c.is_patch);
  const patchsSeuls = filteredCards.filter(c => !c.is_auto && c.is_patch);
  const numsSeules = filteredCards.filter(c => !c.is_auto && !c.is_patch && c.is_numbered);
  const numsHits = filteredCards.filter(c => (c.is_auto || c.is_patch) && c.is_numbered);

  const renderSportBreakdown = (subset: any[]) => {
    if (subset.length === 0) return null;
    
    const breakdown = availableSports.map(sport => {
      const sportCards = subset.filter(c => c.sport === sport);
      return { label: SPORT_CONFIG[sport]?.label || sport, value: getVal(sportCards) };
    }).filter(s => s.value > 0).sort((a, b) => b.value - a.value);

    if (breakdown.length === 0) return null;

    return (
      <div className="pl-3 mt-2 space-y-1.5 border-l-2 border-[#AFFF25]/30">
        {breakdown.map((b, i) => (
          <div key={i} className="flex justify-between items-center text-xs text-white/70">
            <span>↳ {b.label}</span>
            <span className="font-bold text-[#AFFF25]/80">
              {displayMode === 'value' ? `${b.value.toLocaleString('fr-FR')} €` : b.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ----------------------------------------------------------------------
  // 2. DATA: RÉPARTITION PAR SPORT (Donut)
  // ----------------------------------------------------------------------
  const sportStats = availableSports.map(sport => {
    const sportCards = filteredCards.filter(c => c.sport === sport);
    return { label: SPORT_CONFIG[sport]?.label || sport, value: getVal(sportCards) };
  }).filter(s => s.value > 0).sort((a, b) => b.value - a.value);

  const doughnutColors = ['#AFFF25', 'rgba(175, 255, 37, 0.7)', 'rgba(175, 255, 37, 0.4)', 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)'];

  const doughnutData = {
    labels: sportStats.map(s => s.label),
    datasets: [{
      data: sportStats.map(s => s.value),
      backgroundColor: doughnutColors.slice(0, sportStats.length),
      borderColor: '#040221',
      borderWidth: 2,
    }]
  };

  const doughnutOptions = {
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context: any) => ` ${context.raw.toLocaleString('fr-FR')}${displayMode === 'value' ? ' €' : ''}` } }
    }
  };

  const top5Cards = [...filteredCards]
    .filter(c => Number(c.purchase_price) > 0)
    .sort((a, b) => (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0))
    .slice(0, 5);

  // ----------------------------------------------------------------------
  // 3. DATA: COMPARATIF ACHAT VS ACTUEL & TOPS/FLOPS
  // ----------------------------------------------------------------------
  const totalPurchase = filteredCards.reduce((acc, c) => acc + (Number(c.purchase_price) || 0), 0);
  const totalCurrent = filteredCards.reduce((acc, c) => acc + (Number(c.current_price) || 0), 0);
  const totalDelta = totalCurrent - totalPurchase;
  const totalDeltaPercent = totalPurchase > 0 ? (totalDelta / totalPurchase) * 100 : 0;
  const isGlobalPositive = totalDelta >= 0;

  // Calcul des Tops 3 Gains et Top 3 Pertes
  const cardsWithDelta = filteredCards.map(c => {
    const p = Number(c.purchase_price) || 0;
    const current = Number(c.current_price) || p;
    const diff = current - p;
    return { ...c, diff };
  }).filter(c => c.diff !== 0);

  const top3Gains = [...cardsWithDelta].sort((a, b) => b.diff - a.diff).slice(0, 3).filter(c => c.diff > 0);
  const top3Pertes = [...cardsWithDelta].sort((a, b) => a.diff - b.diff).slice(0, 3).filter(c => c.diff < 0);

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans lg:flex lg:justify-center lg:h-screen lg:overflow-hidden">
      
      {/* 📜 DASHBOARD CENTRAL */}
      <div className="w-full lg:max-w-4xl lg:h-screen lg:overflow-y-auto pb-6 lg:pb-20 no-scrollbar">
        
        {/* HEADER & ONGLETS */}
        <div className="pt-[calc(2rem+env(safe-area-inset-top))] pb-4 px-6 flex flex-col items-center">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none mb-6">Statistiques</h1>
          
          <div className="flex bg-white/5 border border-white/10 rounded-full p-1 w-full max-w-[300px]">
            <button 
              onClick={() => setActiveTab('general')} 
              className={`flex-1 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-[#AFFF25] text-[#040221]' : 'text-white/50 hover:text-white'}`}
            >
              Général
            </button>
            <button 
              onClick={() => setActiveTab('comparatif')} 
              className={`flex-1 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'comparatif' ? 'bg-[#AFFF25] text-[#040221]' : 'text-white/50 hover:text-white'}`}
            >
              Comparatif
            </button>
          </div>
        </div>

        {/* FILTRES COMMUNS AUX DEUX ONGLETS */}
        <div className="mb-8">
          <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-3 px-6 pb-2 w-max">
              <button onClick={() => setSelectedSport(null)} className={`px-5 py-2 rounded-full border flex items-center gap-2 transition-all ${!selectedSport ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                <LayoutGrid size={16} /> <span className="text-sm font-bold">Tout</span>
              </button>
              {availableSports.map(sportKey => {
                const isSelected = selectedSport === sportKey;
                return (
                  <button key={sportKey} onClick={() => setSelectedSport(sportKey)} className={`px-5 py-2 rounded-full border flex items-center gap-2 transition-all ${isSelected ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                    <img src={`/asset/sports/${isSelected ? 'neg-' : ''}${SPORT_CONFIG[sportKey].image}.png`} className="h-4 object-contain" alt={SPORT_CONFIG[sportKey].label} />
                    <span className="text-sm font-bold whitespace-nowrap">{SPORT_CONFIG[sportKey].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative z-40 mt-4 px-6">
            {openDropdown && <div className="fixed inset-0 z-[60] bg-black/20" onClick={() => setOpenDropdown(null)}></div>}
            <div className="flex gap-3">
              <button onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full border text-sm font-bold transition-all relative z-[70] ${showAuto || showPatch || showNumbered ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                Spécificités <ChevronDown size={14} className={openDropdown === 'spec' ? 'rotate-180' : ''} />
              </button>
              <button onClick={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full border text-sm font-bold transition-all relative z-[70] ${selectedBrands.length > 0 ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                <span className="truncate max-w-[100px]">{selectedBrands.length > 0 ? `${selectedBrands.length} sél.` : 'Marques'}</span>
                <ChevronDown size={14} className={openDropdown === 'brand' ? 'rotate-180' : ''} />
              </button>
            </div>

            {/* Menus déroulants */}
            {openDropdown === 'spec' && (
              <div className="absolute top-full left-6 right-6 mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-2xl">
                {[
                  { label: 'Autographe', state: showAuto, toggle: () => setShowAuto(!showAuto) },
                  { label: 'Patch', state: showPatch, toggle: () => setShowPatch(!showPatch) },
                  { label: 'Numéroté', state: showNumbered, toggle: () => setShowNumbered(!showNumbered) }
                ].map((item, idx) => (
                  <div key={idx} onClick={item.toggle} className="w-full flex items-center justify-between py-3 cursor-pointer">
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors border border-white/20 ${item.state ? 'bg-[#AFFF25]' : 'bg-transparent'}`}>
                      <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${item.state ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {openDropdown === 'brand' && (
              <div className="absolute top-full left-6 right-6 mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-2xl max-h-80 overflow-y-auto">
                {BRANDS.map(brand => {
                  const isActive = selectedBrands.includes(brand);
                  return (
                    <div key={brand} onClick={() => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand])} className="w-full flex items-center justify-between py-3 cursor-pointer">
                      <span className="text-sm font-bold text-white">{brand}</span>
                      <div className={`w-10 h-6 rounded-full flex items-center p-1 border border-white/20 transition-colors ${isActive ? 'bg-[#AFFF25]' : 'bg-transparent'}`}>
                        <div className={`w-4 h-4 rounded-full transition-transform ${isActive ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* ONGLET 1 : GÉNÉRAL */}
        {/* ========================================================= */}
        {activeTab === 'general' && (
          <>
            <div className="px-6 grid grid-cols-2 gap-4 mb-8">
              <div className="bg-transparent border border-[#AFFF25] rounded-2xl p-5 flex flex-col justify-center text-center">
                <div className="text-xs text-white uppercase tracking-widest font-bold mb-1">Nombre de cartes</div>
                <div className="text-4xl font-black text-[#AFFF25]">{filteredCards.length}</div>
              </div>
              <div className="bg-transparent border border-[#AFFF25] rounded-2xl p-5 flex flex-col justify-center text-center">
                <div className="text-xs text-white uppercase tracking-widest font-bold mb-1">Valeur achat</div>
                <div className="text-3xl font-black text-[#AFFF25] truncate">
                  {totalPurchase.toLocaleString('fr-FR')} €
                </div>
              </div>
            </div>

            <div className="px-6 mb-10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Spécificités</h2>
                <div className="flex bg-transparent border border-[#AFFF25] rounded-full p-1 cursor-pointer">
                  <button onClick={() => setDisplayMode('count')} className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${displayMode === 'count' ? 'bg-[#AFFF25] text-[#040221]' : 'text-[#AFFF25]'}`}><Hash size={16} strokeWidth={3} /></button>
                  <button onClick={() => setDisplayMode('value')} className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${displayMode === 'value' ? 'bg-[#AFFF25] text-[#040221]' : 'text-[#AFFF25]'}`}><Euro size={16} strokeWidth={3} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setActiveDetail('auto')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
                  <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">{displayMode === 'value' ? `${getVal(autosGlobal).toLocaleString('fr-FR')} €` : autosGlobal.length}</div>
                  <div className="text-[10px] text-white uppercase font-bold tracking-wider">Autos</div>
                </button>
                <button onClick={() => setActiveDetail('patch')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
                  <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">{displayMode === 'value' ? `${getVal(patchesGlobal).toLocaleString('fr-FR')} €` : patchesGlobal.length}</div>
                  <div className="text-[10px] text-white uppercase font-bold tracking-wider">Patchs</div>
                </button>
                <button onClick={() => setActiveDetail('numbered')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
                  <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">{displayMode === 'value' ? `${getVal(numberedsGlobal).toLocaleString('fr-FR')} €` : numberedsGlobal.length}</div>
                  <div className="text-[10px] text-white uppercase font-bold tracking-wider">Numérotés</div>
                </button>
              </div>
            </div>

            <div className="px-6 mb-12">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Répartition par Sport</h2>
              {sportStats.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-[140px] h-[140px] relative shrink-0"><Doughnut data={doughnutData} options={doughnutOptions} /></div>
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    {sportStats.slice(0, 4).map((stat, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: doughnutColors[i] }}></div>
                          <span className="text-xs font-bold text-white/80">{stat.label}</span>
                        </div>
                        <span className="text-sm font-black text-white">{displayMode === 'value' ? `${stat.value.toLocaleString('fr-FR')} €` : stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                 <div className="text-white/40 italic text-sm text-center py-4 border border-white/10 rounded-2xl">Aucune donnée pour ce filtre</div>
              )}
            </div>

            <div className="px-6 mb-10 pb-32 lg:pb-0">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-[#AFFF25]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Top 5 Heavy Hitters</h2>
              </div>
              <div className="space-y-3">
                {top5Cards.length > 0 ? top5Cards.map((card, index) => (
                  <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="flex items-center gap-4 p-3 border border-white/10 bg-white/5 rounded-2xl cursor-pointer active:scale-95 transition-transform">
                    <div className="text-[#AFFF25] font-black text-xl w-6 text-center">{index + 1}</div>
                    <div className="w-12 h-12 bg-[#080531] rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                      {card.image_url ? <img src={card.image_url} className="w-full h-full object-cover" alt="Card" /> : <span className="text-[8px] text-white/30 font-bold">N/A</span>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-white font-black italic uppercase truncate leading-none mb-1">{card.firstname} {card.lastname}</div>
                      <div className="text-[9px] text-white/50 uppercase tracking-widest truncate">{card.brand} {card.year ? `- ${card.year}` : ''}</div>
                    </div>
                    <div className="text-[#AFFF25] font-black">{card.purchase_price} €</div>
                  </div>
                )) : <div className="text-white/40 italic text-sm text-center py-8 border border-white/10 rounded-2xl">Aucun prix d'achat renseigné.</div>}
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* ONGLET 2 : COMPARATIF ACHAT VS EBAY */}
        {/* ========================================================= */}
        {activeTab === 'comparatif' && (
          <div className="px-6 pb-32 lg:pb-0 space-y-8">
            
            {/* ENCART GLOBAL */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#AFFF25]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Bilan de la sélection</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1">Total Achat</div>
                  <div className="text-2xl font-black text-white">{totalPurchase.toLocaleString('fr-FR')} €</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#AFFF25]/70 uppercase font-bold tracking-widest mb-1">Total Marché</div>
                  <div className="text-2xl font-black text-[#AFFF25]">{totalCurrent.toLocaleString('fr-FR')} €</div>
                  <div className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Source eBay</div>
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 rounded-2xl border ${isGlobalPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                <div>
                  <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${isGlobalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isGlobalPositive ? 'Plus-value potentielle' : 'Moins-value potentielle'}
                  </div>
                  <div className={`text-xl font-black flex items-center gap-2 ${isGlobalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isGlobalPositive ? <TrendingUp size={20} strokeWidth={3} /> : <TrendingDown size={20} strokeWidth={3} />}
                    {isGlobalPositive ? '+' : ''}{totalDelta.toLocaleString('fr-FR')} €
                  </div>
                </div>
                <div className={`text-sm font-black px-3 py-1 rounded-full ${isGlobalPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {isGlobalPositive ? '+' : ''}{totalDeltaPercent.toFixed(1)} %
                </div>
              </div>
            </div>

            {/* DÉTAIL PAR SPORT */}
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Détail par Sport</h2>
              <div className="space-y-3">
                {availableSports.map(sport => {
                  const sportCards = filteredCards.filter(c => c.sport === sport);
                  if (sportCards.length === 0) return null;

                  const pPurchase = sportCards.reduce((acc, c) => acc + (Number(c.purchase_price) || 0), 0);
                  const pCurrent = sportCards.reduce((acc, c) => acc + (Number(c.current_price) || 0), 0);
                  const pDelta = pCurrent - pPurchase;
                  const isPositive = pDelta >= 0;

                  return (
                    <div key={sport} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#040221] border border-white/10 flex items-center justify-center shrink-0">
                           <img src={`/asset/sports/${SPORT_CONFIG[sport].image}.png`} className="h-5 object-contain opacity-80" alt={SPORT_CONFIG[sport].label} />
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">{SPORT_CONFIG[sport].label}</div>
                          <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                            <div>Achat : {pPurchase.toLocaleString('fr-FR')} €</div>
                            <div>Actuel : {pCurrent.toLocaleString('fr-FR')} €</div>
                          </div>
                        </div>
                      </div>
                      
                      {pDelta === 0 ? (
                        <div className="text-xs font-black text-white/30 flex items-center gap-1 shrink-0 whitespace-nowrap"><Minus size={14} /> 0 €</div>
                      ) : (
                        <div className={`text-sm font-black flex items-center gap-1 shrink-0 whitespace-nowrap ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{pDelta.toLocaleString('fr-FR')} €
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOPS 3 & FLOPS 3 SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              
              {/* TOPS */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" size={16}/> Top 3 Gains
                </h2>
                <div className="space-y-3">
                  {top3Gains.length > 0 ? top3Gains.map(card => (
                    <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform">
                      <div className="w-10 h-10 bg-[#080531] rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                        {card.image_url ? <img src={card.image_url} className="w-full h-full object-cover" alt="Card" /> : <span className="text-[8px] text-white/30 font-bold">N/A</span>}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-white font-black italic uppercase truncate leading-none mb-1">{card.firstname} {card.lastname}</div>
                        <div className="text-[9px] text-white/50 uppercase tracking-widest truncate">{card.brand} {card.year ? `- ${card.year}` : ''}</div>
                      </div>
                      <div className="text-emerald-400 font-black whitespace-nowrap text-sm shrink-0">
                        +{card.diff.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  )) : <div className="text-white/40 italic text-sm py-2 border border-white/5 rounded-xl px-4 bg-white/5">Aucun gain sur la sélection.</div>}
                </div>
              </div>

              {/* FLOPS */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingDown className="text-rose-400" size={16}/> Top 3 Pertes
                </h2>
                <div className="space-y-3">
                  {top3Pertes.length > 0 ? top3Pertes.map(card => (
                    <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform">
                      <div className="w-10 h-10 bg-[#080531] rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                        {card.image_url ? <img src={card.image_url} className="w-full h-full object-cover" alt="Card" /> : <span className="text-[8px] text-white/30 font-bold">N/A</span>}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-white font-black italic uppercase truncate leading-none mb-1">{card.firstname} {card.lastname}</div>
                        <div className="text-[9px] text-white/50 uppercase tracking-widest truncate">{card.brand} {card.year ? `- ${card.year}` : ''}</div>
                      </div>
                      <div className="text-rose-400 font-black whitespace-nowrap text-sm shrink-0">
                        {card.diff.toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  )) : <div className="text-white/40 italic text-sm py-2 border border-white/5 rounded-xl px-4 bg-white/5">Aucune perte sur la sélection.</div>}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* POP-IN DE DÉTAILS (Commune) */}
      {activeDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#040221] border border-[#AFFF25] rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">
                {activeDetail === 'auto' && 'Détails Autos'}
                {activeDetail === 'patch' && 'Détails Patchs'}
                {activeDetail === 'numbered' && 'Détails Num'}
              </h3>
              <button onClick={() => setActiveDetail(null)} className="w-8 h-8 bg-transparent border border-[#AFFF25] rounded-full flex items-center justify-center hover:bg-[#AFFF25] hover:text-[#040221] text-[#AFFF25] transition-colors"><X size={18} /></button>
            </div>
            
            <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
              {activeDetail === 'auto' && (
                <>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Autographes seuls</span><span className="text-lg font-black text-[#AFFF25]">{getVal(autosSeuls).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(autosSeuls)}
                  </div>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Auto + Patchs (RPA)</span><span className="text-lg font-black text-[#AFFF25]">{getVal(autosPatchs).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(autosPatchs)}
                  </div>
                </>
              )}
              {activeDetail === 'patch' && (
                <>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Patchs seuls</span><span className="text-lg font-black text-[#AFFF25]">{getVal(patchsSeuls).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(patchsSeuls)}
                  </div>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Patchs + Autos (RPA)</span><span className="text-lg font-black text-[#AFFF25]">{getVal(autosPatchs).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(autosPatchs)}
                  </div>
                </>
              )}
              {activeDetail === 'numbered' && (
                <>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Numérotées seules</span><span className="text-lg font-black text-[#AFFF25]">{getVal(numsSeules).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(numsSeules)}
                  </div>
                  <div className="border-b border-[#AFFF25]/30 pb-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-white font-medium">Numérotées + Hit (Auto/Patch)</span><span className="text-lg font-black text-[#AFFF25]">{getVal(numsHits).toLocaleString('fr-FR')} {displayMode === 'value' && '€'}</span></div>
                    {renderSportBreakdown(numsHits)}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setActiveDetail(null)} className="w-full py-4 bg-transparent border border-[#AFFF25] text-[#AFFF25] hover:bg-[#AFFF25] hover:text-[#040221] rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">Fermer</button>
          </div>
        </div>
      )}

    </div>
  );
}