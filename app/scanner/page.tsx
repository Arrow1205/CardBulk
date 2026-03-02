'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Image as ImageIcon, Search } from 'lucide-react';

export default function ScannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Formulaire adapté à ton SQL
  const [formData, setFormData] = useState({
    playerName: 'BUKAYO SAKA', // On cherchera l'ID de ce joueur
    brand: 'Topps',
    series: 'TOPPS CHROME', 
    year: '2025',
    is_rookie: true,
    is_auto: true,
    is_patch: false,
    is_numbered: true,
    numbering_max: 50,
    purchase_price: 50,
    image_url: 'https://placeholder.com/saka.png' // Image temporaire
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Récupérer l'ID du joueur (Saka)
      const { data: playerData, error: pError } = await supabase
        .from('players')
        .select('id')
        .ilike('name', `%${formData.playerName}%`)
        .single();

      if (pError || !playerData) throw new Error("Joueur non trouvé dans la base.");

      // 2. Insérer la carte avec les bons noms de colonnes SQL
      const { error } = await supabase
        .from('cards')
        .insert([{
          player_id: playerData.id,
          brand: formData.brand,
          series: formData.series,
          year: parseInt(formData.year.toString()),
          is_rookie: formData.is_rookie,
          is_auto: formData.is_auto,
          is_patch: formData.is_patch,
          is_numbered: formData.is_numbered,
          numbering_max: formData.numbering_max,
          purchase_price: formData.purchase_price,
          image_url: formData.image_url,
          condition: 'RAW', // Valeur par défaut
          user_id: (await supabase.auth.getUser()).data.user?.id // Important pour tes RLS
        }]);

      if (error) throw error;
      alert("Carte ajoutée avec succès !");
      router.push('/collection');
    } catch (err: any) {
      console.error(err);
      alert(`Erreur : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-40">
      {/* Header & Design (identique au précédent pour le look) */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-full"><ChevronLeft size={24} /></button>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Ajouter</h1>
        <div className="w-10" />
      </div>

      {/* Reste du design identique... */}
      <div className="space-y-6">
        <div className="bg-[#080531] border border-white/10 p-4 rounded-2xl">
           <label className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Joueur détecté</label>
           <div className="font-bold text-[#AFFF25] uppercase tracking-wide">{formData.playerName}</div>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#AFFF25] text-[#040221] font-black italic py-5 rounded-[24px] uppercase tracking-widest shadow-xl shadow-[#AFFF25]/20 disabled:opacity-50"
        >
          {loading ? 'Connexion SQL...' : 'Enregistrer dans l\'Empire'}
        </button>
      </div>
    </div>
  );
}