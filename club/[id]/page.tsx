'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CollectionCard from '@/components/CollectionCard';

export default function ClubPage() {
  const { id } = useParams();
  const [club, setClub] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    const fetchClubData = async () => {
      const { data: clubData } = await supabase.from('clubs').select('*').eq('id', id).single();
      const { data: cardsData } = await supabase.from('cards').select('*, players(*)').eq('club_id', id);
      if (clubData) setClub(clubData);
      if (cardsData) setCards(cardsData);
    };
    fetchClubData();
  }, [id]);

  if (!club) return <div className="p-10 text-center uppercase font-black italic">Chargement Club...</div>;

  return (
    <div className="p-6 pt-12">
      <div className="flex items-center gap-4 mb-8">
        <img src={club.logo_url} className="w-16 h-16 object-contain" alt="" />
        <h1 className="text-4xl font-black italic uppercase leading-tight">{club.name}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {cards.map(card => <CollectionCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}