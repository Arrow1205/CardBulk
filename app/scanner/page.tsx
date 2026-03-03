'use client';

import { useState, useRef, useEffect } from 'react';
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
    series: 'TOPPS CHROME',
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

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setAnalyzing(true);

    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setFormData(prev => ({
        ...prev,
        firstname: data.playerName?.split(' ')[0]?.toUpperCase() || '',
        lastname: data.playerName?.split(' ').slice(1).join(' ')?.toUpperCase() || '',
        brand: data.brand?.toUpperCase() || 'TOPPS',
        series: data.series?.toUpperCase() || 'TOPPS CHROME',
        year: data.year?.toString() || '2025',
        is_rookie: !!data.is_rookie,
        is_auto: !!data.is_auto,
        is_numbered: !!data.is_numbered,
        num_high: data.numbering_max?.toString() || ''
      }));
    } catch (err) {
      console.error("Erreur Scan");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { error } = await supabase.from('cards').insert([{
      user_id: user.id,
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

    if (!error) router.push('/collection');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-20 overflow-y-auto">
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#040221]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10"><ChevronLeft size={20} /></button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">AJOUTER</h1>
        <div className="w-10" />
      </div>

      <div className="px-6 space-y-8">
        <div className="flex gap-2 p-1 bg-black/40 rounded-full border border-white/5">
          <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[11px] uppercase transition-all">Recto</button>
          <button className="flex-1 text-white/40 font-black italic py-2 rounded-full text-[11px] uppercase">Verso</button>
        </div>

        <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full max-w-[280px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex flex-col items-center justify-center overflow-hidden">
          {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <div className="text-center opacity-30 font-bold uppercase text-[10px]">Tap to scan</div>}
          {analyzing && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[#AFFF25]"><Loader2 className="animate-spin mb-3" size={32} /><p className="text-[11px] font-black uppercase italic tracking-widest">Analyse en cours !</p></div>}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Joueur</h2>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest block mb-2">Sport</label>
              <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none"><option>⚽ FOOTBALL</option></select>
              <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
            </div>
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Prénom</label>
              <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none text-white" />
            </div>
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Nom</label>
              <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none text-white" />
            </div>
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl relative">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Club</label>
              <input value={formData.club} onChange={e => setFormData({...formData, club: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none text-white" />
              <Search className="absolute right-4 bottom-4 text-white/20" size={16} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Carte</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="relative bg-[#080531] border border-white/10 p-4 rounded-2xl">
               <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Brand</label>
               <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none appearance-none"><option>TOPPS</option><option>PANINI</option></select>
               <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
            </div>
            <div className="relative bg-[#080531] border border-white/10 p-4 rounded-2xl">
               <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Set</label>
               <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none appearance-none"><option>TOPPS CHROME</option><option>PRIZM</option></select>
               <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
            </div>
          </div>

          <div className="space-y-6 py-4">
            {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((label) => (
              <div key={label} className="flex justify-between items-center">
                <span className="font-black italic uppercase text-xs tracking-widest">{label}</span>
                <button 
                  onClick={() => {
                    const k = label === 'NUMÉROTÉE' ? 'is_numbered' : `is_${label.toLowerCase()}`;
                    setFormData({...formData, [k]: !formData[k as keyof typeof formData]});
                  }}
                  className={`w-12 h-6 rounded-full relative transition-all ${formData[label === 'NUMÉROTÉE' ? 'is_numbered' : `is_${label.toLowerCase()}` as keyof typeof formData] ? 'bg-[#AFFF25]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData[label === 'NUMÉROTÉE' ? 'is_numbered' : `is_${label.toLowerCase()}` as keyof typeof formData] ? 'right-1 shadow-[0_0_10px_#AFFF25]' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl"><input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="08" /></div>
            <span className="text-white/20 font-bold mb-4">/</span>
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl"><input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="50" /></div>
          </div>

          <div className="bg-[#080531] border border-[#AFFF25]/30 p-4 rounded-2xl flex justify-between items-center mt-6">
            <div><label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Prix d'achat</label><input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="bg-transparent font-black text-xl outline-none" /></div>
            <span className="text-[#AFFF25] font-black text-xl">€</span>
          </div>
        </div>

        <button onClick={handleSave} disabled={loading || analyzing} className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[24px] uppercase text-xl shadow-[0_20px_50px_rgba(175,255,37,0.2)] active:scale-95 transition-all mt-10">
          {loading ? 'Séquence de sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}