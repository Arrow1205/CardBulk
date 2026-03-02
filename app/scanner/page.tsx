'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Image as ImageIcon, Search, Check } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'recto' | 'verso'>('recto');

  // État du formulaire (basé sur tes maquettes)
  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    firstname: 'KYLIAN',
    lastname: 'MBAPPE',
    club: 'Arsenal FC',
    brand: 'Topps',
    set: 'TOPPS CHROME',
    year: '2025',
    is_auto: true,
    is_numbered: true,
    number_actual: '08',
    number_max: '50',
    price: '50'
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert([{
          ...formData,
          is_wishlist: false,
          created_at: new Date()
        }]);

      if (error) throw error;
      alert("Carte enregistrée dans l'Empire !");
      router.push('/collection');
    } catch (err) {
      console.error(err);
      alert("Erreur Supabase : Vérifie tes variables d'environnement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-40">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Ajouter</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <p className="text-center text-[#AFFF25] font-bold text-[10px] uppercase tracking-[0.2em] mb-8">
        Scan ou upload ta carte
      </p>

      {/* Onglets Recto/Verso */}
      <div className="flex bg-black/40 p-1 rounded-2xl mb-10 border border-white/5">
        <button 
          onClick={() => setActiveTab('recto')}
          className={`flex-1 py-3 rounded-xl font-black italic uppercase text-sm transition-all ${activeTab === 'recto' ? 'bg-[#AFFF25] text-black' : 'text-white'}`}
        >
          Recto
        </button>
        <button 
          onClick={() => setActiveTab('verso')}
          className={`flex-1 py-3 rounded-xl font-black italic uppercase text-sm transition-all ${activeTab === 'verso' ? 'bg-[#AFFF25] text-black' : 'text-white'}`}
        >
          Verso
        </button>
      </div>

      {/* Zone de Scan / Image */}
      <div className="relative aspect-[3/4] w-full max-w-[300px] mx-auto mb-10 border-2 border-dashed border-[#AFFF25]/30 rounded-[32px] flex flex-col items-center justify-center bg-white/5 gap-4">
        <div className="flex gap-4">
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
            <Camera size={24} className="text-[#AFFF25]" />
            <span className="text-[10px] font-bold uppercase">App photo</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
            <ImageIcon size={24} className="text-[#AFFF25]" />
            <span className="text-[10px] font-bold uppercase">Bibliothèque</span>
          </button>
        </div>
        <p className="absolute -bottom-8 italic text-sm text-[#AFFF25] animate-pulse">Analyse en cours !</p>
      </div>

      {/* Formulaire (Style Maquette) */}
      <div className="space-y-6 mt-16">
        <section>
          <h3 className="text-xl font-black italic uppercase mb-4">Joueur</h3>
          <div className="space-y-4">
            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Sport</label>
              <input value={formData.sport} readOnly className="bg-transparent w-full font-bold outline-none uppercase" />
            </div>
            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Prénom</label>
              <input value={formData.firstname} readOnly className="bg-transparent w-full font-bold outline-none uppercase" />
            </div>
            <div className="bg-black/40 border border-white/10 p-4 rounded-2xl flex justify-between items-center">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Club</label>
                <input value={formData.club} readOnly className="bg-transparent w-full font-bold outline-none uppercase" />
              </div>
              <Search size={18} className="text-[#AFFF25]" />
            </div>
          </div>
        </section>

        {/* Bouton Enregistrer */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[24px] uppercase tracking-widest shadow-xl shadow-[#AFFF25]/20 disabled:opacity-50"
        >
          {loading ? 'Connexion Supabase...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}