'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, X, LayoutGrid, ChevronDown, Euro, Hash } from 'lucide-react';
import { Radar } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

// Initialisation de Chart.js pour le Radar
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
    if (data) setCards(data.filter(c => !c.is_wishlist));
    
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

  const autosGlobal = filteredCards.filter(c => c.is_auto);
  const patchesGlobal = filteredCards.filter(c => c.is_patch);
  const numberedsGlobal = filteredCards.filter(c => c.is_numbered);

  const statsUniques = [
    { label: 'Auto Seul', list: filteredCards.filter(c => c.is_auto && !c.is_patch && !c.is_numbered), color: '#AFFF25' },
    { label: 'Patch Seul', list: filteredCards.filter(c => !c.is_auto && c.is_patch && !c.is_numbered), color: '#3B82F6' },
    { label: 'Numérotée Seule', list: filteredCards.filter(c => !c.is_auto && !c.is_patch && c.is_numbered), color: '#FFFFFF' },
    { label: 'Auto + Patch', list: filteredCards.filter(c => c.is_auto && c.is_patch && !c.is_numbered), color: '#F59E0B' },
    { label: 'Auto + Num', list: filteredCards.filter(c => c.is_auto && !c.is_patch && c.is_numbered), color: '#8B5CF6' },
    { label: 'Patch + Num', list: filteredCards.filter(c => !c.is_auto && c.is_patch && c.is_numbered), color: '#EC4899' },
    { label: 'Auto+Patch+Num', list: filteredCards.filter(c => c.is_auto && c.is_patch && c.is_numbered), color: '#EF4444' },
  ].map(item => ({ ...item, value: getVal(item.list) })).filter(item => item.value > 0);

  const maxVal = Math.max(...statsUniques.map(s => s.value), 0);

  const radarData = {
    labels: statsUniques.map(s => s.label),
    datasets: [
      {
        label: displayMode === 'value' ? 'Valeur' : 'Nombre',
        data: statsUniques.map(s => s.value),
        backgroundColor: 'rgba(175, 255, 37, 0.2)',
        borderColor: '#AFFF25',
        borderWidth: 2,
        pointBackgroundColor: statsUniques.map(s => s.color),
        pointBorderColor: '#040221',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 16 // Padding réduit pour laisser plus de place au graph
    },
    scales: {
      r: {
        suggestedMax: isFinite(maxVal) ? maxVal * 1.15 : 10,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { display: false },
        ticks: { display: false, backdropColor: 'transparent' }
      }
    },
    plugins: {
      legend: {
        display: true, 
        position: 'bottom' as const,
        labels: {
          color: '#FFFFFF',
          usePointStyle: true, 
          padding: 15,
          font: { family: 'sans-serif', size: 11 },
          generateLabels: (chart: any) => {
             return statsUniques.map((stat, i) => ({
               text: `${stat.label} : ${displayMode === 'value' ? stat.value.toLocaleString('fr-FR') + ' €' : stat.value}`,
               fillStyle: stat.color,
               strokeStyle: stat.color,
               fontColor: '#FFFFFF',
               hidden: false,
               index: i
             }));
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const valueLabel = displayMode === 'value' ? `${context.raw.toLocaleString('fr-FR')} €` : `${context.raw}`;
            return ` ${valueLabel}`;
          }
        }
      }
    }
  };

  const customDataLabelsPlugin = {
    id: 'customDataLabelsPlugin',
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      ctx.save();
      ctx.font = '900 16px sans-serif'; 
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      chart.getDatasetMeta(0).data.forEach((datapoint: any, index: number) => {
        const value = data.datasets[0].data[index];
        const text = displayMode === 'value' ? `${value.toLocaleString('fr-FR')} €` : value.toString();
        
        ctx.strokeStyle = '#040221';
        ctx.lineWidth = 6;
        ctx.strokeText(text, datapoint.x, datapoint.y - 12);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, datapoint.x, datapoint.y - 12);
      });
      ctx.restore();
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans lg:flex lg:h-screen lg:overflow-hidden">
      
      <div className="w-full lg:w-2/3 lg:h-screen lg:overflow-y-auto pb-6 lg:pb-20 no-scrollbar">
        
        {/* 🚨 AJOUT DE LA SAFE AREA ICI 🚨 */}
        <div className="pt-[calc(2rem+env(safe-area-inset-top))] pb-4 px-6 flex justify-center items-center">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none drop-shadow-lg">Statistiques</h1>
        </div>

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

        <div className="px-6 mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Spécificités (Global)</h2>
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
            <button onClick={() => setActiveDetail('auto')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
              <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
                {displayMode === 'value' ? `${getVal(autosGlobal).toLocaleString('fr-FR')} €` : autosGlobal.length}
              </div>
              <div className="text-[10px] text-white uppercase font-bold tracking-wider">Autos</div>
            </button>
            
            <button onClick={() => setActiveDetail('patch')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
              <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
                {displayMode === 'value' ? `${getVal(patchesGlobal).toLocaleString('fr-FR')} €` : patchesGlobal.length}
              </div>
              <div className="text-[10px] text-white uppercase font-bold tracking-wider">Patchs</div>
            </button>
            
            <button onClick={() => setActiveDetail('numbered')} className="bg-transparent border border-[#AFFF25] rounded-2xl p-4 text-center active:scale-95 transition-transform hover:bg-white/5">
              <div className="text-xl font-black text-[#AFFF25] mb-1 truncate">
                {displayMode === 'value' ? `${getVal(numberedsGlobal).toLocaleString('fr-FR')} €` : numberedsGlobal.length}
              </div>
              <div className="text-[10px] text-white uppercase font-bold tracking-wider">Numérotés</div>
            </button>
          </div>
        </div>
      </div>

      {/* 📈 PARTIE DROITE (GRAPHIQUE) */}
      <div className="relative z-30 w-full lg:w-1/3 lg:h-screen bg-[#040221] lg:bg-[#040221]/95 lg:backdrop-blur-xl lg:border-l border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] lg:shadow-[-20px_0_40px_rgba(0,0,0,0.8)] flex flex-col justify-center pt-8 pb-32 lg:py-0 px-2 sm:px-6 transition-all duration-300 -mt-6 lg:mt-0 rounded-t-[32px] lg:rounded-none">
        
        <div className="bg-transparent rounded-[32px] py-6 relative flex flex-col items-center w-full h-full justify-center">
          <div className="w-full h-[450px] sm:h-[500px] lg:h-[650px] max-w-full lg:max-w-[700px] relative z-20 flex justify-center px-2">
            {statsUniques.length > 0 ? (
              <Radar data={radarData} options={radarOptions} plugins={[customDataLabelsPlugin]} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white/50 font-normal italic text-center">Aucune combinaison à afficher pour ces filtres.</div>
            )}
          </div>
        </div>
      </div>

      {activeDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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