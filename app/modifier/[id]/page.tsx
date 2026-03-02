'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ModifierPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand: '', series: '', year: '', is_wishlist: false
  });

  useEffect(() => {
    if (id !== 'new') {
      supabase.from('cards').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setFormData(data);
      });
    }
  }, [id]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('cards').upsert({ id: id === 'new' ? undefined : id, ...formData });
    if (!error) router.push('/collection');
    setLoading(false);
  };

  return (
    <div className="p-6 pt-12 space-y-6">
      <h1 className="text-3xl font-black italic uppercase">DÉTAILS CARTE</h1>
      <div className="space-y-4">
        <input className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Marque (Panini...)" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
        <input className="w-full bg-white/5 border border-white/10 p-4 rounded-xl" placeholder="Série (Prizm...)" value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} />
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
          <span className="font-bold text-xs uppercase italic">Ajouter à la Wishlist ?</span>
          <input type="checkbox" checked={formData.is_wishlist} onChange={e => setFormData({...formData, is_wishlist: e.target.checked})} className="w-6 h-6 accent-[#DFFF00]" />
        </div>
      </div>
      <button onClick={handleSave} className="w-full bg-[#DFFF00] text-black py-4 rounded-xl font-bold uppercase italic shadow-lg shadow-[#DFFF00]/20">
        {loading ? 'Enregistrement...' : 'Valider'}
      </button>
    </div>
  );
}