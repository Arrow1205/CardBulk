'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, ChevronDown } from 'lucide-react';
import SET_DATA from '@/data/set.json';

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'F1': { image: 'F1', label: 'Formule 1' },
  'NFL': { image: 'NFL', label: 'Football Am.' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' }
};

// 🚀 COMPOSANT DONUT CHART (Génère le graphique dynamique avec les lignes)
const DonutChart = ({ data }: { data: { label: string, value: number }[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="text-center text-white/50 py-10 mt-6 italic">Aucune donnée</div>;

  let cumulativePercent = 0;
  const validData = data.filter(d => d.value > 0).map(d => {
    const percent = (d.value / total) * 100;
    cumulativePercent += percent;
    const middleAngle = ((cumulativePercent - percent / 2) / 100) * Math.PI * 2 - (Math.PI / 2);
    return { ...d, percent, middleAngle, cumulativePercent };
  });

  const colors = ['#AFFF25', '#8be600', '#caff5c', '#dfff8f', '#6ab300', '#b9ff33', '#eaffb3'];
  const circ = 2 * Math.PI * 40; // Circonférence pour le rayon 40

  return (
    <div className="relative w-full max-w-[280px] aspect-square mx-auto mt-10 mb-8">
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        {/* Les parts du camembert */}
        {validData.map((d, i) => {
          const dashArray = `${(d.percent / 100) * circ} ${circ}`;
          const prevCumulative = d.cumulativePercent - d.percent;
          const dashOffset = -((prevCumulative / 100) * circ);
          return (
            <g key={`slice-${i}`}>
              <circle
                cx="100" cy="100" r="40"
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth="24"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 100 100)"
                className="transition-all duration-1000 ease-out"
              />
              {/* Ligne d'espacement (Gap noir) */}
              <circle
                cx="100" cy="100" r="40"
                fill="transparent"
                stroke="#040221"
                strokeWidth="26"
                strokeDasharray={`1.5 ${circ - 1.5}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 100 100)"
              />
            </g>
          );
        })}
        
        {/* Les Lignes et les Labels pointant vers les sports */}
        {validData.map((d, i) => {
          if (d.percent < 2) return null; // Cache les labels trop petits
          const rOuter = 52; // Bord externe du camembert
          const rLabel = 75; // Position du texte
          const x1 = 100 + Math.cos(d.middleAngle) * rOuter;
          const y1 = 100 + Math.sin(d.middleAngle) * rOuter;
          const x2 = 100 + Math.cos(d.middleAngle) * rLabel;
          const y2 = 100 + Math.sin(d.middleAngle) * rLabel;
          
          const isRight = Math.cos(d.middleAngle) > 0;
          const textAnchor = isRight ? "start" : "end";
          const xText = x2 + (isRight ? 3 : -3);
          
          return (
            <g key={`label-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#AFFF25" strokeWidth="0.5" />
              <text x={xText} y={y2 + 3} fill="#AFFF25" fontSize="9" textAnchor={textAnchor} fontWeight="300" letterSpacing="0.05em">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};


export default function StatsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs' | 'budget'>('nombres');
  const [listType, setListType] = useState<'achat' | 'vente'>('achat');
  
  const [loading, setLoading] = useState(true);
  
  // Données
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  
  // Formulaire Budget
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemMonth, setNewItemMonth] = useState(''); 

  const [chartMonths, setChartMonths] = useState<{label: string, key: string}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    const months = [];
    const d = new Date();
    for (let i = 4; i >= 0; i--) {
      const d2 = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push({
        label: d2.toLocaleString('fr-FR', { month: 'short' }).replace('.', ''),
        key: `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`
      });
    }
    setChartMonths(months);
    const currentMonth = months[months.length - 1].key;
    setSelectedMonth(currentMonth); 
    setNewItemMonth(currentMonth); 
    
    fetchAllData();
  }, []);

  useEffect(() => {
    if (selectedMonth) setNewItemMonth(selectedMonth);
  }, [selectedMonth]);

  const fetchAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (txData) setTransactions(txData);

    const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id).eq('is_wishlist', false);
    if (cardsData) setCards(cardsData);

    setLoading(false);
  };

  const handleAddTransaction = async () => {
    if (!newItemName || !newItemPrice) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const retroDate = new Date(`${newItemMonth}-15T12:00:00Z`).toISOString();
    const newTx = { user_id: user.id, type: listType, name: newItemName, amount: parseFloat(newItemPrice), date: retroDate };

    await supabase.from('transactions').insert([newTx]);
    
    setNewItemName(''); setNewItemPrice(''); setIsAdding(false);
    const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (data) setTransactions(data);
  };

  // --- DONNÉES BUDGET ---
  const chartData = chartMonths.map(m => {
    const txs = transactions.filter(t => t.date.startsWith(m.key));
    const achats = txs.filter(t => t.type === 'achat').reduce((sum, t) => sum + t.amount, 0);
    const ventes = txs.filter(t => t.type === 'vente').reduce((sum, t) => sum + t.amount, 0);
    return { ...m, achats, ventes };
  });
  const maxAmount = Math.max(1, ...chartData.map(d => Math.max(d.achats, d.ventes)));
  const displayTransactions = transactions.filter(t => t.type === listType && t.date.startsWith(selectedMonth));

  // --- DONNÉES CARTES (Nombres / Valeurs) ---
  const formatNum = (val: number) => new Intl.NumberFormat('fr-FR').format(val);
  const formatEuro = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const totalCards = cards.length;
  const totalValue = cards.reduce((sum, c) => sum + (c.purchase_price || 0), 0);
  
  const autoCount = cards.filter(c => c.is_auto).length;
  const patchCount = cards.filter(c => c.is_patch).length;
  const numberedCount = cards.filter(c => c.is_numbered).length;
  
  const autoValue = cards.filter(c => c.is_auto).reduce((sum, c) => sum + (c.purchase_price || 0), 0);
  const patchValue = cards.filter(c => c.is_patch).reduce((sum, c) => sum + (c.purchase_price || 0), 0);
  const numberedValue = cards.filter(c => c.is_numbered).reduce((sum, c) => sum + (c.purchase_price || 0), 0);

  // Groupement par sports pour les Graphiques
  const sportCounts: Record<string, number> = {};
  const sportValues: Record<string, number> = {};
  cards.forEach(c => {
    const label = c.sport ? (SPORT_CONFIG[c.sport]?.label || c.sport) : 'Autre';
    sportCounts[label] = (sportCounts[label] || 0) + 1;
    sportValues[label] = (sportValues[label] || 0) + (c.purchase_price || 0);
  });
  const donutCountData = Object.keys(sportCounts).map(k => ({ label: k, value: sportCounts[k] }));
  const donutValueData = Object.keys(sportValues).map(k => ({ label: k, value: sportValues[k] }));

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-x-hidden pb-36 z-10">
      
      {/* 🚀 CORRECTION : UN SEUL DEGRADÉ FIDÈLE À LA MAQUETTE */}
      <div className="absolute top-0 left-0 w-full h-[350px] pointer-events-none -z-10" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(175,255,37,0.3) 0%, transparent 80%)' }}></div>

      <header className="pt-12 pb-8 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">STATS</h1>
      </header>

      {/* Tabs */}
      <div className="flex justify-center gap-8 px-6 mb-12">
        <button onClick={() => setActiveTab('nombres')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'nombres' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Nombres</button>
        <button onClick={() => setActiveTab('valeurs')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'valeurs' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Valeurs</button>
        <button onClick={() => setActiveTab('budget')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'budget' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Budget</button>
      </div>

      {loading ? (
         <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>
      ) : (
        <div className="px-6 animate-in fade-in duration-500">
          
          {/* 🚀 ONGLET NOMBRES */}
          {activeTab === 'nombres' && (
            <div>
              <div className="text-center mb-8">
                <div className="text-7xl font-black italic text-white tracking-tight leading-none mb-1">{formatNum(totalCards)}</div>
                <div className="text-xs text-white/50 tracking-widest uppercase">Cartes</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1">Autos</span>
                  <span className="text-xl font-black italic text-[#AFFF25]">{autoCount}</span>
                </div>
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1">Patchs</span>
                  <span className="text-xl font-black italic text-[#AFFF25]">{patchCount}</span>
                </div>
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1">Numérotées</span>
                  <span className="text-xl font-black italic text-[#AFFF25]">{numberedCount}</span>
                </div>
              </div>
              <DonutChart data={donutCountData} />
            </div>
          )}

          {/* 🚀 ONGLET VALEURS */}
          {activeTab === 'valeurs' && (
            <div>
              <div className="text-center mb-8">
                <div className="text-7xl font-black italic text-white tracking-tight leading-none mb-1">
                  {formatNum(totalValue)}<span className="text-5xl ml-1">€</span>
                </div>
                <div className="text-xs text-white/50 tracking-widest uppercase">Cartes</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1">Autos</span>
                  <span className="text-[13px] font-black italic text-[#AFFF25]">{formatEuro(autoValue)}</span>
                </div>
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1">Patchs</span>
                  <span className="text-[13px] font-black italic text-[#AFFF25]">{formatEuro(patchValue)}</span>
                </div>
                <div className="border border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-white/80 mb-1 leading-tight">Numérotées</span>
                  <span className="text-[13px] font-black italic text-[#AFFF25]">{formatEuro(numberedValue)}</span>
                </div>
              </div>
              <DonutChart data={donutValueData} />
            </div>
          )}

          {/* 🚀 ONGLET BUDGET */}
          {activeTab === 'budget' && (
            <>
              <div className="relative h-64 flex items-center justify-between mb-12 mt-8">
                <div className="absolute w-full h-[1px] bg-white top-1/2 left-0 -translate-y-1/2 z-0" />
                
                {chartData.map((data, i) => {
                  const isSelected = selectedMonth === data.key;
                  const achatHeight = (data.achats / maxAmount) * 90;
                  const venteHeight = (data.ventes / maxAmount) * 90;

                  return (
                    <div key={i} onClick={() => setSelectedMonth(data.key)} className={`relative z-10 flex flex-col items-center justify-center w-[18%] h-full cursor-pointer transition-opacity ${isSelected ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}>
                      <div className="flex flex-col justify-end items-center h-1/2 w-full pb-1">
                        {data.achats > 0 && <span className="text-[10px] font-bold text-[#AFFF25] mb-1">{data.achats}€</span>}
                        <div className="w-10 bg-[#AFFF25] rounded-t-full transition-all duration-500 ease-out" style={{ height: `${achatHeight}%`, minHeight: data.achats > 0 ? '4px' : '0px' }} />
                      </div>
                      <span className="absolute top-1/2 -translate-y-1/2 z-20 text-[9px] font-black uppercase text-black bg-[#AFFF25] px-1 rounded-sm">{data.label}</span>
                      <div className="flex flex-col justify-start items-center h-1/2 w-full pt-1">
                        <div className="w-10 bg-[#AFFF25] rounded-b-full transition-all duration-500 ease-out" style={{ height: `${venteHeight}%`, minHeight: data.ventes > 0 ? '4px' : '0px' }} />
                        {data.ventes > 0 && <span className="text-[10px] font-bold text-[#AFFF25] mt-1">{data.ventes}€</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4 mb-10">
                <button onClick={() => { setListType('achat'); setIsAdding(false); }} className={`px-8 py-2 rounded-full text-sm font-bold tracking-widest transition-all ${listType === 'achat' ? 'bg-[#1D00FF] text-white shadow-[0_0_15px_rgba(29,0,255,0.5)]' : 'text-white/50 border border-white/20'}`}>Achats</button>
                <button onClick={() => { setListType('vente'); setIsAdding(false); }} className={`px-8 py-2 rounded-full text-sm font-bold tracking-widest transition-all ${listType === 'vente' ? 'bg-[#1D00FF] text-white shadow-[0_0_15px_rgba(29,0,255,0.5)]' : 'text-white/50 border border-white/20'}`}>Ventes</button>
              </div>

              <div className="mb-6">
                <div className="flex justify-between border-b border-white/20 pb-2 mb-4">
                  <span className="text-[#1D00FF] italic font-black uppercase tracking-widest">Carte</span>
                  <span className="text-[#1D00FF] italic font-black uppercase tracking-widest">Prix</span>
                </div>
                
                <div className="space-y-4 mb-8 min-h-[100px]">
                  {displayTransactions.length === 0 ? (
                    <div className="text-white/30 text-center text-sm italic pt-4">Aucune donnée pour ce mois.</div>
                  ) : (
                    displayTransactions.map(tx => (
                      <div key={tx.id} className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-sm font-medium uppercase tracking-wider truncate pr-4">{tx.name}</span>
                        <span className="text-sm font-bold flex-shrink-0">{tx.amount}€</span>
                      </div>
                    ))
                  )}
                </div>

                {!isAdding ? (
                  <div className="flex justify-center">
                    <button onClick={() => setIsAdding(true)} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all">
                      <Plus className="text-white" size={24} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] text-white/50 italic mb-1 block uppercase tracking-widest">Titre (Ex: Mbappe eBay)</label>
                        <input value={newItemName} onChange={e => setNewItemName(e.target.value.toUpperCase())} className="w-full bg-[#040221] border border-white/20 rounded-full px-4 py-3 outline-none focus:border-[#1D00FF] text-sm" />
                      </div>
                      <div className="w-1/3">
                        <label className="text-[10px] text-white/50 italic mb-1 block uppercase tracking-widest">Prix</label>
                        <div className="relative">
                          <input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full bg-[#040221] border border-white/20 rounded-full px-4 py-3 outline-none focus:border-[#1D00FF] text-sm text-center" />
                          <span className="absolute right-4 top-3 text-white/50 font-bold">€</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative w-full">
                      <label className="text-[10px] text-white/50 italic mb-1 block uppercase tracking-widest">Mois concerné</label>
                      <select value={newItemMonth} onChange={e => setNewItemMonth(e.target.value)} className="w-full bg-[#040221] border border-white/20 rounded-full px-4 py-3 outline-none focus:border-[#1D00FF] text-sm appearance-none">
                        {chartMonths.map(m => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-8 text-white/50 pointer-events-none" size={16} />
                    </div>

                    <button onClick={handleAddTransaction} disabled={!newItemName || !newItemPrice} className="w-full py-3 mt-2 rounded-full bg-[#1D00FF] text-white font-bold uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(29,0,255,0.4)] disabled:opacity-50 active:scale-95 transition-all">
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}