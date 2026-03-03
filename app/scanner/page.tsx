'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown } from 'lucide-react';

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
    brand: 'TOPPS',
    series: 'CHROME',
    year: '2025',
    is_auto: false,
    is_patch: false,
    is_rookie: false,
    is_numbered: false,
    num_low: '',
    num_high: '',
    price: '50'
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

      if (data.playerName) {
        const names = data.playerName.split(' ');
        setFormData(prev => ({
          ...prev,
          firstname: names[0]?.toUpperCase() || '',
          lastname: names.slice(1).join(' ')?.toUpperCase() || '',
          brand: data.brand?.toUpperCase() || 'TOPPS',
          series: data.series?.toUpperCase() || 'CHROME',
          year: data.year?.toString() || '2025',
          club: data.club?.toUpperCase() || '',
          is_rookie: !!data.is_rookie,
          is_auto: !!data.is_auto,
          is_numbered: !!data.is_numbered,
          num_high: data.numbering_max?.toString() || ''
        }));
      }
    } catch (err) {
      console.error("Analyse automatique échouée.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('cards').insert([{
      user_id: user?.id,
      brand: formData.brand,
      series: formData.series,
      year: parseInt(formData.year),
      is_rookie: formData.is_rookie,
      is_auto: formData.is_auto,
      is_patch: formData.is_patch,
      is_numbered: formData.is_numbered,
      numbering_low: parseInt(formData.num_low) || null,
      numbering_max: parseInt(formData.num_high) || null,
      purchase_price: parseFloat(formData.price),
      image_url: previewUrl,
      club_name: formData.club
    }]);

    router.push('/collection');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-24 overflow-y-auto font-sans">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">AJOUTER</h1>
          <p className="text-[#AFFF25] text-[10px] uppercase font-bold tracking-widest">Scan ou upload ta carte</p>
        </div>
        <div className="w-10" />
      </header>

      {/* Toggle Buttons */}
      <div className="flex gap-2 p-1 bg-black/40 rounded-full border border-white/5 mb-8">
        <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[11px] uppercase">Recto</button>
        <button className="flex-1 text-white/40 font-black italic py-2 rounded-full text-[11px] uppercase">Verso</button>
      </div>

      {/* Dropzone */}
      <div 
        onClick={() => fileInputRef.current?.click()} 
        className="relative aspect-[3/4] w-full max-w-[260px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex flex-col items-center justify-center overflow-hidden mb-10"
      >
        {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : (
          <div className="flex flex-col gap-3">
             <button className="bg-white/5 border border-white/10 px-8 py-2 rounded-full text-[10px] font-black uppercase italic tracking-widest">App photo</button>
             <button className="bg-white/5 border border-white/10 px-8 py-2 rounded-full text-[10px] font-black uppercase italic tracking-widest">Bibliotheque</button>
          </div>
        )}
        {analyzing && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[#AFFF25]">
            <Loader2 className="animate-spin mb-2" />
            <p className="text-[10px] font-black uppercase italic tracking-widest animate-pulse">Analyse en cours !</p>
          </div>
        )}
      </div>

      {/* Formulaire - SECTION JOUEUR */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Joueur</h2>
        
        <div className="relative">
          <label className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest mb-2 block">Sport</label>
          <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none">
            <option value="FOOTBALL">⚽ FOOTBALL</option>
            <option value="BASKETBALL">🏀 BASKETBALL</option>
          </select>
          <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
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
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl relative">
            <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Club</label>
            <input value={formData.club} onChange={e => setFormData({...formData, club: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" placeholder="Recherche un club" />
            <Search className="absolute right-4 bottom-4 text-white/20" size={16} />
          </div>
        </div>

        {/* SECTION CARTE */}
        <h2 className="text-2xl font-black italic uppercase tracking-tighter pt-4">Carte</h2>
        
        <div className="space-y-4">
          <div className="relative">
            <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Brand</label>
            <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none">
              <option value="TOPPS">TOPPS</option><option value="PANINI">PANINI</option>
            </select>
            <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
          </div>

          {/* Toggles */}
          <div className="space-y-6 py-4">
            {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
              const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
              const active = formData[k as keyof typeof formData];
              return (
                <div key={l} className="flex justify-between items-center">
                  <span className="font-black italic uppercase text-xs tracking-widest">{l}</span>
                  <button onClick={() => setFormData({...formData, [k]: !active})} className={`w-12 h-6 rounded-full relative transition-all ${active ? 'bg-[#AFFF25]' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'right-1 shadow-[0_0_10px_#fff]' : 'left-1'}`} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Numérotation / / / */}
          <div className="flex items-end gap-4">
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="5" />
            </div>
            <span className="text-white/20 font-bold mb-4">/</span>
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="50" />
            </div>
          </div>

          <div className="bg-[#080531] border border-[#AFFF25]/30 p-4 rounded-2xl flex justify-between items-center mt-6">
            <div>
              <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Prix d'achat</label>
              <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="bg-transparent font-black text-xl outline-none" />
            </div>
            <span className="text-[#AFFF25] font-black text-xl">50 €</span>
          </div>
        </div>

        <button onClick={handleSave} disabled={loading || analyzing} className="w-full bg-white/20 text-white font-black italic py-5 rounded-[24px] uppercase text-xl mt-10 active:scale-95 transition-all">
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}