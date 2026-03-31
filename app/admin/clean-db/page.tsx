'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Database, CheckCircle, AlertTriangle } from 'lucide-react';

//  دیک DICTIONNAIRE DE TRADUCTION (Ancien nom -> Nouveau nom)
// Ajoute ici toutes les anciennes variations que tu veux transformer !
const VARIATION_MAPPING: Record<string, string> = {
  "Cartes de base": "Base",
  "Rookie Card (RC)": "Base", // Si tu veux fusionner les anciennes RC dans "Base"
  "Standard Refractor": "Standard Refractor",
  // Ajoute d'autres lignes ici au besoin : "Ancien Nom": "Nouveau Nom",
};

export default function CleanDBPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{ id: string; old: string; new: string; status: 'success' | 'error' }[]>([]);
  const [stats, setStats] = useState({ total: 0, updated: 0 });

  const runCleaner = async () => {
    setLoading(true);
    setLogs([]);
    let updatedCount = 0;

    try {
      // 1. On récupère toutes tes cartes (uniquement la colonne variation pour aller vite)
      const { data: cards, error: fetchError } = await supabase
        .from('cards')
        .select('id, variation');

      if (fetchError) throw fetchError;
      if (!cards) {
        alert("Aucune carte trouvée.");
        return;
      }

      setStats({ total: cards.length, updated: 0 });

      // 2. On passe sur chaque carte pour voir s'il faut la modifier
      for (const card of cards) {
        const oldVariation = card.variation;
        
        // Si l'ancienne variation est dans notre dictionnaire
        if (oldVariation && VARIATION_MAPPING[oldVariation] && VARIATION_MAPPING[oldVariation] !== oldVariation) {
          const newVariation = VARIATION_MAPPING[oldVariation];

          // On met à jour dans Supabase
          const { error: updateError } = await supabase
            .from('cards')
            .update({ variation: newVariation })
            .eq('id', card.id);

          if (updateError) {
            setLogs(prev => [{ id: card.id, old: oldVariation, new: newVariation, status: 'error' }, ...prev]);
          } else {
            updatedCount++;
            setStats(prev => ({ ...prev, updated: updatedCount }));
            setLogs(prev => [{ id: card.id, old: oldVariation, new: newVariation, status: 'success' }, ...prev]);
          }
        }
      }

    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue pendant le nettoyage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-8 mt-12">
        
        <header className="text-center space-y-4">
          <div className="w-16 h-16 bg-[#AFFF25]/10 rounded-full flex items-center justify-center mx-auto border border-[#AFFF25]/30">
            <Database size={32} className="text-[#AFFF25]" />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Nettoyeur de Base</h1>
          <p className="text-white/60 text-sm">Ce script va mettre à jour le nom des variations des anciennes cartes pour qu'elles correspondent au nouveau format JSON.</p>
        </header>

        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
          <h2 className="font-bold text-[#AFFF25] mb-4 uppercase tracking-widest text-xs">Dictionnaire Actuel :</h2>
          <ul className="text-sm space-y-2 text-white/80 font-mono bg-black/50 p-4 rounded-xl overflow-x-auto">
            {Object.entries(VARIATION_MAPPING).map(([oldVal, newVal]) => (
              <li key={oldVal}><span className="text-red-400">"{oldVal}"</span> <span className="text-white/30">➔</span> <span className="text-green-400">"{newVal}"</span></li>
            ))}
          </ul>
        </div>

        <button 
          onClick={runCleaner} 
          disabled={loading}
          className="w-full bg-[#AFFF25] text-[#040221] font-black italic uppercase tracking-widest py-4 rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <><Loader2 className="animate-spin" /> Nettoyage en cours...</> : 'Lancer le nettoyage complet'}
        </button>

        {stats.total > 0 && (
          <div className="text-center font-bold text-sm">
            Cartes analysées : {stats.total} | <span className="text-[#AFFF25]">Cartes corrigées : {stats.updated}</span>
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 font-bold uppercase tracking-widest text-[10px] text-white/50">Journal des modifications</div>
            <ul className="max-h-[300px] overflow-y-auto p-4 space-y-2">
              {logs.map((log, i) => (
                <li key={i} className="flex items-center gap-3 text-xs bg-white/5 p-2 rounded-lg">
                  {log.status === 'success' ? <CheckCircle size={14} className="text-[#AFFF25]" /> : <AlertTriangle size={14} className="text-red-500" />}
                  <span className="text-white/50">{log.id.slice(0, 8)}...</span>
                  <span className="text-red-400 line-through">{log.old}</span>
                  <span className="text-white/30">➔</span>
                  <span className="text-[#AFFF25]">{log.new}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}