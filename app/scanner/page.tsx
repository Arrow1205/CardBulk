'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Loader2, Search } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    num_low: '',
    num_high: '',
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

      setFormData(prev => ({
        ...prev,
        firstname: data.playerName?.split(' ')[0] || '',
        lastname: data.playerName?.split(' ').slice(1).join(' ') || '',
        brand: data.brand || '',
        set: data.series || '',
        year: data.year?.toString() || '2025',
        is_rookie: data.is_rookie || false,
        is_auto: data.is_auto || false,
        is_numbered: data.is_numbered || false,
        num_high: data.numbering_max?.toString() || ''
      }));
    } catch (err) {
      console.error("Erreur IA");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-20 overflow-y-auto">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#040221]/80 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">AJOUTER</h1>
        <div className="w-10" />
      </div>

      <div className="px-6 space-y-8">
        {/* Toggle Recto/Verso */}
        <div className="flex gap-2 p-1 bg-black/40 rounded-full border border-white/5">
          <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[10px] uppercase">Recto</button>
          <button className="flex-1 text-white/40 font-black italic py-2 rounded-full text-[10px] uppercase">Verso</button>
        </div>

        {/* Zone Photo */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative aspect-[3/4] w-full max-w-[260px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex flex-col items-center justify-center overflow-hidden"
        >
          {previewUrl ? (
            <img src={previewUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col gap-3">
              <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-bold uppercase">App photo</button>
              <button className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] font-bold uppercase">Bibliothèque</button>
            </div>
          )}
          {analyzing && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[#AFFF25]">
              <Loader2 className="animate-spin mb-2" />
              <p className="text-[10px] font-black uppercase italic">Analyse en cours !</p>
            </div>
          )}
        </div>

        {/* Formulaire Joueur */}
        <div className="space-y-4">
          <h2 className="text-xl font-black italic uppercase">Joueur</h2>
          <div className="space-y-4">
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Sport</label>
              <select className="bg-transparent w-full font-bold uppercase outline-none text-[#AFFF25]">
                <option>⚽ FOOTBALL</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
                <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Prénom</label>
                <input value={formData.firstname} className="bg-transparent w-full font-bold uppercase outline-none" />
              </div>
              <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
                <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Nom</label>
                <input value={formData.lastname} className="bg-transparent w-full font-bold uppercase outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire Carte */}
        <div className="space-y-4">
          <h2 className="text-xl font-black italic uppercase">Carte</h2>
          {/* Les Toggles */}
          {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((label) => (
            <div key={label} className="flex justify-between items-center py-1">
              <span className="font-black italic uppercase text-xs tracking-widest">{label}</span>
              <div className="w-12 h-6 bg-white/10 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-[#AFFF25] rounded-full shadow-[0_0_10px_#AFFF25]" />
              </div>
            </div>
          ))}
          
          <button className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-3xl uppercase mt-6">Enregistrer</button>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}