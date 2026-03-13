'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronDown, Loader2 } from 'lucide-react';

const SPORT_FOLDERS: Record<string, string> = {
  'SOCCER': 'foot',
  'BASKETBALL': 'NBA',
  'BASEBALL': 'MLB',
  'NFL': 'NFL',
  'NHL': 'NHL'
};

const slugify = (text: string) => {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export default function ClubPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State pour forcer la détection des cartes horizontales
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});

  // Filtres
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'player' | 'spec' | null>(null);

  useEffect(() => {
    fetchClubCards();
  }, [slug]);

  const fetchClubCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
    
    if (data) {
      const clubCards = data.filter(c => c.club_name && slugify(c.club_name) === slug && !c.is_wishlist);
      setCards(clubCards);
    }
    
    setLoading(false);
  };

  // Fonction qui détecte si l'image est horizontale au chargement
  const handleImageLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth > e.currentTarget.naturalHeight) {
      setHorizontalCards(prev => ({ ...prev, [id]: true }));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-[#040221] flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="mb-4 text-white/60">Aucune carte trouvée pour ce club.</p>
        <button onClick={() => router.back()} className="px-6 py-3 bg-[#AFFF25] text-[#040221] font-bold rounded-full">Retour</button>
      </div>
    );
  }

  const firstCard = cards[0];
  const clubName = firstCard.club_name;
  const sportFolder = SPORT_FOLDERS[firstCard.sport] || 'foot';
  const logoUrl = `/asset/logo-club/${sportFolder}/${slug}.svg`;

  const uniquePlayers = Array.from(new Set(cards.map(c => `${c.firstname || ''} ${c.lastname || ''}`.trim()))).filter(Boolean);

  const filteredCards = cards.filter(card => {
    const fullName = `${card.firstname || ''} ${card.lastname || ''}`.trim();
    const playerMatch = !selectedPlayer || fullName === selectedPlayer;
    
    const specMatch = !selectedSpec || 
      (selectedSpec === 'Auto' && card.is_auto) || 
      (selectedSpec === 'Patch' && card.is_patch) || 
      (selectedSpec === 'Numéroté' && card.is_numbered);

    return playerMatch && specMatch;
  });

  return (
    <div className="min-h-screen text-white font-sans relative bg-[#040221]">
      
      {/* HEADER FIXE */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center p-6">
        <button onClick={() => router.back()} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all">
          <ChevronLeft size={20} />
        </button>
      </header>

      {/* BACKGROUND BLURRÉ AVEC LE LOGO */}
      <div className="absolute top-0 left-0 w-full h-[450px] overflow-hidden z-0">
        <img 
          src={logoUrl} 
          alt="Club Background" 
          className="w-full h-full object-cover blur-[60px] opacity-40 scale-150 saturate-150"
          onError={(e) => e.currentTarget.style.display = 'none'}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#040221]/80 to-[#040221]"></div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 pt-20 flex flex-col items-center">
        
        {/* LOGO CENTRAL */}
        <div className="w-48 h-48 mb-8 flex items-center justify-center drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <img 
            src={logoUrl} 
            alt={clubName} 
            className="max-w-full max-h-full object-contain"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        </div>

        {/* CONTAINER DU BAS (Arrondi) */}
        <div className="w-full bg-[#040221] rounded-t-[32px] px-4 pt-6 pb-32 min-h-[50vh] shadow-[0_-20px_40px_rgba(0,0,0,0.4)] relative">
          
          <h1 className="text-3xl font-black italic uppercase text-center mb-6 tracking-tighter">
            {clubName}
          </h1>

          {/* FILTRES (Dropdowns) */}
          <div className="flex gap-3 mb-6 relative z-20">
            {openDropdown && <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>}

            {/* Dropdown Joueurs */}
            <div className="relative flex-[2]">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'player' ? null : 'player')}
                className="w-full border border-white/20 rounded-full px-4 py-2.5 flex items-center justify-between bg-transparent active:scale-95 transition-transform relative z-20"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-white/90 truncate mr-2">
                  {selectedPlayer ? selectedPlayer : 'TOUS LES JOUEURS'}
                </span>
                <ChevronDown size={14} className={`text-white/80 transition-transform ${openDropdown === 'player' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'player' && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#040221] border border-white/10 rounded-2xl shadow-2xl p-2 z-30 max-h-60 overflow-y-auto">
                  <button onClick={() => { setSelectedPlayer(null); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-white/10 rounded-xl">Tous les joueurs</button>
                  {uniquePlayers.map(player => (
                    <button key={player} onClick={() => { setSelectedPlayer(player); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-white/10 rounded-xl truncate">
                      {player}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown Spécificités */}
            <div className="relative flex-1">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')}
                className="w-full border border-white/20 rounded-full px-4 py-2.5 flex items-center justify-between bg-transparent active:scale-95 transition-transform relative z-20"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-white/90 truncate mr-2">
                  {selectedSpec ? selectedSpec : 'Filtre'}
                </span>
                <ChevronDown size={14} className={`text-white/80 transition-transform ${openDropdown === 'spec' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'spec' && (
                <div className="absolute top-full right-0 w-48 mt-2 bg-[#040221] border border-white/10 rounded-2xl shadow-2xl p-2 z-30">
                  <button onClick={() => { setSelectedSpec(null); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-white/10 rounded-xl">Toutes</button>
                  {['Auto', 'Patch', 'Numéroté'].map(spec => (
                    <button key={spec} onClick={() => { setSelectedSpec(spec); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-white/10 rounded-xl">
                      {spec}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* GRILLE DE CARTES (3 Colonnes - Ajout de grid-flow-dense) */}
          <div className="grid grid-cols-3 gap-2 grid-flow-dense auto-rows-max">
            {filteredCards.length > 0 ? (
              filteredCards.map(card => {
                // On vérifie soit le state calculé par l'image, soit la base de données
                const isHorizontal = horizontalCards[card.id] || card.is_horizontal;
                
                return (
                  <div 
                    key={card.id} 
                    onClick={() => router.push(`/card/${card.id}`)} 
                    // Si isHorizontal = true -> col-span-2. Sinon -> col-span-1
                    className={`relative rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'}`}
                  >
                    {card.image_url ? (
                      <img 
                        src={card.image_url} 
                        alt={card.lastname} 
                        onLoad={(e) => handleImageLoad(card.id, e)} // Appel au moment du chargement de l'image
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">No Img</div>
                    )}
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <div className="text-[9px] text-white/70 uppercase truncate">{card.firstname}</div>
                      <div className="text-[11px] font-black text-[#AFFF25] uppercase italic leading-none truncate">{card.lastname}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-10 text-white/40 italic">
                Aucune carte ne correspond aux filtres.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}