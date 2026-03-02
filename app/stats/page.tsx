'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StatsPage() {
  const [stats, setStats] = useState({ total: 0, sports: 0, wishlist: 0 });

  useEffect(() => {
    const getStats = async () => {
      const { count: total } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('is_wishlist', false);
      const { count: wishlist } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('is_wishlist', true);
      setStats({ total: total || 0, sports: 0, wishlist: wishlist || 0 });
    };
    getStats();
  }, []);

  return (
    <div className="p-6 pt-12">
      <h1 className="text-5xl font-black italic uppercase mb-10 leading-none">VOTRE <br/><span className="text-[#DFFF00]">EMPIRE</span></h1>
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Cartes</p>
          <p className="text-4xl font-black italic">{stats.total}</p>
        </div>
        <div className="bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 p-6 rounded-3xl">
          <p className="text-[10px] font-bold text-white/50 uppercase mb-1">Dans la Wishlist</p>
          <p className="text-4xl font-black italic text-white">{stats.wishlist}</p>
        </div>
      </div>
    </div>
  );
}