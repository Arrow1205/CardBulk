'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Database, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';

export default function CleanDBPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{ id: string; old: string; new: string; status: 'success' | 'error' | 'skipped' }[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, updated: 0 });

  const runAIAssistant = async () => {
    const confirm = window.confirm("Ceci va envoyer toutes les cartes sans variation à l'IA pour analyse. L'opération peut prendre quelques minutes. Continuer ?");
    if (!confirm) return;

    setLoading(true);
    setLogs([]);
    let processedCount = 0;
    let updatedCount = 0;

    try {
      // 1. On récupère TOUTES tes cartes (ID, variation actuelle, et surtout l'IMAGE)
      const { data: cards, error: fetchError } = await supabase
        .from('cards')
        .select('id, variation, image_url, brand, series');

      if (fetchError) throw fetchError;
      if (!cards || cards.length === 0) {
        alert("Aucune carte trouvée.");
        setLoading(false);
        return;
      }

      setStats({ total: cards.length, processed: 0, updated: 0 });

      // 2. On passe sur chaque carte, UNE par UNE
      for (const card of cards) {
        processedCount++;
        setStats(prev => ({ ...prev, processed: processedCount }));

        // Si la carte n'a pas d'image, on saute
        if (!card.image_url) {
          setLogs(prev => [{ id: card.id, old: card.variation || 'Vide', new: 'Pas d\'image', status: 'skipped' }, ...prev]);
          continue;
        }

        // OPTIMISATION : Si la carte a DÉJÀ une variation valide, tu peux décommenter les 2 lignes ci-dessous pour ne pas la refaire.
        // Mais si tu veux TOUT forcer au nouveau format, laisse le code l'analyser !
        // if (card.variation && card.variation !== "" && card.variation !== "Cartes de base") { continue; }

        try {
          // 3. On envoie l'URL de l'image à ton API IA (/api/scan) en arrière-plan
          const formData = new FormData();
          formData.append("imageUrl", card.image_url);
          formData.append("auto_crop", "false"); // Pas besoin de recadrer, on veut juste lire la carte !

          const res = await fetch("/api/scan", { method: "POST", body: formData });
          const aiData = await res.json();

          if (aiData && aiData.variation && !aiData.error) {
            
            // 4. L'IA a trouvé la variation ! On met à jour la base de données.
            // (On met aussi à jour la numérotation au cas où l'IA trouve "Red /50")
            const updatePayload: any = { variation: aiData.variation };
            if (aiData.is_numbered) {
               updatePayload.is_numbered = true;
               if (aiData.num_low) updatePayload.numbering_low = parseInt(aiData.num_low) || null;
               if (aiData.num_high) updatePayload.numbering_max = parseInt(aiData.num_high) || null;
            }

            const { error: updateError } = await supabase
              .from('cards')
              .update(updatePayload)
              .eq('id', card.id);

            if (updateError) throw updateError;

            updatedCount++;
            setStats(prev => ({ ...prev, updated: updatedCount }));
            setLogs(prev => [{ id: card.id, old: card.variation || 'Vide', new: aiData.variation, status: 'success' }, ...prev]);
            
          } else {
            setLogs(prev => [{ id: card.id, old: card.variation || 'Vide', new: 'Échec IA', status: 'error' }, ...prev]);
          }
        } catch (apiErr) {
          setLogs(prev => [{ id: card.id, old: card.variation || 'Vide', new: 'Erreur Serveur', status: 'error' }, ...prev]);
        }

        // ⏱️ PAUSE DE SÉCURITÉ : On attend 2 secondes entre chaque image pour ne pas faire exploser le serveur Gemini (Rate Limit)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (err) {
      console.error(err);
      alert("Une erreur fatale est survenue pendant le scan.");
    } finally {
      setLoading(false);
      alert("🎉 Scan IA terminé !");
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-8 mt-12">
        
        <header className="text-center space-y-4">
          <div className="w-16 h-16 bg-[#AFFF25]/10 rounded-full flex items-center justify-center mx-auto border border-[#AFFF25]/30">
            <Sparkles size={32} className="text-[#AFFF25]" />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Re-Scan IA Complet</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            L'IA va repasser sur <strong>toutes tes cartes enregistrées</strong>. Elle va regarder la photo d'origine, appliquer ton nouveau dictionnaire, et remplir les variations vides (et même les numérotations !).
          </p>
        </header>

        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-xs text-red-200 text-center">
          ⚠️ Garde cette page ouverte pendant toute l'opération. L'IA analyse environ 30 cartes par minute.
        </div>

        <button 
          onClick={runAIAssistant} 
          disabled={loading}
          className="w-full bg-[#AFFF25] text-[#040221] font-black italic uppercase tracking-widest py-4 rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <><Loader2 className="animate-spin" /> Analyse des cartes en cours...</> : 'Lancer la Magie IA'}
        </button>

        {stats.total > 0 && (
          <div className="text-center font-bold text-sm bg-black/50 p-4 rounded-full border border-white/10">
            Cartes en base : {stats.total} | Analysées : {stats.processed} | <span className="text-[#AFFF25]">Mises à jour : {stats.updated}</span>
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 font-bold uppercase tracking-widest text-[10px] text-white/50 flex justify-between">
              <span>Journal en direct</span>
              {loading && <span className="text-[#AFFF25] animate-pulse">L'IA réfléchit...</span>}
            </div>
            <ul className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {logs.map((log, i) => (
                <li key={i} className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-lg">
                  {log.status === 'success' ? <CheckCircle size={16} className="text-[#AFFF25]" /> : 
                   log.status === 'skipped' ? <div className="w-4 h-4 rounded-full border border-white/30" /> :
                   <AlertTriangle size={16} className="text-red-500" />}
                  
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="text-white/40">ID: {log.id.slice(0, 6)}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-red-300 line-through min-w-[80px]">{log.old}</span>
                      <span className="text-white/30">➔</span>
                      <span className="text-[#AFFF25] font-bold">{log.new}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}