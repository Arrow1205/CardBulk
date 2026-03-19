'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, X, LayoutGrid, ChevronDown, Euro, Hash } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Initialisation de Chart.js pour le Doughnut
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
    // 1️⃣ CHARGEMENT HORS-LIGNE (CACHE)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cardbulk_offline_cards');
      if (cached) {
        setCards(JSON.parse(cached).filter((c: any) => !c.is_wishlist));
        setLoading(false); // Coupe le loader direct !
      }
    }

    // 2️⃣ MISE À JOUR DEPUIS SUPABASE (EN ARRIÈRE-PLAN)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user && !userError) return router.push('/login');
      if (!user) throw new Error("Offline");

      const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
      if (data) {
        setCards(data.filter(c => !c.is_wishlist));
        // On met à jour le cache global
        localStorage.setItem('cardbulk_offline_cards', JSON.stringify(data));
      }
    } catch (error) {
      console.log("🌐 Mode hors-ligne activé pour les Stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  // ==========================================
  // FILTRAGE DES CARTES
  // ==========================================
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

  // Fonction utilitaire pour calculer selon le mode (Nombre vs Valeur)
  const getVal = (list: any[]) => displayMode === 'count' ? list.length : list.reduce((acc, c) => acc + (Number(c.purchase_price) || 0), 0);

  // ==========================================
  // CALCUL DES STATISTIQUES UNIQUES
  // ==========================================
  const totalCardsVal = getVal(filteredCards);

  // Catégories globales pour la Popin
  const autosGlobal = filteredCards.filter(c => c.is_auto);
  const patchesGlobal = filteredCards.filter(c => c.is_patch);
  const numberedsGlobal = filteredCards.filter(c => c.is_numbered);

  // Spécificités STRICTEMENT UNIQUES (Pour le graphique)
  const statsUniques = [
    { label: 'Auto Seul', list: filteredCards.filter(c => c.is_auto && !c.is_patch && !c.is_numbered), color: '#AFFF25' },
    { label: 'Patch Seul', list: filteredCards.filter(c => !c.is_auto && c.is_patch && !c.is_numbered), color: '#3B82F6' },
    { label: 'Numérotée Seule', list: filteredCards.filter(c => !c.is_auto && !c.is_patch && c.is_numbered), color: '#FFFFFF' },
    { label: 'Auto + Patch', list: filteredCards.filter(c => c.is_auto && c.is_patch && !c.is_numbered), color: '#F59E0B' },
    { label: 'Auto + Num', list: filteredCards.filter(c => c.is_auto && !c.is_patch && c.is_numbered), color: '#8B5CF6' },
    { label: 'Patch + Num', list: filteredCards.filter(c => !c.is_auto && c.is_patch && c.is_numbered), color: '#EC4899' },
    { label: 'Auto+Patch+Num', list: filteredCards.filter(c => c.is_auto && c.is_patch && c.is_numbered), color: '#EF4444' },
  ].map(item => ({ ...item, value: getVal(item.list) })).filter(item => item.value > 0);

  // ==========================================
  // GRAPHIQUE ANNEAUX IMBRIQUÉS (Nested Doughnut)
  // ==========================================
  const maxScaleValue = totalCardsVal > 0 ? totalCardsVal : 1; 

  const doughnutData = {
    labels: statsUniques.map(s => s.label),
    datasets: statsUniques.map((stat, i) => ({
      label: stat.label,
      data: [stat.value, maxScaleValue - stat.value],
      backgroundColor: [stat.color, 'rgba(255, 255, 255, 0.05)'], // La partie "vide" est grise/transparente
      borderWidth: 4, 
      borderColor: '#040221', 
      borderRadius: 20, 
      cutout: '20%', 
    }))
  };

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { 
          font: { family: 'sans-serif', size: 10, weight: 'normal' as const },
          generateLabels: (chart: any) => {
             return statsUniques.map((stat, i) => ({
               text: `${stat.label} (${displayMode === 'value' ? stat.value.toLocaleString('fr-FR') + ' €' : stat.value})`,
               fillStyle: stat.color,
               fontColor: '#FFFFFF', // 👈 C'est ICI qu'on force le texte en blanc
               strokeStyle: '#040221', // Petite astuce : bordure foncée autour du carré de couleur
               lineWidth: 2,
               hidden: false,
               index: i
             }));
          }
        }
      },
      tooltip: {
        filter: function(tooltipItem: any) {
          return tooltipItem.dataIndex !== 1;
        },
        callbacks: {
          label: function(context: any) {
            const valueLabel = displayMode === 'value' ? `${context.raw.toLocaleString('fr-FR')} €` : `${context.raw}`;
            return ` ${context.dataset.label} : ${valueLabel}`;
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-32">
      
      {/* HEADER (Centré, sans bouton retour) */}
      <div className="pt-8 pb-4 px-6 flex justify-center items-center">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Statistiques</h1>
      </div>

      {/* FILTRES (Sports + Spécificités - Style Collection) */}
      <div className="mb-6">
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

        <div className="relative z-50 mt-4 px-6">
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

          {/* Menus Dropdown */}
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

      {/* KPI GLOBAUX */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        <div className="bg-transparent border border-[#AFFF25] rounded-2xl p-5 flex flex-col justify-center text-center">
          <div className="text-xs text-white uppercase tracking-widest font-bold mb-1">Nombre de cartes</div>
          <div className="text-4xl font-black text-[#AFFF25]">{filteredCards.length}</div>
        </div>
        <div className="bg-transparent border border-[#AFFF25] rounded-2xl p-5 flex flex-col justify-center text-center">
          <div className="text-xs text-white uppercase tracking-widest font-bold mb-1">Valeur collection</div>
          <div className="text-3xl font-black text-[#AFFF25] truncate">
            {filteredCards.reduce((acc, c) => acc + (Number(c.purchase_price) || 0), 0).toLocaleString('fr-FR')} €
          </div>
        </div>
      </div>

      {/* BLOCS SPÉCIFICITÉS & TOGGLE */}
      <div className="px-6 mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Spécificités (Global)</h2>
          
          {/* TOGGLE NOMBRE / VALEUR */}
          <div className="flex bg-transparent border border-[#AFFF25] rounded-full p-1 cursor-pointer">
            <button 
              onClick={() => setDisplayMode('count')}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${displayMode === 'count' ? 'bg-[#AFFF25] text-[#040221]' : 'text-[#AFFF25]'}`}
            >
              <Hash size={16} strokeWidth={3} />
            </button>
            <button 
              onClick={() => setDisplayMode('value')}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${displayMode === 'value' ? 'bg-[#AFFF25] text-[#040221]' : 'text-[#AFFF25]'}`}
            >
              <Euro size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setActiveDetail('auto')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform">
            <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
              {displayMode === 'value' ? `${getVal(autosGlobal).toLocaleString('fr-FR')} €` : autosGlobal.length}
            </div>
            <div className="text-[10px] text-white uppercase font-bold tracking-wider">Autos</div>
          </button>
          
          <button onClick={() => setActiveDetail('patch')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform">
            <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
              {displayMode === 'value' ? `${getVal(patchesGlobal).toLocaleString('fr-FR')} €` : patchesGlobal.length}
            </div>
            <div className="text-[10px] text-white uppercase font-bold tracking-wider">Patchs</div>
          </button>
          
          <button onClick={() => setActiveDetail('numbered')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform">
            <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
              {displayMode === 'value' ? `${getVal(numberedsGlobal).toLocaleString('fr-FR')} €` : numberedsGlobal.length}
            </div>
            <div className="text-[10px] text-white uppercase font-bold tracking-wider">Numérotés</div>
          </button>
        </div>
      </div>

      {/* GRAPHIQUE ANNEAUX IMBRIQUÉS (Sans bordure ni titre) */}
      <div className="px-6 mb-10">
        <div className="bg-transparent rounded-[32px] py-6 relative flex flex-col items-center">
          
          {/* Données au centre de l'anneau (Texte en blanc et regular) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-6">
            <div className="text-xs font-normal uppercase tracking-widest text-white">Total</div>
            <div className="text-2xl font-normal text-white">
              {displayMode === 'value' ? `${totalCardsVal.toLocaleString('fr-FR')} €` : totalCardsVal}
            </div>
          </div>

          <div className="w-full aspect-square max-w-[300px]">
            {statsUniques.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-white/50 font-normal italic text-center">Aucune combinaison à afficher pour ces filtres.</div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          POPIN DE DÉTAILS (MODAL)
      ========================================== */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#040221] border border-[#AFFF25] rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">
                {activeDetail === 'auto' && 'Détails Autos'}
                {activeDetail === 'patch' && 'Détails Patchs'}
                {activeDetail === 'numbered' && 'Détails Num'}
              </h3>
              <button onClick={() => setActiveDetail(null)} className="w-8 h-8 bg-transparent border border-[#AFFF25] rounded-full flex items-center justify-center hover:bg-[#AFFF25] hover:text-[#040221] text-[#AFFF25] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {activeDetail === 'auto' && (
                <>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Autographes seuls</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => c.is_auto && !c.is_patch))} {displayMode === 'value' && '€'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Auto + Patchs (RPA)</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => c.is_auto && c.is_patch))} {displayMode === 'value' && '€'}</span>
                  </div>
                </>
              )}

              {activeDetail === 'patch' && (
                <>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Patchs seuls</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => !c.is_auto && c.is_patch))} {displayMode === 'value' && '€'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Patchs + Autos (RPA)</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => c.is_auto && c.is_patch))} {displayMode === 'value' && '€'}</span>
                  </div>
                </>
              )}

              {activeDetail === 'numbered' && (
                <>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Numérotées seules</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => !c.is_auto && !c.is_patch && c.is_numbered))} {displayMode === 'value' && '€'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#AFFF25]/30 pb-3">
                    <span className="text-sm text-white font-medium">Numérotées + Hit (Auto/Patch)</span>
                    <span className="text-lg font-black text-[#AFFF25]">{getVal(filteredCards.filter(c => (c.is_auto || c.is_patch) && c.is_numbered))} {displayMode === 'value' && '€'}</span>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setActiveDetail(null)} className="w-full py-4 bg-transparent border border-[#AFFF25] text-[#AFFF25] hover:bg-[#AFFF25] hover:text-[#040221] rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}