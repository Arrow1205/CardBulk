'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Search, Loader2, Trophy } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // État complet calqué sur ta maquette
  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    firstname: '',
    lastname: '',
    club: '',
    brand: '',
    set: '',
    year: '2025',
    is_auto: false,
    is_patch: false,
    is_rookie: false,
    is_numbered: false,
    numbering_min: '',
    numbering_max: '',
    purchase_price: '50'
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);

    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body });
      const data = await res.json();

      // On map les données de l'IA vers tes nouveaux champs
      setFormData(prev => ({
        ...prev,
        lastname: data.playerName?.split(' ').pop() || '',
        firstname: data.playerName?.split(' ')[0] || '',
        brand: data.brand || '',
        set: data.series || '',
        year: data.year?.toString() || '2025',
        is_rookie: data.is_rookie || false,
        is_auto: data.is_auto || false,
        is_numbered: data.is_numbered || false,
        numbering_max: data.numbering_max?.toString() || ''
      }));
    } catch (err) {
      console.error("Erreur IA:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // Insertion dans Supabase (ajustée à tes colonnes)
      const { error } = await supabase.from('cards').insert([{
        user_id: user.id,
        brand: formData.brand,
        series: formData.set,
        year: parseInt(formData.year),
        is_rookie: formData.is_rookie,
        is_auto: formData.is_auto,
        is_patch: formData.is_patch,
        is_numbered: formData.is_numbered,
        numbering_max: parseInt(formData.numbering_max) || null,
        purchase_price: parseFloat(formData.purchase_price),
        image_url: previewUrl
      }]);

      if (error) throw error;
      router.push('/collection');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-10">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">AJOUTER</h1>
          <p className="text-[#AFFF25] text-[10px] uppercase font-bold tracking-widest mt-1">Scan ou upload ta carte</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Onglets Recto/Verso */}
      <div className="px-6 flex gap-2 mb-8">
        <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-xs uppercase">Recto</button>
        <button className="flex-1 bg-white/5 border border-white/10 text-white font-black italic py-2 rounded-full text-xs uppercase">Verso</button>
      </div>

      {/* Zone d'Upload / Preview */}
      <div className="px-10 mb-8">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative aspect-[3/4] rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-gradient-to-b from-white/5 to-transparent flex flex-col items-center justify-center overflow-hidden"
        >
          {previewUrl ? (
            <img src={previewUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="space-y-4 text-center">
               <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-bold uppercase">App photo</button>
               <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-bold uppercase">Bibliotheque</button>
            </div>
          )}
          
          {/* Overlay Analyse */}
          {analyzing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-[#AFFF25] mb-2" size={32} />
              <p className="text-[#AFFF25] text-[10px] font-black uppercase tracking-[0.2em]">Analyse en cours !</p>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire stylisé */}
      <div className="px-6 space-y-8">
        
        {/* Section Joueur */}
        <section className="space-y-4">
          <h2 className="text-xl font-black italic uppercase italic">Joueur</h2>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest ml-1">Sport</label>
            <select className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none">
              <option>⚽ FOOTBALL</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Prénom</label>
              <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" placeholder="Prénom du joueur" />
            </div>
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Nom</label>
              <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" placeholder="Nom du joueur" />
            </div>
          </div>
        </section>

        {/* Section Carte */}
        <section className="space-y-4">
          <h2 className="text-xl font-black italic uppercase italic">Carte</h2>
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
             <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Brand</label>
             <input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none text-[#AFFF25]" />
          </div>

          {/* Toggles stylisés */}
          <div className="space-y-4 pt-4">
            {[
              { label: 'AUTO', key: 'is_auto' },
              { label: 'PATCH', key: 'is_patch' },
              { label: 'ROOKIE', key: 'is_rookie' },
              { label: 'NUMÉROTÉE', key: 'is_numbered' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="font-black italic uppercase text-sm tracking-widest">{item.label}</span>
                <button 
                  onClick={() => setFormData({...formData, [item.key]: !formData[item.key as keyof typeof formData]})}
                  className={`w-12 h-6 rounded-full transition-all relative ${formData[item.key as keyof typeof formData] ? 'bg-[#AFFF25]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData[item.key as keyof typeof formData] ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Bouton Enregistrer */}
        <button 
          onClick={handleSave}
          disabled={loading || analyzing}
          className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-3xl uppercase text-lg shadow-[0_20px_40px_rgba(175,255,37,0.15)] active:scale-95 transition-all mt-10"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}