'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, ChevronDown } from 'lucide-react';

export default function StatsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs' | 'budget'>('budget');
  const [listType, setListType] = useState<'achat' | 'vente'>('achat');
  
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemMonth, setNewItemMonth] = useState(''); // 🚀 Nouveau state pour le mois rétroactif

  const [chartMonths, setChartMonths] = useState<{label: string, key: string}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    const months = [];
    const d = new Date();
    // On génère les 5 derniers mois
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
    setNewItemMonth(currentMonth); // Initialise le formulaire au mois en cours
    
    fetchAllData();
  }, []);

  // 🚀 Synchro : Quand on clique sur un mois du graph, le formulaire se cale dessus
  useEffect(() => {
    if (selectedMonth) setNewItemMonth(selectedMonth);
  }, [selectedMonth]);

  const fetchAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (txData) setTransactions(txData);

    const { data: cardsData } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_wishlist', false);

    if (cardsData) setCards(cardsData);

    setLoading(false);
  };

  const handleAddTransaction = async () => {
    if (!newItemName || !newItemPrice) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 🚀 Création d'une date artificielle basée sur le mois sélectionné (le 15 du mois à midi)
    const retroDate = new Date(`${newItemMonth}-15T12:00:00Z`).toISOString();

    const newTx = {
      user_id: user.id,
      type: listType,
      name: newItemName,
      amount: parseFloat(newItemPrice),
      date: retroDate
    };

    await supabase.from('transactions').insert([newTx]);
    
    setNewItemName('');
    setNewItemPrice('');
    setIsAdding(false);
    
    const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (data) setTransactions(data);
  };

  const chartData = chartMonths.map(m => {
    const txs = transactions.filter(t => t.date.startsWith(m.key));
    const achats = txs.filter(t => t.type === 'achat').reduce((sum, t) => sum + t.amount, 0);
    const ventes = txs.filter(t => t.type === 'vente').reduce((sum, t) => sum + t.amount, 0);
    return { ...m, achats, ventes };
  });

  const maxAmount = Math.max(1, ...chartData.map(d => Math.max(d.achats, d.ventes)));
  const displayTransactions = transactions.filter(t => t.type === listType && t.date.startsWith(selectedMonth));

  const totalCards = cards.length;
  const totalValue = cards.reduce((sum, c) => sum + (c.purchase_price || 0), 0);
  const avgValue = totalCards > 0 ? (totalValue / totalCards).toFixed(1) : 0;
  
  const autoCount = cards.filter(c => c.is_auto).length;
  const patchCount = cards.filter(c => c.is_patch).length;
  const numberedCount = cards.filter(c => c.is_numbered).length;

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-x-hidden pb-36 z-10">
      
      {/* 🚀 LE FAMEUX DEGRADÉ DE LA MAQUETTE */}
      <div className="absolute top-0 left-0 w-full h-[250px] pointer-events-none -z-10" style={{ background: 'linear-gradient(180deg, rgba(175,255,37,0.3) 0%, rgba(4,2,33,0) 100%)' }}></div>
      <div className="absolute top-0 left-0 w-full h-[70px] pointer-events-none -z-10" style={{ background: 'linear-gradient(0deg, #040221 15.71%, #AFFF25 100%)', opacity: 0.6 }}></div>

      <header className="pt-12 pb-8 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">STATS</h1>
      </header>

      <div className="flex justify-center gap-8 px-6 mb-12">
        <button onClick={() => setActiveTab('nombres')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'nombres' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Nombres</button>
        <button onClick={() => setActiveTab('valeurs')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'valeurs' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Valeurs</button>
        <button onClick={() => setActiveTab('budget')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'budget' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Budget</button>
      </div>

      {loading ? (
         <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>
      ) : (
        <div className="px-6 animate-in fade-in duration-500">
          
          {activeTab === 'nombres' && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-[#AFFF25]/30 rounded-3xl p-8 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(175,255,37,0.1)]">
                <span className="text-white/50 text-sm font-bold tracking-widest uppercase mb-2">Total Cartes</span>
                <span className="text-7xl font-black italic text-[#AFFF25]">{totalCards}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                  <span className="text-3xl font-black italic text-white mb-1">{autoCount}</span>
                  <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Autos</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                  <span className="text-3xl font-black italic text-white mb-1">{patchCount}</span>
                  <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Patchs</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                  <span className="text-3xl font-black italic text-white mb-1">{numberedCount}</span>
                  <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Num</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'valeurs' && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-[#AFFF25]/30 rounded-3xl p-8 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(175,255,37,0.1)]">
                <span className="text-white/50 text-sm font-bold tracking-widest uppercase mb-2">Valeur Collection</span>
                <div className="flex items-start">
                  <span className="text-7xl font-black italic text-[#AFFF25] leading-none">{totalValue}</span>
                  <span className="text-2xl font-black text-[#AFFF25] mt-1 ml-1">€</span>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex justify-between items-center">
                <span className="text-white/50 text-sm font-bold tracking-widest uppercase">Prix Moyen / Carte</span>
                <span className="text-2xl font-black italic text-white">{avgValue} €</span>
              </div>
            </div>
          )}

          {activeTab === 'budget' && (
            <>
              <div className="relative h-64 flex items-center justify-between mb-12">
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
                    
                    {/* 🚀 SELECTEUR DE MOIS (RÉTROACTIVITÉ) */}
                    <div className="relative w-full">
                      <label className="text-[10px] text-white/50 italic mb-1 block uppercase tracking-widest">Mois concerné</label>
                      <select 
                        value={newItemMonth} 
                        onChange={e => setNewItemMonth(e.target.value)} 
                        className="w-full bg-[#040221] border border-white/20 rounded-full px-4 py-3 outline-none focus:border-[#1D00FF] text-sm appearance-none"
                      >
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