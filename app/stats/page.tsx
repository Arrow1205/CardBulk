'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus } from 'lucide-react';

export default function StatsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs' | 'budget'>('budget');
  const [listType, setListType] = useState<'achat' | 'vente'>('achat');
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // États pour le formulaire
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Générer les 5 derniers mois pour le graphique
  const [chartMonths, setChartMonths] = useState<{label: string, key: string}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    // Initialise les mois (ex: Janvier, Fevrier...)
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
    setSelectedMonth(months[months.length - 1].key); // Sélectionne le mois en cours par défaut
    
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (data) setTransactions(data);
    setLoading(false);
  };

  const handleAddTransaction = async () => {
    if (!newItemName || !newItemPrice) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newTx = {
      user_id: user.id,
      type: listType,
      name: newItemName,
      amount: parseFloat(newItemPrice),
      // On l'ajoute à la date du jour (qui tombera dans le selectedMonth si c'est le mois en cours)
      date: new Date().toISOString()
    };

    await supabase.from('transactions').insert([newTx]);
    
    setNewItemName('');
    setNewItemPrice('');
    setIsAdding(false);
    fetchTransactions();
  };

  // --- PRÉPARATION DES DONNÉES DU GRAPHIQUE ---
  const chartData = chartMonths.map(m => {
    const txs = transactions.filter(t => t.date.startsWith(m.key));
    const achats = txs.filter(t => t.type === 'achat').reduce((sum, t) => sum + t.amount, 0);
    const ventes = txs.filter(t => t.type === 'vente').reduce((sum, t) => sum + t.amount, 0);
    return { ...m, achats, ventes };
  });

  // Trouver la valeur max pour dimensionner les barres (on prend le max entre achats et ventes de tous les mois)
  const maxAmount = Math.max(1, ...chartData.map(d => Math.max(d.achats, d.ventes)));

  // --- FILTRAGE DE LA LISTE DU BAS ---
  const displayTransactions = transactions.filter(t => 
    t.type === listType && t.date.startsWith(selectedMonth)
  );

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-x-hidden pb-36">
      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-[250px] pointer-events-none -z-10" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(175,255,37,0.3) 0%, transparent 70%)' }}></div>

      <header className="pt-12 pb-8 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter">STATS</h1>
      </header>

      {/* Tabs Principaux */}
      <div className="flex justify-center gap-8 px-6 mb-12">
        <button onClick={() => setActiveTab('nombres')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'nombres' ? 'text-white' : 'text-white/40'}`}>Nombres</button>
        <button onClick={() => setActiveTab('valeurs')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'valeurs' ? 'text-white' : 'text-white/40'}`}>Valeurs</button>
        <button onClick={() => setActiveTab('budget')} className={`text-lg font-bold tracking-widest transition-colors ${activeTab === 'budget' ? 'text-[#AFFF25]' : 'text-white/40'}`}>Budget</button>
      </div>

      {activeTab === 'budget' && (
        <div className="px-6 animate-in fade-in duration-500">
          
          {loading ? (
             <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>
          ) : (
            <>
              {/* GRAPHIQUE À DIVERGENCE */}
              <div className="relative h-64 flex items-center justify-between mb-12">
                {/* Ligne centrale de base zéro */}
                <div className="absolute w-full h-[1px] bg-white top-1/2 left-0 -translate-y-1/2 z-0" />
                
                {chartData.map((data, i) => {
                  const isSelected = selectedMonth === data.key;
                  // Calcul de la hauteur en % (max 90% de la demi-hauteur pour laisser de la place au texte)
                  const achatHeight = (data.achats / maxAmount) * 90;
                  const venteHeight = (data.ventes / maxAmount) * 90;

                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedMonth(data.key)}
                      className={`relative z-10 flex flex-col items-center justify-center w-[18%] h-full cursor-pointer transition-opacity ${isSelected ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                    >
                      {/* Barre Supérieure : ACHATS (Dépenses) */}
                      <div className="flex flex-col justify-end items-center h-1/2 w-full pb-1">
                        {data.achats > 0 && <span className="text-[10px] font-bold text-[#AFFF25] mb-1">{data.achats}€</span>}
                        <div 
                          className="w-10 bg-[#AFFF25] rounded-t-full transition-all duration-500 ease-out" 
                          style={{ height: `${achatHeight}%`, minHeight: data.achats > 0 ? '4px' : '0px' }} 
                        />
                      </div>

                      {/* Label du mois (superposé à la ligne centrale) */}
                      <span className="absolute top-1/2 -translate-y-1/2 z-20 text-[9px] font-black uppercase text-black bg-[#AFFF25] px-1 rounded-sm">
                        {data.label}
                      </span>

                      {/* Barre Inférieure : VENTES (Revenus) */}
                      <div className="flex flex-col justify-start items-center h-1/2 w-full pt-1">
                        <div 
                          className="w-10 bg-[#AFFF25] rounded-b-full transition-all duration-500 ease-out" 
                          style={{ height: `${venteHeight}%`, minHeight: data.ventes > 0 ? '4px' : '0px' }} 
                        />
                        {data.ventes > 0 && <span className="text-[10px] font-bold text-[#AFFF25] mt-1">{data.ventes}€</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TOGGLE ACHATS / VENTES */}
              <div className="flex justify-center gap-4 mb-10">
                <button 
                  onClick={() => { setListType('achat'); setIsAdding(false); }}
                  className={`px-8 py-2 rounded-full text-sm font-bold tracking-widest transition-all ${listType === 'achat' ? 'bg-[#1D00FF] text-white shadow-[0_0_15px_rgba(29,0,255,0.5)]' : 'text-white/50'}`}
                >
                  Achats
                </button>
                <button 
                  onClick={() => { setListType('vente'); setIsAdding(false); }}
                  className={`px-8 py-2 rounded-full text-sm font-bold tracking-widest transition-all ${listType === 'vente' ? 'bg-[#1D00FF] text-white shadow-[0_0_15px_rgba(29,0,255,0.5)]' : 'text-white/50'}`}
                >
                  Ventes
                </button>
              </div>

              {/* LISTE DES TRANSACTIONS */}
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
                        <span className="text-sm font-medium uppercase tracking-wider">{tx.name}</span>
                        <span className="text-sm font-bold">{tx.amount}€</span>
                      </div>
                    ))
                  )}
                </div>

                {/* FORMULAIRE D'AJOUT */}
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
                        <label className="text-xs text-white/50 italic mb-1 block">Cartes</label>
                        <input 
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value.toUpperCase())}
                          className="w-full bg-transparent border border-white/20 rounded-full px-4 py-2 outline-none focus:border-[#1D00FF] text-sm"
                        />
                      </div>
                      <div className="w-1/3">
                        <label className="text-xs text-white/50 italic mb-1 block">Prix</label>
                        <input 
                          type="number"
                          value={newItemPrice}
                          onChange={e => setNewItemPrice(e.target.value)}
                          className="w-full bg-transparent border border-white/20 rounded-full px-4 py-2 outline-none focus:border-[#1D00FF] text-sm text-center"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleAddTransaction}
                      disabled={!newItemName || !newItemPrice}
                      className="w-full py-3 rounded-full border border-[#1D00FF] text-[#1D00FF] font-bold uppercase tracking-widest text-sm hover:bg-[#1D00FF]/10 disabled:opacity-50 transition-all"
                    >
                      Ajouter {listType}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Placeholders pour les autres onglets */}
      {activeTab === 'nombres' && <div className="text-center text-white/40 mt-20">Contenu Nombres à venir...</div>}
      {activeTab === 'valeurs' && <div className="text-center text-white/40 mt-20">Contenu Valeurs à venir...</div>}
    </div>
  );
}