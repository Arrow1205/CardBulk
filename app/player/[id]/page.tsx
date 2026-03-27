'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CollectionCard from '@/components/CollectionCard';

export default function PlayerPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: p } = await supabase.from('players').select('*, clubs(*)').eq('id', id).single();
      const { data: c } = await supabase.from('cards').select('*').eq('player_id', id);
      setPlayer(p); setCards(c || []);
    };
    fetchData();
  }, [id]);

  return (
    // 🚨 AJOUT DE LA SAFE AREA EN HAUT ET DE LA MARGE TAB BAR EN BAS 🚨
    <div className="px-6 pb-32 pt-[calc(3rem+env(safe-area-inset-top))] min-h-screen">
      <div className="mb-10">
        <p className="text-[#DFFF00] font-bold uppercase text-xs mb-1">{player?.clubs?.name}</p>
        <h1 className="text-5xl font-black italic uppercase leading-none">{player?.name}</h1>
      </div>
      <h2 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-widest text-center italic border-b border-white/10 pb-2">SES CARTES</h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map(card => <CollectionCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}