'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ChevronDown } from 'lucide-react';

// On importe ton fichier pour récupérer la liste de tes Brands
import SET_DATA from '@/data/set.json';

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(''); // Le nouveau filtre Brand

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

  // 🚀 EXTRACTION DES NOMS UNIQUES DE TA COLLECTION (Pour les suggestions)
  const uniquePlayers = Array.from(
    new Set(cards.map(c => `${c.firstname || ''} ${c.lastname || ''}`.trim()).filter(Boolean))
  );

  // Suggestions actives uniquement si 3 caractères ou plus
  const searchSuggestions = searchTerm.length >= 3 
    ? uniquePlayers.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // 🚀 LOGIQUE DE FILTRAGE
  const filteredCards = cards.filter(card => {
    // 1. Filtre par recherche (Prénom + Nom)
    const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
    const matchesSearch = searchTerm === '' || fullName.includes(searchTerm.toLowerCase());

    // 2. Filtre par sport
    const matchesSport = selectedSport === '' || card.sport === selectedSport;

    // 3. Filtre par spécificité
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;

    // 4. Filtre par Brand
    const matchesBrand = selectedBrand === '' || card.brand === selectedBrand;

    return matchesSearch && matchesSport && matchesSpec && matchesBrand;
  });

  const availableBrands = SET_DATA.brands || [];

  return (
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans relative z-10">
      
      {/* HEADER */}
      <header className="mb-6 pt-4 text-center">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">COLLECTION</h1>
      </header>

      {/* BARRE DE RECHERCHE AVEC SUGGESTIONS */}
      <div className="relative mb-4 z-50">
        <Search className="absolute left-4 top-3.5 text-[#AFFF25]" size={18} />
        <input 
          type="text" 
          placeholder="Enter player name" 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          // Le timeout permet de cliquer sur la suggestion avant que le menu disparaisse
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full bg-[#040221] border border-[#AFFF25] rounded-full py-3 pl-12 pr-4 text-sm outline-none text-white italic placeholder:text-white/40 shadow-[0_0_15px_rgba(175,255,37,0.1)] transition-colors focus:shadow-[0_0_20px_rgba(175,255,37,0.3)]"
        />
        
        {/* DROPDOWN DES SUGGESTIONS (S'affiche après 3 lettres) */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <ul className="absolute w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl z-50">
            {searchSuggestions.map((name, i) => (
              <li 
                key={i} 
                onClick={() => {
                  setSearchTerm(name);
                  setShowSuggestions(false);
                }}
                className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
              >
                <Search className="text-white/30" size={14} />
                <span className="text-sm font-bold uppercase">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FILTRES DÉROULANTS (Sport & Spécificité) */}
      <div className="flex gap-2 mb-4">
        
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

      {/* BARRE DES BRANDS (Logos scrollables horizontalement) */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 [&::-webkit-scrollbar]:hidden">
        {/* Bouton TOUT */}
        <button 
          onClick={() => setSelectedBrand('')}
          className={`flex-shrink-0 px-5 h-9 rounded-full text-xs font-black italic uppercase transition-all ${
            selectedBrand === '' 
              ? 'bg-[#AFFF25] text-black shadow-[0_0_15px_rgba(175,255,37,0.3)]' 
              : 'bg-[#040221] text-white border border-white/20'
          }`}
        >
          Tout
        </button>
        
        {/* Logos des Brands issus de set.json */}
        {availableBrands.map((b: any, i: number) => {
          const brandSlug = b.name.toLowerCase().replace(/\s+/g, '-');
          const isSelected = selectedBrand === b.name;
          return (
            <button 
              key={i}
              onClick={() => setSelectedBrand(b.name)}
              className={`flex-shrink-0 h-9 px-4 rounded-full flex items-center justify-center transition-all border ${
                isSelected 
                  ? 'border-[#AFFF25] bg-[#AFFF25]/10 shadow-[0_0_15px_rgba(175,255,37,0.2)]' 
                  : 'border-white/20 bg-[#040221]'
              }`}
            >
              <img 
                src={`/asset/brands/${brandSlug}.png`} 
                alt={b.name} 
                className="h-4 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                  }
                }}
              />
              {/* Ce texte s'affiche uniquement si l'image est introuvable */}
              <span className="text-[10px] font-black italic uppercase hidden">{b.name}</span>
            </button>
          )
        })}
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