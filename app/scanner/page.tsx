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
        setFormData(prev => ({
          ...prev,
          firstname: data.playerName.split(' ')[0].toUpperCase(),
          lastname: data.playerName.split(' ').slice(1).join(' ').toUpperCase(),
          brand: data.brand?.toUpperCase() || 'TOPPS',
          series: data.series?.toUpperCase() || 'CHROME',
          is_rookie: !!data.is_rookie,
          is_numbered: !!data.is_numbered,
          num_high: data.numbering_max?.toString() || ''
        }));
      }
    } catch (err) {
      console.error("Analyse échouée, remplissage manuel possible.");
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
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-20 overflow-y-auto">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10"><ChevronLeft size={20} /></button>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter italic">AJOUTER</h1>
        <div className="w-10" />
      </header>

      <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full max-w-[260px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex items-center justify-center overflow-hidden mb-10">
        {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <p className="text-[10px] font-bold uppercase opacity-20 italic">Tap to scan</p>}
        {analyzing && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[#AFFF25]"><Loader2 className="animate-spin mb-2" /><p className="text-[10px] font-black uppercase italic tracking-widest">Analyse...</p></div>}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
            <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Prénom</label>
            <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" />
          </div>
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
            <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Nom</label>
            <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" />
          </div>
        </div>

        <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl relative">
          <label className="text-[9px] text-white/30 font-bold uppercase block mb-1 tracking-widest">Club</label>
          <input value={formData.club} onChange={e => setFormData({...formData, club: e.target.value})} className="bg-transparent w-full font-bold uppercase outline-none" />
          <Search className="absolute right-4 bottom-4 text-white/20" size={16} />
        </div>

        <div className="space-y-4 py-4">
          {['AUTO', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
            const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
            return (
              <div key={l} className="flex justify-between items-center">
                <span className="font-black italic uppercase text-xs tracking-widest">{l}</span>
                <button onClick={() => setFormData({...formData, [k]: !formData[k as keyof typeof formData]})} className={`w-12 h-6 rounded-full relative transition-all ${formData[k as keyof typeof formData] ? 'bg-[#AFFF25]' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData[k as keyof typeof formData] ? 'right-1 shadow-[0_0_10px_#AFFF25]' : 'left-1'}`} />
                </button>
              </div>
            )
          })}
        </div>

        <button onClick={handleSave} disabled={loading || analyzing} className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[24px] uppercase text-xl mt-6 active:scale-95 transition-all">
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}