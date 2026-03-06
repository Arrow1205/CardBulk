'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronDown } from 'lucide-react';

const SPORT_COLORS: Record<string, string> = {
  'SOCCER': '#47DEA2',
  'BASKETBALL': '#F96927',
  'TENNIS': '#D5F219',
  'NFL': '#8F1891',
  'NHL': '#FF3D60',
  'F1': '#47DCDE',
  'BASEBALL': '#FFFFFF' 
};

export default function StatsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs'>('valeurs');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  // 🚀 ÉTAT POUR LA POPIN DE DÉTAILS
  const [detailModal, setDetailModal] = useState<'autos' | 'patchs' | 'numbered' | null>(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
    // 🚀 EXCLURE WISHLIST
    if (data) setCards(data.filter(c => !c.is_wishlist));
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-[#040221]"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const filteredCards = cards.filter(card => {
    const matchesSport = selectedSport === '' || card.sport === selectedSport;
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;
    return matchesSport && matchesSpec;
  });

  const isVal = activeTab === 'valeurs';
  
  const calculateTotal = (filterFn: (c: any) => boolean) => filteredCards.filter(filterFn).reduce((acc, card) => acc + (isVal ? (parseFloat(card.purchase_price) || 0) : 1), 0);

  const totalGlobal = calculateTotal(() => true);
  const totalAutos = calculateTotal(c => c.is_auto);
  const totalPatchs = calculateTotal(c => c.is_patch);
  const totalNumbered = calculateTotal(c => c.is_numbered);

  const statsBySport: Record<string, number> = {};
  filteredCards.forEach(card => {
    const sport = card.sport || 'Autre';
    statsBySport[sport] = (statsBySport[sport] || 0) + (isVal ? (parseFloat(card.purchase_price) || 0) : 1);
  });
  const sortedSports = Object.entries(statsBySport).sort((a, b) => b[1] - a[1]);
  
  let currentPercentage = 0;
  const gradientStops = sortedSports.map(([sport, value]) => {
    const percentage = (value / totalGlobal) * 100;
    const start = currentPercentage;
    const end = currentPercentage + percentage;
    currentPercentage = end;
    const color = SPORT_COLORS[sport] || '#AFFF25';
    return `${color} ${start}% ${end - 0.5}%, #040221 ${end - 0.5}% ${end}%`;
  }).join(', ');

  const formattedTotal = isVal ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalGlobal) : totalGlobal.toString();

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-36 font-sans relative overflow-x-hidden z-10">
      
      {/* 🚀 DÉGRADÉ UNIFORME */}
      <div className="absolute top-0 left-0 w-full h-[30vh] bg-gradient-to-b from-[#AFFF25]/20 via-[#AFFF25]/5 to-transparent pointer-events-none -z-10"></div>

      <header className="pt-10 pb-4 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">STATS</h1>
      </header>

      {/* 🚀 FILTRES MOINS HAUTS (py-1.5) */}
      <div className="px-6 flex gap-2 mb-8">
        <div className="relative flex-1">
          <select value={selectedSport} onChange={(e) => setSelectedSport(e.target.value)} className="w-full bg-[#040221]/80 backdrop-blur-md border border-white/20 rounded-full py-1.5 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg">
            <option value="">TOUS SPORTS</option>
            {Object.keys(SPORT_COLORS).filter(k => k !== 'BASEBALL').map(key => <option key={key} value={key}>{key}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-2 text-white/50 pointer-events-none" size={14} />
        </div>
        <div className="relative flex-1">
          <select value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value)} className="w-full bg-[#040221]/80 backdrop-blur-md border border-white/20 rounded-full py-1.5 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg">
            <option value="">SPÉCIFICITÉS</option>
            <option value="auto">AUTO</option><option value="patch">PATCH</option><option value="rookie">ROOKIE</option><option value="numbered">NUMÉROTÉE</option>
          </select>
          <ChevronDown className="absolute right-3 top-2 text-white/50 pointer-events-none" size={14} />
        </div>
      </div>

      {/* 🚀 ONGLET BLANC ET JAUNE FLUO */}
      <div className="flex justify-center gap-10 mb-8">
        <button onClick={() => setActiveTab('nombres')} className={`text-lg font-bold transition-all ${activeTab === 'nombres' ? 'text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)]' : 'text-white'}`}>Nombres</button>
        <button onClick={() => setActiveTab('valeurs')} className={`text-lg font-bold transition-all ${activeTab === 'valeurs' ? 'text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)]' : 'text-white'}`}>Valeurs</button>
      </div>

      {/* 🚀 TEXTE "CARTES" ET € BLANC */}
      <div className="text-center mb-8 px-4">
        <div className="text-6xl font-black italic tracking-tighter leading-none whitespace-nowrap flex justify-center items-baseline drop-shadow-md">
          {isVal ? formattedTotal.replace('€', '').trim() : totalGlobal}
          {isVal && <span className="text-5xl ml-1 text-white">€</span>}
        </div>
        <div className="text-[#AFFF25] text-xs font-bold uppercase tracking-widest mt-2 drop-shadow-sm">
          {isVal ? "Valeur totale" : "Cartes"}
        </div>
      </div>

      {/* 🚀 CLIC POUR AFFICHER LA POPIN */}
      <div className="px-6 grid grid-cols-3 gap-3 mb-12">
        <div onClick={() => setDetailModal('autos')} className="bg-[#080531]/80 cursor-pointer active:scale-95 transition-transform backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center shadow-lg">
          <div className="text-[10px] text-white/70 mb-1">Autos</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalAutos} €` : totalAutos}</div>
        </div>
        <div onClick={() => setDetailModal('patchs')} className="bg-[#080531]/80 cursor-pointer active:scale-95 transition-transform backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center shadow-lg">
          <div className="text-[10px] text-white/70 mb-1">Patchs</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalPatchs} €` : totalPatchs}</div>
        </div>
        <div onClick={() => setDetailModal('numbered')} className="bg-[#080531]/80 cursor-pointer active:scale-95 transition-transform backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center shadow-lg">
          <div className="text-[10px] text-white/70 mb-1">Numérotées</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalNumbered} €` : totalNumbered}</div>
        </div>
      </div>

      {/* 🚀 GRAPHIQUE AUX BONNES COULEURS AVEC NOMBRES */}
      {totalGlobal > 0 && (
        <div className="relative w-full flex justify-center mt-12 mb-10 px-6">
          <div className="relative w-64 h-64">
            <div className="w-full h-full rounded-full transition-all duration-700" style={{ background: `conic-gradient(${gradientStops})`, maskImage: 'radial-gradient(circle at center, transparent 35%, black 36%)' }}></div>
            {sortedSports.map(([sport, value], index) => {
              if (index > 4) return null; 
              let angle = 0, previousPercent = 0;
              for(let i=0; i<=index; i++) {
                const percent = (sortedSports[i][1] / totalGlobal);
                if (i === index) angle = (previousPercent + percent/2) * 360;
                previousPercent += percent;
              }
              const rad = (angle - 90) * (Math.PI / 180);
              const x = Math.cos(rad) * 140; const y = Math.sin(rad) * 140;
              const color = SPORT_COLORS[sport] || '#AFFF25';
              return (
                <div key={sport} className="absolute text-xs font-bold whitespace-nowrap" style={{ color: color, left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%, -50%)', textShadow: '0 2px 5px rgba(0,0,0,1)' }}>
                  {sport} ({isVal ? `${value}€` : value})
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🚀 POPIN DE DÉTAILS */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setDetailModal(null)}>
          <div className="bg-[#040221] border border-[#AFFF25] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black italic uppercase mb-4 text-[#AFFF25]">Détail {detailModal}</h3>
            <div className="space-y-3 text-sm font-bold">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Total :</span>
                <span className="text-[#AFFF25]">
                  {detailModal === 'autos' ? (isVal ? `${totalAutos} €` : totalAutos) : 
                   detailModal === 'patchs' ? (isVal ? `${totalPatchs} €` : totalPatchs) : 
                   (isVal ? `${totalNumbered} €` : totalNumbered)}
                </span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Numérotées :</span>
                <span>{calculateTotal(c => detailModal === 'autos' ? (c.is_auto && c.is_numbered) : detailModal === 'patchs' ? (c.is_patch && c.is_numbered) : (c.is_numbered))}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Patchs :</span>
                <span>{calculateTotal(c => detailModal === 'autos' ? (c.is_auto && c.is_patch) : detailModal === 'numbered' ? (c.is_numbered && c.is_patch) : (c.is_patch))}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Autos :</span>
                <span>{calculateTotal(c => detailModal === 'patchs' ? (c.is_auto && c.is_patch) : detailModal === 'numbered' ? (c.is_numbered && c.is_auto) : (c.is_auto))}</span>
              </div>
            </div>
            <button onClick={() => setDetailModal(null)} className="w-full mt-6 py-2 bg-[#AFFF25] text-black font-black italic uppercase rounded-full">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}