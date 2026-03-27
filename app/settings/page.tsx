'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronLeft, Check } from 'lucide-react';

const SPORT_CONFIG = [
  { id: 'SOCCER', label: 'Football' },
  { id: 'BASKETBALL', label: 'Basketball' },
  { id: 'BASEBALL', label: 'Baseball' },
  { id: 'F1', label: 'Formule 1' },
  { id: 'NFL', label: 'Football Am.' },
  { id: 'NHL', label: 'Hockey' },
  { id: 'TENNIS', label: 'Tennis' }
];

export default function SettingsPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [pseudo, setPseudo] = useState('');
  const [age, setAge] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // 🚨 CORRECTION : On utilise maybeSingle() au lieu de single()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); 

      if (error) throw error;

      if (profile) {
        setPseudo(profile.pseudo || '');
        setAge(profile.age ? profile.age.toString() : '');
        setSelectedSports(profile.sports || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Impossible de charger les données du profil.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autorisé");

      // 🚨 CORRECTION : On utilise upsert() (Update ou Insert) pour forcer la création si manquant
      const { error } = await supabase.from('profiles').upsert({
        id: user.id, // Obligatoire pour un upsert
        pseudo,
        age: parseInt(age) || null,
        sports: selectedSports
      });

      if (error) throw error;
      
      setSuccessMsg('Profil mis à jour avec succès !');
      
      // Met à jour le localStorage si on utilise le multi-compte
      const stored = localStorage.getItem('cardbulk_accounts');
      if (stored) {
        let parsedAccs = JSON.parse(stored);
        const accIndex = parsedAccs.findIndex((a: any) => a.id === user.id);
        if (accIndex > -1) {
          parsedAccs[accIndex].pseudo = pseudo;
          localStorage.setItem('cardbulk_accounts', JSON.stringify(parsedAccs));
        }
      }

      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Erreur lors de la sauvegarde du profil.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSport = (sportId: string) => {
    setSelectedSports(prev => prev.includes(sportId) ? prev.filter(id => id !== sportId) : [...prev, sportId]);
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#040221] text-white flex flex-col px-6 relative overflow-hidden font-sans pb-32">
      
      {/* Background décoratif */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#AFFF25]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <header className="pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 relative z-20 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black italic uppercase tracking-tighter text-[#AFFF25]">Paramètres</h1>
        <div className="w-10"></div> {/* Spacer pour centrer le titre */}
      </header>

      <div className="w-full max-w-sm mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-300 mt-6">
        
        <p className="text-white/60 text-xs text-center mb-8 font-medium">
          Mets à jour tes informations et tes préférences de collection.
        </p>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs font-bold p-4 rounded-xl mb-6 text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-[#AFFF25]/10 border border-[#AFFF25]/50 text-[#AFFF25] text-xs font-bold p-4 rounded-xl mb-6 text-center flex items-center justify-center gap-2">
            <Check size={16} /> {successMsg}
          </div>
        )}

        <form onSubmit={updateProfile} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Ton Pseudo</label>
              <input 
                type="text" required placeholder="Ex: PaniniMaster99"
                value={pseudo} onChange={e => setPseudo(e.target.value)}
                className="w-full bg-[#080531] border border-white/10 p-3.5 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" 
              />
            </div>
            <div className="relative">
              <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Ton Âge (Optionnel)</label>
              <input 
                type="number" placeholder="Ex: 28" min="1" max="99"
                value={age} onChange={e => setAge(e.target.value)}
                className="w-full bg-[#080531] border border-white/10 p-3.5 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" 
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-3">Que collectionnes-tu ? (Optionnel)</label>
            <div className="flex flex-wrap gap-2">
              {SPORT_CONFIG.map(sport => {
                const isSelected = selectedSports.includes(sport.id);
                return (
                  <button
                    key={sport.id} type="button"
                    onClick={() => toggleSport(sport.id)}
                    className={`px-4 py-2 rounded-full border text-xs font-bold transition-all duration-200 ${
                      isSelected ? 'bg-[#AFFF25] border-[#AFFF25] text-[#040221]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {sport.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button disabled={saving || !pseudo} type="submit" className="w-full bg-[#AFFF25] text-[#040221] py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#9ee615] active:scale-95 transition-all mt-8 disabled:opacity-50 shadow-[0_0_20px_rgba(175,255,37,0.2)]">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>
    </div>
  );
}