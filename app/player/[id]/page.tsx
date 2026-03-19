'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronDown, Loader2 } from 'lucide-react';

export default function PlayerPage() {
  const router = useRouter();
  const { id } = useParams();
  
  const [player, setPlayer] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State pour la détection des cartes horizontales
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});

  // Filtres
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'spec' | null>(null);

  useEffect(() => {
    fetchPlayerData();
  }, [id]);

  const fetchPlayerData = async () => {
    // 1️⃣ CHARGEMENT HORS-LIGNE (CACHE)
    if (typeof window !== 'undefined') {
      const cachedPlayer = localStorage.getItem(`cardbulk_player_${id}`);
      if (cachedPlayer) setPlayer(JSON.parse(cachedPlayer));

      const cachedCards = localStorage.getItem('cardbulk_offline_cards');
      if (cachedCards) {
        const allCards = JSON.parse(cachedCards);
        // Filtre les cartes du joueur spécifique
        setCards(allCards.filter((c: any) => c.player_id === id && !c.is_wishlist));
        setLoading(false); // Affichage instantané !
      }
    }

    // 2️⃣ MISE À JOUR DEPUIS SUPABASE (EN ARRIÈRE-PLAN)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user && !userError) return router.push('/login');
      if (!user) throw new Error("Offline");

      // Récupération des infos du joueur
      const { data: p } = await supabase.from('players').select('*, clubs(*)').eq('id', id).single();
      if (p) {
        setPlayer(p);
        localStorage.setItem(`cardbulk_player_${id}`, JSON.stringify(p)); // Cache individuel du joueur
      }

      // Récupération des cartes
      const { data: userCards } = await supabase.from('cards').select('*').eq('user_id', user.id);
      if (userCards) {
        // Mise à jour du cache global de la collection
        localStorage.setItem('cardbulk_offline_cards', JSON.stringify(userCards));
        // On ne garde que les cartes de ce joueur
        setCards(userCards.filter(c => c.player_id === id && !c.is_wishlist));
      }
    } catch (error) {
      console.log("🌐 Mode hors-ligne activé pour la page Joueur");
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = (cardId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth > e.currentTarget.naturalHeight) {
      setHorizontalCards(prev => ({ ...prev, [cardId]: true }));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const filteredCards = cards.filter(card => {
    if (!selectedSpec) return true;
    if (selectedSpec === 'Auto') return card.is_auto;
    if (selectedSpec === 'Patch') return card.is_patch;
    if (selectedSpec === 'Numéroté') return card.is_numbered;
    return true;
  });

  return (
    <div className="min-h-screen text-white font-sans relative bg-[#040221] w-full">
      
      {/* HEADER FIXE : avec lg:px-[80px] pour alignement Desktop */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center p-6 lg:px-[80px] pointer-events-none">
        <button onClick={() => router.back()} className="pointer-events-auto w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all">
          <ChevronLeft size={20} />
        </button>
      </header>

      {/* CONTENU PRINCIPAL */}
      <div className="relative z-10 pt-24 flex flex-col items-center">
        
        {/* EN-TÊTE JOUEUR */}
        <div className="px-6 lg:px-[80px] w-full mb-10 text-center flex flex-col items-center">
          <p className="text-[#AFFF25] font-bold uppercase text-sm tracking-widest mb-2 border border-[#AFFF25]/30 bg-[#AFFF25]/10 px-4 py-1.5 rounded-full inline-block">
            {player?.clubs?.name || 'Club Inconnu'}
          </p>
          <h1 className="text-5xl lg:text-7xl font-black italic uppercase leading-none tracking-tighter drop-shadow-lg">
            {player?.name || 'Joueur'}
          </h1>
        </div>

        {/* CONTAINER DU BAS : lg:px-[80px] pour la largeur complète */}
        <div className="w-full bg-[#040221] rounded-t-[32px] px-4 lg:px-[80px] pt-8 pb-32 min-h-[60vh] shadow-[0_-20px_40px_rgba(0,0,0,0.4)] relative border-t border-white/5">
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold uppercase text-white/60 tracking-widest">
              Ses cartes ({filteredCards.length})
            </h2>

            {/* FILTRE SPÉCIFICITÉS */}
            <div className="relative z-20 w-[160px]">
              {openDropdown && <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>}
              
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')}
                className="w-full border border-white/20 rounded-full px-4 py-2 flex items-center justify-between bg-transparent active:scale-95 transition-transform relative z-20"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-white/90 truncate mr-2">
                  {selectedSpec ? selectedSpec : 'Filtre'}
                </span>
                <ChevronDown size={14} className={`text-white/80 transition-transform ${openDropdown === 'spec' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'spec' && (
                <div className="absolute top-full right-0 w-full mt-2 bg-[#040221] border border-white/10 rounded-2xl shadow-2xl p-2 z-30">
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

          {/* 🚨 GRILLE DE CARTES : Passage en lg:grid-cols-5 sur Desktop avec marges 🚨 */}
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3 grid-flow-dense auto-rows-max">
            {filteredCards.length > 0 ? (
              filteredCards.map(card => {
                const isHorizontal = horizontalCards[card.id] || card.is_horizontal;
                
                return (
                  <div 
                    key={card.id} 
                    onClick={() => router.push(`/card/${card.id}`)} 
                    className={`relative rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'}`}
                  >
                    {card.image_url ? (
                      <img 
                        src={card.image_url} 
                        alt={card.lastname || player?.name} 
                        onLoad={(e) => handleImageLoad(card.id, e)}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">No Img</div>
                    )}
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <div className="text-[9px] text-white/70 uppercase truncate">{card.brand || card.firstname}</div>
                      <div className="text-[11px] lg:text-xs font-black text-[#AFFF25] uppercase italic leading-none truncate">{card.series || card.lastname || player?.name}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 lg:col-span-5 text-center py-10 text-white/40 italic">
                Aucune carte ne correspond aux filtres.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}