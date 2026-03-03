'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Image as ImageIcon, Search, Loader2 } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États de chargement
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // État du formulaire
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

  // Gestion des changements dans les champs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // --- LOGIQUE D'ANALYSE IA ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);

    try {
      const formDataBody = new FormData();
      formDataBody.append("image", file);

      const response = await fetch("/api/scan", { method: "POST", body: formDataBody });
      const data = await response.json();

      setFormData(prev => ({
        ...prev,
        playerName: data.playerName || '',
        brand: data.brand || '',
        series: data.series || '',
        year: data.year?.toString() || '',
        is_rookie: data.is_rookie || false,
        is_auto: data.is_auto || false,
        is_numbered: data.is_numbered || false,
        numbering_max: data.numbering_max?.toString() || ''
      }));
    } catch (error) {
      alert("Erreur d'analyse IA.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- LA SECTION MANQUANTE : handleSave ---
  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Vérifier si l'utilisateur est connecté (Google Login)
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("Connecte-toi avec Google pour enregistrer !");
        router.push('/login');
        return;
      }

      // 2. Trouver ou créer le joueur dans ta table SQL 'players'
      let { data: playerData } = await supabase
        .from('players')
        .select('id')
        .ilike('name', `%${formData.playerName}%`)
        .single();

      // Si le joueur n'existe pas, on pourrait l'insérer ici (optionnel)
      if (!playerData) {
        const { data: newPlayer } = await supabase
          .from('players')
          .insert([{ name: formData.playerName.toUpperCase() }])
          .select()
          .single();
        playerData = newPlayer;
      }

      // 3. Insérer la carte finale
      const { error } = await supabase.from('cards').insert([{
        user_id: user.id, // ID Google
        player_id: playerData?.id,
        brand: formData.brand,
        series: formData.series,
        year: parseInt(formData.year) || 2026,
        is_rookie: formData.is_rookie,
        is_auto: formData.is_auto,
        is_patch: formData.is_patch,
        is_numbered: formData.is_numbered,
        numbering_max: parseInt(formData.numbering_max) || null,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        image_url: previewUrl || '',
        condition: 'RAW'
      }]);

      if (error) throw error;

      alert("Carte ajoutée à l'Empire !");
      router.push('/collection');
    } catch (err: any) {
      console.error(err);
      alert(`Erreur : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-44 font-sans">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full border border-white/10">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Ajouter</h1>
        <div className="w-10" />
      </div>

      {/* Zone de Scan */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="relative aspect-[3/4] w-full max-w-[280px] mx-auto mb-10 border-2 border-dashed border-[#AFFF25]/30 rounded-[32px] flex flex-col items-center justify-center bg-white/5 overflow-hidden"
      >
        {previewUrl ? (
          <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
        ) : (
          <Camera size={40} className="text-[#AFFF25] opacity-50" />
        )}
        {analyzing && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#AFFF25]" size={32} />
            <p className="text-[10px] font-bold text-[#AFFF25] uppercase tracking-widest">Analyse Gemini...</p>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <div className="space-y-6">
        <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
          <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1 tracking-widest">Joueur</label>
          <input 
            name="playerName" 
            value={formData.playerName} 
            onChange={handleChange}
            className="bg-transparent w-full font-bold text-[#AFFF25] uppercase outline-none" 
            placeholder="Nom du joueur..."
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-black/40 border border-white/10 p-4 rounded-2xl text-center">
            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Prix d'achat</label>
            <input 
              name="purchase_price" 
              type="number" 
              value={formData.purchase_price} 
              onChange={handleChange}
              className="bg-transparent w-full font-bold text-center outline-none"
              placeholder="0 €"
            />
          </div>
        </div>

        {/* Bouton Final */}
        <button 
          onClick={handleSave}
          disabled={loading || analyzing}
          className="w-full bg-[#AFFF25] text-[#040221] font-black italic py-5 rounded-[24px] uppercase text-lg shadow-[0_10px_30px_rgba(175,255,37,0.2)] active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer dans l\'Empire'}
        </button>
      </div>
    </div>
  );
}