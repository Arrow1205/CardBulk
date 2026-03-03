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
    set: 'CHROME',
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

      setFormData(prev => ({
        ...prev,
        firstname: data.playerName?.split(' ')[0] || '',
        lastname: data.playerName?.split(' ').slice(1).join(' ') || '',
        brand: data.brand?.toUpperCase() || 'TOPPS',
        set: data.series?.toUpperCase() || 'CHROME',
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

  const saveCard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('cards').insert([{
      user_id: user?.id,
      brand: formData.brand,
      series: formData.set,
      year: parseInt(formData.year),
      is_rookie: formData.is_rookie,
      is_auto: formData.is_auto,
      is_patch: formData.is_patch,
      is_numbered: formData.is_numbered,
      numbering_low: parseInt(formData.num_low) || null,
      numbering_max: parseInt(formData.num_high) || null,
      purchase_price: parseFloat(formData.price),
      image_url: previewUrl
    }]);

    if (!error) router.push('/collection');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-20 overflow-y-auto">
      {/* Header */}
      <div className="p-6 flex items-center justify-between sticky top-0 bg-[#040221]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">AJOUTER</h1>
          <p className="text-[#AFFF25] text-[10px] uppercase font-bold tracking-widest mt-1">Scan ou upload ta carte</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="px-6 space-y-8">
        {/* Toggle Recto/Verso */}
        <div className="flex gap-2 p-1 bg-black/40 rounded-full border border-white/5">
          <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[11px] uppercase transition-all">Recto</button>
          <button className="flex-1 text-white/40 font-black italic py-2 rounded-full text-[11px] uppercase">Verso</button>
        </div>

        {/* Zone Photo */}
        <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full max-w-[280px] mx-auto rounded-[32px] border-2 border-dashed border-[#AFFF25]/30 bg-white/5 flex flex-col items-center justify-center overflow-hidden shadow-[0_0_50px_rgba(175,255,37,0.05)]">
          {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : (
            <div className="flex flex-col gap-4">
              <button className="bg-white/5 border border-white/10 px-8 py-3 rounded-full text-[11px] font-black uppercase italic tracking-widest">App photo</button>
              <button className="bg-white/5 border border-white/10 px-8 py-3 rounded-full text-[11px] font-black uppercase italic tracking-widest">Bibliothèque</button>
            </div>
          )}
          {analyzing && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-[#AFFF25]">
              <Loader2 className="animate-spin mb-3" size={32} />
              <p className="text-[11px] font-black uppercase italic tracking-[0.2em] animate-pulse">Analyse en cours !</p>
            </div>
          )}
        </div>

        {/* SECTION JOUEUR */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Joueur</h2>
          
          <div className="space-y-4">
            {/* Sport Dropdown */}
            <div className="relative">
              <label className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest ml-1 mb-2 block">Sport</label>
              <select className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none focus:border-[#AFFF25]/50">
                <option>⚽ FOOTBALL</option>
                <option>🏀 BASKETBALL</option>
                <option>🏎️ F1</option>
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
          </div>
        </div>

        {/* SECTION CARTE */}
        <div className="space-y-4 pt-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Carte</h2>
          
          <div className="space-y-4">
            <div className="relative">
              <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1 ml-1">Brand</label>
              <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none">
                <option value="TOPPS">TOPPS</option>
                <option value="PANINI">PANINI</option>
                <option value="UPPER DECK">UPPER DECK</option>
              </select>
              <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
            </div>

            <div className="relative">
              <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1 ml-1">Set</label>
              <select value={formData.set} onChange={e => setFormData({...formData, set: e.target.value})} className="w-full bg-[#080531] border border-white/10 p-4 rounded-2xl text-sm font-bold appearance-none outline-none">
                <option value="CHROME">CHROME</option>
                <option value="PRIZM">PRIZM</option>
                <option value="SELECT">SELECT</option>
              </select>
              <ChevronDown className="absolute right-4 bottom-4 text-white/20" size={18} />
            </div>

            {/* Toggles */}
            <div className="space-y-6 py-4">
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
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData[item.key as keyof typeof formData] ? 'right-1 shadow-[0_0_10px_#fff]' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Numérotation Row */}
            <div className="flex items-end gap-4">
              <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl text-center">
                <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="08" />
              </div>
              <span className="text-white/20 font-bold mb-4">/</span>
              <div className="flex-1 bg-[#080531] border border-white/10 p-4 rounded-2xl text-center">
                <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} className="bg-transparent w-full font-bold text-center outline-none" placeholder="50" />
              </div>
            </div>

            {/* Prix d'achat */}
            <div className="bg-[#080531] border border-[#AFFF25]/30 p-4 rounded-2xl relative">
              <label className="text-[9px] text-[#AFFF25] font-bold uppercase block mb-1">Prix d'achat</label>
              <div className="flex justify-between items-center">
                <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="bg-transparent w-full font-black text-xl outline-none" />
                <span className="text-[#AFFF25] font-black text-xl">€</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton Final */}
        <button 
          onClick={saveCard}
          disabled={loading || analyzing}
          className="w-full bg-[#AFFF25] text-black font-black italic py-5 rounded-[24px] uppercase text-lg shadow-[0_20px_50px_rgba(175,255,37,0.2)] active:scale-95 transition-all mt-10 disabled:opacity-50"
        >
          {loading ? 'Séquence de sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}