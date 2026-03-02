'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Image as ImageIcon, Search } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'recto' | 'verso'>('recto');

  // État complet avec TOUS les champs de tes maquettes
  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    firstname: 'KYLIAN',
    lastname: 'MBAPPE',
    club: 'Arsenal FC',
    brand: 'Topps',
    card_set: 'TOPPS CHROME', // Attention au nom en base
    year: '2025',
    is_auto: true,
    is_patch: false,
    is_rookie: true,
    is_numbered: true,
    number_actual: '08',
    number_max: '50',
    price_bought: '50'
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // On insère les données en s'assurant que les noms de colonnes 
      // correspondent à ceux de ta table Supabase
      const { error } = await supabase
        .from('cards')
        .insert([{
          sport: formData.sport,
          firstname: formData.firstname,
          lastname: formData.lastname,
          club: formData.club,
          brand: formData.brand,
          card_set: formData.card_set,
          year: parseInt(formData.year),
          is_auto: formData.is_auto,
          is_patch: formData.is_patch,
          is_rookie: formData.is_rookie,
          is_numbered: formData.is_numbered,
          number_actual: formData.number_actual,
          number_max: formData.number_max,
          price_bought: parseFloat(formData.price_bought),
          is_wishlist: false
        }]);

      if (error) throw error;
      alert("Carte enregistrée !");
      router.push('/collection');
    } catch (err: any) {
      console.error("Erreur détaillée:", err);
      alert(`Erreur : ${err.message || "Vérifie que tes colonnes existent dans Supabase"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-44">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Ajouter</h1>
        <div className="w-10" />
      </div>

      <p className="text-center text-[#AFFF25] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
        Scan ou upload ta carte
      </p>

      {/* Tabs Recto/Verso */}
      <div className="flex bg-black/40 p-1 rounded-2xl mb-8 border border-white/5">
        <button 
          onClick={() => setActiveTab('recto')}
          className={`flex-1 py-3 rounded-xl font-black italic uppercase text-xs transition-all ${activeTab === 'recto' ? 'bg-[#AFFF25] text-black' : 'text-white'}`}
        >
          Recto
        </button>
        <button 
          onClick={() => setActiveTab('verso')}
          className={`flex-1 py-3 rounded-xl font-black italic uppercase text-xs transition-all ${activeTab === 'verso' ? 'bg-[#AFFF25] text-black' : 'text-white'}`}
        >
          Verso
        </button>
      </div>

      {/* Zone Visualisation */}
      <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto mb-12 border-2 border-dashed border-[#AFFF25]/30 rounded-[32px] flex flex-col items-center justify-center bg-white/5 gap-4">
        <div className="flex gap-4">
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
            <Camera size={24} className="text-[#AFFF25]" />
            <span className="text-[9px] font-bold uppercase">App photo</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10">
            <ImageIcon size={24} className="text-[#AFFF25]" />
            <span className="text-[9px] font-bold uppercase">Galerie</span>
          </button>
        </div>
        <p className="absolute -bottom-8 italic text-xs text-[#AFFF25]">Analyse en cours !</p>
      </div>

      {/* FORMULAIRE COMPLET */}
      <div className="space-y-8">
        {/* Section Joueur */}
        <section className="space-y-4">
          <h3 className="text-xl font-black italic uppercase text-white">Joueur</h3>
          <div className="grid gap-3">
            <InputBlock label="Sport" value={formData.sport} />
            <InputBlock label="Prénom" value={formData.firstname} />
            <InputBlock label="Nom" value={formData.lastname} />
            <InputBlock label="Club" value={formData.club} hasSearch />
          </div>
        </section>

        {/* Section Carte */}
        <section className="space-y-4">
          <h3 className="text-xl font-black italic uppercase text-white">Carte</h3>
          <div className="grid gap-3">
            <InputBlock label="Brand" value={formData.brand} />
            <InputBlock label="Set" value={formData.card_set} />
            <InputBlock label="Année" value={formData.year} />
          </div>
        </section>

        {/* Toggles (Auto, Patch, Rookie) */}
        <section className="grid gap-4 py-4">
          <ToggleBlock label="Auto" active={formData.is_auto} />
          <ToggleBlock label="Patch" active={formData.is_patch} />
          <ToggleBlock label="Rookie" active={formData.is_rookie} />
          <ToggleBlock label="Numérotée" active={formData.is_numbered} />
        </section>

        {/* Numérotation & Prix */}
        <section className="flex gap-4">
          <div className="flex-1 bg-black/40 border border-white/10 p-3 rounded-xl text-center">
            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">Numérotation</label>
            <div className="font-bold flex justify-center gap-2">
              <span>{formData.number_actual}</span> / <span>{formData.number_max}</span>
            </div>
          </div>
          <div className="flex-1 bg-black/40 border border-[#AFFF25]/30 p-3 rounded-xl text-center">
            <label className="text-[9px] text-[#AFFF25] font-bold uppercase mb-1 block">Prix d'achat</label>
            <div className="font-bold">{formData.price_bought} €</div>
          </div>
        </section>

        {/* Bouton Enregistrer */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[20px] uppercase tracking-widest shadow-xl shadow-[#AFFF25]/10 disabled:opacity-50"
        >
          {loading ? 'Synchronisation...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// Composants internes pour le style
function InputBlock({ label, value, hasSearch }: any) {
  return (
    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex justify-between items-center">
      <div className="flex-1">
        <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">{label}</label>
        <div className="font-bold uppercase text-sm tracking-wide">{value}</div>
      </div>
      {hasSearch && <Search size={16} className="text-[#AFFF25]" />}
    </div>
  );
}

function ToggleBlock({ label, active }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-black italic uppercase text-sm tracking-tighter">{label}</span>
      <div className={`w-12 h-6 rounded-full p-1 transition-all ${active ? 'bg-[#AFFF25]' : 'bg-white/10'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${active ? 'translate-x-6' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}