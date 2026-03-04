'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ChevronDown } from 'lucide-react';

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour les filtres (Recherche AJAX, Sport, Spécificité)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erreur Supabase:", error.message);
    } else if (data) {
      setCards(data);
    }
    setLoading(false);
  };

  // 🚀 LOGIQUE DE FILTRAGE (AJAX en temps réel)
  const filteredCards = cards.filter(card => {
    // 1. Filtre par recherche (Club pour l'instant, ou prénom/nom si tu les as ajoutés en BDD)
    const searchString = `${card.club_name || ''} ${card.brand || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());

    // 2. Filtre par sport (si la colonne existe)
    const matchesSport = selectedSport === '' || card.sport === selectedSport;

    // 3. Filtre par spécificité
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;

    return matchesSearch && matchesSport && matchesSpec;
  });

  return (
    // ❌ Plus de bg-[#040221] pour laisser passer le dégradé du layout !
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      {/* HEADER (Sans le back button et sans le +) */}
      <header className="mb-6 pt-4 text-center">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">COLLECTION</h1>
      </header>

      {/* BARRE DE RECHERCHE */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-3.5 text-[#AFFF25]" size={18} />
        <input 
          type="text" 
          placeholder="Enter player name" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#040221] border border-[#AFFF25] rounded-full py-3 pl-12 pr-4 text-sm outline-none text-white italic placeholder:text-white/40 shadow-[0_0_15px_rgba(175,255,37,0.1)] transition-colors focus:shadow-[0_0_20px_rgba(175,255,37,0.3)]"
        />
      </div>

      {/* FILTRES (Sport & Spécificité) */}
      <div className="flex gap-2 mb-6">
        
        {/* Filtre Sport */}
        <div className="relative flex-1">
          <select 
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="w-full bg-[#040221] border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white"
          >
            <option value="">TOUS SPORTS</option>
            <option value="SOCCER">FOOTBALL</option>
            <option value="BASKETBALL">BASKETBALL</option>
            <option value="BASEBALL">BASEBALL</option>
            <option value="F1">FORMULE 1</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
        </div>

        {/* Filtre Spécificité */}
        <div className="relative flex-1">
          <select 
            value={selectedSpec}
            onChange={(e) => setSelectedSpec(e.target.value)}
            className="w-full bg-[#040221] border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-xs font-bold uppercase outline-none appearance-none text-white"
          >
            <option value="">FILTRER PAR...</option>
            <option value="auto">AUTO</option>
            <option value="patch">PATCH</option>
            <option value="rookie">ROOKIE</option>
            <option value="numbered">NUMÉROTÉE</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 text-white/50 pointer-events-none" size={16} />
        </div>

      </div>

      {/* GRILLE DE CARTES (3 Colonnes) */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center mt-20 space-y-4">
          <p className="text-white/40 italic font-bold">Aucune carte trouvée.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredCards.map((card) => (
            <div 
              key={card.id} 
              onClick={() => router.push(`/card/${card.id}`)}
              className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform group"
            >
              {card.image_url ? (
                // L'image s'affiche en cover, sans aucun texte par-dessus
                <img src={card.image_url} alt="Card" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 p-2 text-center bg-[#080531]">
                  <span className="text-[10px] italic font-bold leading-tight">Image non<br/>disponible</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}