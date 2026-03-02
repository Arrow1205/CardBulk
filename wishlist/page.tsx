'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import CollectionCard from '@/components/CollectionCard';

export default function WishlistPage() {
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    const fetchWishlist = async () => {
      // On filtre uniquement les cartes marquées comme is_wishlist = true
      const { data } = await supabase
        .from('cards')
        .select('*, players(name)')
        .eq('is_wishlist', true);
      if (data) setCards(data);
    };
    fetchWishlist();
  }, []);

  return (
    <div className="p-6 pt-12">
      <h1 className="text-5xl font-black italic tracking-tighter mb-8 uppercase text-[#8B5CF6]">
        WISHLIST
      </h1>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <CollectionCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}