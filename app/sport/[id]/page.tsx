'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function EditCardPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    player_name: '',
    series: '',
    brand: '',
    year: 2024
  });

  const saveCard = async () => {
    // Logique de sauvegarde vers Supabase
    const { error } = await supabase.from('cards').insert([formData]);
    if (!error) router.push('/collection');
  };

  return (
    // 🚨 AJOUT DE LA SAFE AREA EN HAUT ET DE LA MARGE TAB BAR EN BAS 🚨
    <div className="px-6 pb-32 pt-[calc(3rem+env(safe-area-inset-top))] min-h-screen">
      <h1 className="text-3xl font-black italic uppercase mb-10">Modifier les infos</h1>
      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Joueur</label>
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mt-1 focus:border-[#DFFF00] outline-none" 
            value={formData.player_name}
            onChange={(e) => setFormData({...formData, player_name: e.target.value})}
          />
        </div>
        {/* Répéter pour les autres champs */}
        <button onClick={saveCard} className="w-full bg-[#DFFF00] text-black py-4 rounded-xl font-bold uppercase italic mt-10 shadow-[0_0_15px_rgba(223,255,0,0.3)] active:scale-95 transition-transform">
          Enregistrer dans la collection
        </button>
      </div>
    </div>
  );
}