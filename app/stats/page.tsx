'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, X, BarChart3, ChevronLeft } from 'lucide-react';
import { PolarArea } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, ArcElement, Tooltip, Legend } from 'chart.js';

// Initialisation de Chart.js
ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);

export default function StatsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // État pour la Pop-in de détails
  const [activeDetail, setActiveDetail] = useState<'auto' | 'patch' | 'numbered' | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  // 🚀 VRAIE CONNEXION SUPABASE
  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
    if (data) setCards(data);
    
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  // ==========================================
  // 🧮 CALCUL DES STATISTIQUES (POPIN)
  // ==========================================
  const totalCards = cards.length;
  const totalValue = cards.reduce((acc, card) => acc + (Number(card.purchase_price) || 0), 0);

  const autos = cards.filter(c => c.is_auto);
  const patches = cards.filter(c => c.is_patch);
  const numbereds = cards.filter(c => c.is_numbered);

  // Autos
  const autoOnly = autos.filter(c => !c.is_patch).length;
  const autoPatch = autos.filter(c => c.is_patch).length;
  // Patchs
  const patchOnly = patches.filter(c => !c.is_auto).length;
  const patchAuto = patches.filter(c => c.is_auto).length;
  // Numérotées
  const numOnly = numbereds.filter(c => !c.is_auto && !c.is_patch).length;
  const numAuto = numbereds.filter(c => c.is_auto && !c.is_patch).length;
  const numPatch = numbereds.filter(c => c.is_patch && !c.is_auto).length;
  const numAutoPatch = numbereds.filter(c => c.is_auto && c.is_patch).length;

  // ==========================================
  // 📊 DONNÉES DU GRAPHIQUE POLAR AREA (Profondeur)
  // ==========================================
  // 1. On liste tous les sports présents
  const sportsCount = cards.reduce((acc, card) => {
    const sport = card.sport || 'Autre';
    acc[sport] = (acc[sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const labels = Object.keys(sportsCount);

  // 2. On compte chaque spécificité (UNIQUEMENT, comme demandé) pour chaque sport
  const totals = labels.map(s => cards.filter(c => (c.sport || 'Autre') === s).length);
  const autosOnlyArray = labels.map(s => cards.filter(c => (c.sport || 'Autre') === s && c.is_auto && !c.is_patch && !c.is_numbered).length);
  const patchesOnlyArray = labels.map(s => cards.filter(c => (c.sport || 'Autre') === s && c.is_patch && !c.is_auto && !c.is_numbered).length);
  const numsOnlyArray = labels.map(s => cards.filter(c => (c.sport || 'Autre') === s && c.is_numbered && !c.is_auto && !c.is_patch).length);

  // 3. 🪄 L'ASTUCE DE SUPERPOSITION : On additionne les rayons pour qu'ils s'empilent parfaitement
  // Le centre est l'Auto. Le Patch vient par dessus, donc son rayon doit englober celui de l'Auto, etc.
  const radiusAuto = autosOnlyArray;
  const radiusPatch = patchesOnlyArray.map((val, i) => val + radiusAuto[i]);
  const radiusNum = numsOnlyArray.map((val, i) => val + radiusPatch[i]);
  // Le grand pétale global (Sport) est le total des cartes. On s'assure qu'il couvre tout.
  const radiusTotal = totals.map((val, i) => Math.max(val, radiusNum[i])); 

  const polarData = {
    labels: labels,
    datasets: [
      {
        label: 'Autres cartes (Base, Combos)',
        data: radiusTotal,
        realData: totals.map((val, i) => val - radiusNum[i]), // Ce qu'on affiche au survol
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Pétale de fond global (Discret)
        borderColor: '#040221',
        borderWidth: 2,
      },
      {
        label: 'Numérotées (uniquement)',
        data: radiusNum,
        realData: numsOnlyArray,
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // Blanc semi-transparent
        borderColor: '#040221',
        borderWidth: 2,
      },
      {
        label: 'Patchs (uniquement)',
        data: radiusPatch,
        realData: patchesOnlyArray,
        backgroundColor: 'rgba(30, 58, 138, 0.9)', // Bleu foncé
        borderColor: '#040221',
        borderWidth: 2,
      },
      {
        label: 'Autos (uniquement)',
        data: radiusAuto,
        realData: autosOnlyArray,
        backgroundColor: 'rgba(175, 255, 37, 1)', // Vert pomme (AFFF25) au centre !
        borderColor: '#040221',
        borderWidth: 2,
      }
    ],
  };

  const polarOptions = {
    responsive: true,
    scales: {
      r: {
        ticks: { display: false }, 
        grid: { color: 'rgba(255, 255, 255, 0.05)' } 
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'sans-serif', size: 10 } }
      },
      tooltip: {
        callbacks: {
          // 🪄 On triche ici : au survol, on n'affiche pas le rayon cumulé, mais la vraie valeur "realData" !
          label: function(context: any) {
            const label = context.dataset.label || '';
            const realValue = context.dataset.realData[context.dataIndex];
            return `${label} : ${realValue}`;
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-32">
      
      {/* HEADER */}
      <div className="pt-8 pb-4 px-6 flex items-center gap-4">
        <button onClick={() => router.push('/collection')} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Statistiques</h1>
      </div>

      {/* KPI GLOBAUX */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
          <div className="text-xs text-white/50 uppercase tracking-widest font-bold mb-1">Total Cartes</div>
          <div className="text-4xl font-black text-white">{totalCards}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center">
          <div className="text-xs text-[#AFFF25]/70 uppercase tracking-widest font-bold mb-1">Valeur Estimée</div>
          <div className="text-3xl font-black text-[#AFFF25] truncate">{totalValue.toLocaleString('fr-FR')} €</div>
        </div>
      </div>

      {/* BLOCS SPÉCIFICITÉS (Cliquables pour Pop-in) */}
      <div className="px-6 mb-10">
        <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4">Spécificités</h2>
        <div className="grid grid-cols-3 gap-3">
          
          <button onClick={() => setActiveDetail('auto')} className="bg-[#10243E] border border-[#1E3A8A] rounded-2xl p-4 text-left active:scale-95 transition-transform">
            <div className="text-2xl font-black text-white mb-1">{autos.length}</div>
            <div className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Autos</div>
          </button>
          
          <button onClick={() => setActiveDetail('patch')} className="bg-[#10243E] border border-[#1E3A8A] rounded-2xl p-4 text-left active:scale-95 transition-transform">
            <div className="text-2xl font-black text-white mb-1">{patches.length}</div>
            <div className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Patchs</div>
          </button>
          
          <button onClick={() => setActiveDetail('numbered')} className="bg-[#10243E] border border-[#1E3A8A] rounded-2xl p-4 text-left active:scale-95 transition-transform">
            <div className="text-2xl font-black text-white mb-1">{numbereds.length}</div>
            <div className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Numérotés</div>
          </button>

        </div>
      </div>

      {/* GRAPHIQUE POLAR AREA (Pétales à 3 niveaux) */}
      <div className="px-6 mb-10">
        <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart3 size={16} /> Détail par Sport
        </h2>
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 flex items-center justify-center relative">
          {Object.keys(sportsCount).length > 0 ? (
            <PolarArea data={polarData} options={polarOptions} />
          ) : (
            <div className="text-white/40 italic py-10">Aucune donnée à afficher</div>
          )}
        </div>
      </div>

      {/* ==========================================
          POPIN DE DÉTAILS (MODAL)
      ========================================== */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#040221] border border-white/10 rounded-[32px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic text-[#AFFF25] uppercase tracking-tighter">
                {activeDetail === 'auto' && 'Détail Autographes'}
                {activeDetail === 'patch' && 'Détail Patchs'}
                {activeDetail === 'numbered' && 'Détail Numérotées'}
              </h3>
              <button onClick={() => setActiveDetail(null)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {activeDetail === 'auto' && (
                <>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Autographes seuls</span>
                    <span className="text-lg font-black">{autoOnly}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Auto + Patchs (RPA)</span>
                    <span className="text-lg font-black">{autoPatch}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">Total Autos</span>
                    <span className="text-xl font-black text-[#AFFF25]">{autos.length}</span>
                  </div>
                </>
              )}

              {activeDetail === 'patch' && (
                <>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Patchs seuls</span>
                    <span className="text-lg font-black">{patchOnly}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Patchs + Autos (RPA)</span>
                    <span className="text-lg font-black">{patchAuto}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">Total Patchs</span>
                    <span className="text-xl font-black text-[#AFFF25]">{patches.length}</span>
                  </div>
                </>
              )}

              {activeDetail === 'numbered' && (
                <>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Numérotées seules</span>
                    <span className="text-lg font-black">{numOnly}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Numérotées + Auto</span>
                    <span className="text-lg font-black">{numAuto}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Numérotées + Patch</span>
                    <span className="text-lg font-black">{numPatch}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-sm text-white/80 font-medium">Numérotées + Auto + Patch</span>
                    <span className="text-lg font-black">{numAutoPatch}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">Total Numérotées</span>
                    <span className="text-xl font-black text-[#AFFF25]">{numbereds.length}</span>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setActiveDetail(null)} className="w-full py-4 bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white/20 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}