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

    // Fix ERR_FILE_NOT_FOUND : affichage immédiat
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
    
    const { error } = await supabase.from('cards').insert([{
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

    if (!error) router.push('/collection');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-20 overflow-y-auto">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#040221]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10"><ChevronLeft size={20} /></button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">AJOUTER</h1>
        <div className="w-10" />
      </div>

      <div className="px-6 space-y-8">
        {/* Toggle Recto/Verso */}
        <div className="flex gap-2 p-1 bg-black/40 rounded-full border border-white/5">
          <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[11px] uppercase">Recto</button>
          <button className="flex-1 text-white/40 font-black italic py-2 rounded-full text-[11px] uppercase">Verso</button>
        </div>

        {/* Zone Photo */}
        <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full max-w-[280px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex flex-col items-center justify-center overflow-hidden">
          {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : (
            <div className="text-center opacity-30 font-bold uppercase text-[10px]">App photo / Bibliothèque</div>
          )}
          {analyzing && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[#AFFF25]">
              <Loader2 className="animate-spin mb-3" size={32} />
              <p className="text-[11px] font-black uppercase italic tracking-widest animate-pulse font-bold">Analyse en cours !</p>
            </div>
          )}
        </div>

        {/* SECTION JOUEUR */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Joueur</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Prénom</label>
              <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} className="bg-transparent w-full font-bold uppercase outline-none" placeholder="Bukayo" />
            </div>
            <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
              <label className="text-[9px] text-white/30 font-bold uppercase block mb-1">Nom</label>
              <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value.toUpperCase()})} className="bg-transparent w-full font-bold uppercase outline-none" placeholder="Saka" />
            </div>
          </div>
        </div>

        {/* SECTION CARTE */}
        <div className="space-y-4 pt-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Carte</h2>
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
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl"><input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none font-bold" placeholder="08" /></div>
            <span className="text-white/20 font-bold mb-4">/</span>
            <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl"><input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none font-bold" placeholder="50" /></div>
          </div>

          <div className="bg-[#080531] border border-[#AFFF25]/30 p-4 rounded-2xl flex justify-between items-center mt-6">
            <div><label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Prix d'achat</label><input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="bg-transparent font-black text-xl outline-none font-bold" /></div>
            <span className="text-[#AFFF25] font-black text-xl font-bold italic">€</span>
          </div>
        </div>

        <button onClick={handleSave} disabled={loading || analyzing} className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[24px] uppercase text-xl shadow-[0_20px_50px_rgba(175,255,37,0.2)] font-bold active:scale-95 transition-all">
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}