'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Image as ImageIcon, Search, ChevronDown, Loader2 } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'recto' | 'verso'>('recto');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // État éditable lié à ton SQL
  const [formData, setFormData] = useState({
    playerName: '',
    brand: '',
    series: '',
    year: '',
    is_rookie: false,
    is_auto: false,
    is_patch: false,
    is_numbered: false,
    numbering_max: '',
    purchase_price: ''
  });

  // Gestion des changements manuels
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 1. Déclenchement du sélecteur de fichier
  const handlePickFile = () => fileInputRef.current?.click();

  // 2. Analyse de l'image par l'IA (Simulé ici, appelle ton API Route Gemini)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);

    try {
      // Simulation de l'appel à Gemini 3 Flash
      // Dans la version finale, on envoie le fichier à /api/scan
      await new Promise(resolve => setTimeout(resolve, 2000)); 

      setFormData({
        playerName: 'BUKAYO SAKA',
        brand: 'TOPPS',
        series: 'TOPPS CHROME',
        year: '2024',
        is_rookie: true,
        is_auto: false,
        is_patch: false,
        is_numbered: true,
        numbering_max: '99',
        purchase_price: '45'
      });
    } catch (error) {
      console.error("Erreur d'analyse IA", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // On cherche l'ID du joueur pour ton SQL
      const { data: playerData } = await supabase
        .from('players')
        .select('id')
        .ilike('name', `%${formData.playerName}%`)
        .single();

      const { error } = await supabase.from('cards').insert([{
        player_id: playerData?.id,
        brand: formData.brand,
        series: formData.series,
        year: parseInt(formData.year),
        is_rookie: formData.is_rookie,
        is_auto: formData.is_auto,
        is_patch: formData.is_patch,
        is_numbered: formData.is_numbered,
        numbering_max: parseInt(formData.numbering_max),
        purchase_price: parseFloat(formData.purchase_price),
        image_url: previewUrl || '',
        user_id: (await supabase.auth.getUser()).data.user?.id
      }]);

      if (error) throw error;
      router.push('/collection');
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-44 font-sans">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full border border-white/10">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter italic">Ajouter</h1>
        <div className="w-10" />
      </div>

      {/* Preview & Scan Button */}
      <div 
        onClick={handlePickFile}
        className="relative aspect-[3/4] w-full max-w-[280px] mx-auto mb-10 border-2 border-dashed border-[#AFFF25]/30 rounded-[32px] flex flex-col items-center justify-center bg-white/5 overflow-hidden active:scale-95 transition-transform"
      >
        {previewUrl ? (
          <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Camera size={40} className="text-[#AFFF25]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#AFFF25]">Appuie pour scanner</span>
          </div>
        )}
        {analyzing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
            <p className="italic text-[#AFFF25] font-bold text-xs uppercase">Analyse IA en cours...</p>
          </div>
        )}
      </div>

      {/* Formulaire Éditable */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Joueur</h2>
        
        <div className="grid gap-3">
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Nom du Joueur</label>
            <input 
              name="playerName"
              value={formData.playerName}
              onChange={handleChange}
              placeholder="Saisir le nom..."
              className="bg-transparent w-full font-bold text-[#AFFF25] uppercase outline-none"
            />
          </div>
          
          <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl flex justify-between items-center">
            <div className="flex-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Série / Set</label>
              <input 
                name="series"
                value={formData.series}
                onChange={handleChange}
                className="bg-transparent w-full font-bold uppercase outline-none"
              />
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-4 py-4 border-y border-white/5">
          <ToggleItem label="Auto" name="is_auto" active={formData.is_auto} onChange={handleChange} />
          <ToggleItem label="Rookie" name="is_rookie" active={formData.is_rookie} onChange={handleChange} />
        </div>

        {/* Bouton Save */}
        <button 
          onClick={handleSave}
          disabled={loading || analyzing}
          className="w-full bg-[#AFFF25] text-[#040221] font-black italic py-5 rounded-[24px] uppercase text-lg shadow-[0_10px_30px_rgba(175,255,37,0.2)] disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Confirmer & Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function ToggleItem({ label, name, active, onChange }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-black italic uppercase text-lg tracking-tight">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" name={name} checked={active} onChange={onChange} className="sr-only peer" />
        <div className="w-12 h-6 bg-white/10 rounded-full peer peer-checked:bg-[#AFFF25] after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6"></div>
      </label>
    </div>
  );
}