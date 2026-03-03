'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutGrid, Trophy, Zap } from 'lucide-react';


export default function StatsPage() {
  const [totals, setTotals] = useState({ cards: 0, wishlist: 0 });

  useEffect(() => {
    async function fetchStats() {
      const { count: c } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('is_wishlist', false);
      const { count: w } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('is_wishlist', true);
      setTotals({ cards: c || 0, wishlist: w || 0 });
    }
    fetchStats();
  }, []);

  return (
    <div className="p-6 pt-12 min-h-screen bg-[#0F1115]">
      <header className="mb-10">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none text-white">
          VOTRE <br /> <span className="text-[#DFFF00]">EMPIRE</span>
        </h1>
      </header>

      <div className="grid gap-4">
        {/* Carte Principale : Total */}
        <div className="bg-[#1A1D23] border border-white/5 p-6 rounded-[32px] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Cartes</p>
            <p className="text-5xl font-black italic text-white">{totals.cards}</p>
          </div>
          <div className="bg-[#DFFF00] p-4 rounded-2xl text-black">
            <LayoutGrid size={32} />
          </div>
        </div>

        {/* Wishlist Stats */}
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 p-6 rounded-[32px] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-1">En attente (Wishlist)</p>
            <p className="text-4xl font-black italic text-white">{totals.wishlist}</p>
          </div>
          <Trophy className="text-[#8B5CF6]" size={40} />
        </div>

        {/* Section par Sport (Utilise tes assets SVG) */}
        <div className="mt-6">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 ml-2">Répartition par sport</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
            {[
              { name: 'Soccer', icon: '/asset/Icons/soccer.svg' },
              { name: 'Basket', icon: '/asset/Icons/basket.svg' },
              { name: 'F1', icon: '/asset/Icons/formula.svg' }
            ].map((sport) => (
              <div key={sport.name} className="flex-shrink-0 bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 min-w-[100px]">
                <img src={sport.icon} className="w-8 h-8" alt={sport.name} />
                <span className="text-[10px] font-bold uppercase">{sport.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}