'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Folder, LayoutGrid, Star, ChevronLeft, ChevronDown, Check, Trash2, Loader2 } from 'lucide-react';

const SPORT_ORDER = ['SOCCER', 'TENNIS', 'BASKETBALL', 'BASEBALL', 'NHL', 'NFL', 'F1'];

const SPORT_CONFIG: Record<string, { image: string, label: string }> = {
  'SOCCER': { image: 'Soccer', label: 'Football' },
  'TENNIS': { image: 'Tennis', label: 'Tennis' },
  'BASKETBALL': { image: 'Basket', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', label: 'Baseball' },
  'NHL': { image: 'NHL', label: 'Hockey' },
  'NFL': { image: 'NFL', label: 'Football Am.' },
  'F1': { image: 'F1', label: 'Formule 1' }
};

const FOLDER_TYPES = ['Binder', 'Deck', 'Boîte', 'Digital', 'Autre'];
const BRANDS = ['Panini', 'Topps', 'Upper Deck', 'Leaf', 'Futera'];

export default function CollectionPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'cartes' | 'dossiers'>('cartes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Filtres
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [showAuto, setShowAuto] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [showNumbered, setShowNumbered] = useState(false);
  
  const [openDropdown, setOpenDropdown] = useState<'brand' | 'spec' | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState('Binder');

  const [cards, setCards] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);

  // État pour la grille Pinterest (détecte si une image est horizontale)
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCollection();
  }, []);

  // 🚀 VRAIE CONNEXION SUPABASE
  const fetchCollection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Récupérer les cartes en excluant la Wishlist !
    const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
    if (cardsData) {
      setCards(cardsData.filter(c => c.is_wishlist !== true));
    }

    // Récupérer les dossiers de l'utilisateur
    const { data: foldersData } = await supabase.from('folders').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (foldersData) setFolders(foldersData);

    setLoading(false);
  };

  const favoriteFolders = folders.filter(f => f.is_favorite);
  const otherFolders = folders.filter(f => !f.is_favorite);
  const currentFolder = folders.find(f => f.id === activeFolderId);

  const getFolderCardCount = (folderId: string) => {
    return cards.filter(card => card.folder_id === folderId).length;
  };

  // === ACTIONS SUR LES DOSSIERS (SUPABASE) ===
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('folders').insert([{
      name: newFolderName,
      type: newFolderType,
      user_id: user.id,
      is_favorite: false
    }]).select();

    if (data && data.length > 0) {
      setFolders([...folders, data[0]]);
    }
    
    setIsModalOpen(false); 
    setNewFolderName(''); 
    setNewFolderType('Binder');
  };

  const toggleFolderFavorite = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    setFolders(folders.map(f => f.id === folderId ? { ...f, is_favorite: !f.is_favorite } : f));
    await supabase.from('folders').update({ is_favorite: !folder.is_favorite }).eq('id', folderId);
  };

  const deleteFolder = async (folderId: string) => {
    if (window.confirm("Supprimer ce dossier ? (Tes cartes ne seront pas supprimées, elles retourneront dans la collection globale).")) {
      setFolders(folders.filter(f => f.id !== folderId));
      setActiveFolderId(null);
      await supabase.from('folders').delete().eq('id', folderId);
    }
  };

  // Permet de détecter la taille de l'image pour la grille Pinterest
  const handleImageLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > naturalHeight) {
      setHorizontalCards(prev => ({ ...prev, [id]: true }));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  // ==========================================
  // BLOC RÉUTILISABLE : FILTRES + GRILLE CARTES
  // ==========================================
  const renderCardsAndFilters = () => {
    const baseCards = activeFolderId ? cards.filter(c => c.folder_id === activeFolderId) : cards;

    const uniqueSports = new Set(baseCards.map(c => c.sport));
    const availableSports = SPORT_ORDER.filter(sportKey => uniqueSports.has(sportKey));
    const hasMultipleSports = availableSports.length > 1;

    const filteredCards = baseCards.filter(card => {
      const searchMatch = !searchQuery || card.lastname?.toLowerCase().includes(searchQuery.toLowerCase()) || card.firstname?.toLowerCase().includes(searchQuery.toLowerCase());
      const sportMatch = !selectedSport || card.sport === selectedSport;
      const brandMatch = !selectedBrand || card.brand === selectedBrand;
      const autoMatch = !showAuto || card.is_auto;
      const patchMatch = !showPatch || card.is_patch;
      const numberedMatch = !showNumbered || card.is_numbered;
      return searchMatch && sportMatch && brandMatch && autoMatch && patchMatch && numberedMatch;
    });

    return (
      <>
        {/* 1. FILTRE SPORT */}
        {hasMultipleSports && (
          <div className="overflow-x-auto no-scrollbar mb-4 mt-4">
            <div className="flex gap-3 px-6 pb-2 w-max">
              <button 
                onClick={() => setSelectedSport(null)}
                className={`px-5 py-2.5 rounded-full border flex items-center gap-2 transition-all ${!selectedSport ? 'bg-[#AFFF25] text-black border-[#AFFF25] shadow-[0_0_10px_rgba(175,255,37,0.3)]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
              >
                <LayoutGrid size={16} className={!selectedSport ? 'text-black' : 'text-[#AFFF25]'} />
                <span className="text-sm font-bold">Tout</span>
              </button>
              
              {availableSports.map(sportKey => {
                const isSelected = selectedSport === sportKey;
                const imgSrc = `/asset/sports/${isSelected ? 'neg-' : ''}${SPORT_CONFIG[sportKey].image}.png`;

                return (
                  <button 
                    key={sportKey}
                    onClick={() => setSelectedSport(sportKey)}
                    className={`px-5 py-2.5 rounded-full border flex items-center gap-2 transition-all ${isSelected ? 'bg-[#AFFF25] text-black border-[#AFFF25] shadow-[0_0_10px_rgba(175,255,37,0.3)]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                  >
                    <img src={imgSrc} className="h-4 object-contain" alt={SPORT_CONFIG[sportKey].label} />
                    <span className="text-sm font-bold whitespace-nowrap">{SPORT_CONFIG[sportKey].label}</span>
                  </button>
                );
              })}
              <div className="w-1 shrink-0"></div>
            </div>
          </div>
        )}

        {/* 2. DROPDOWNS : SPÉCIFICITÉS ET MARQUES */}
        <div className={`relative z-30 mb-6 px-6 ${!hasMultipleSports ? 'mt-4' : ''}`}>
          
          {openDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border text-sm font-bold transition-all relative z-50 ${showAuto || showPatch || showNumbered ? 'bg-[#10243E] border-[#1E3A8A] text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
            >
              Spécificités <ChevronDown size={14} className={`transition-transform ${openDropdown === 'spec' ? 'rotate-180' : ''}`} />
            </button>

            <button 
              onClick={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border text-sm font-bold transition-all relative z-50 ${selectedBrand ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
            >
              <span className="truncate max-w-[100px]">{selectedBrand || 'Marques'}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${openDropdown === 'brand' ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {openDropdown === 'spec' && (
            <div className="absolute top-full left-6 right-6 mt-2 z-50 bg-[#040221] border border-white/10 rounded-[24px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2">
              {[
                { label: 'Autographe', state: showAuto, toggle: () => setShowAuto(!showAuto) },
                { label: 'Patch', state: showPatch, toggle: () => setShowPatch(!showPatch) },
                { label: 'Numéroté', state: showNumbered, toggle: () => setShowNumbered(!showNumbered) }
              ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={item.toggle}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold text-white hover:bg-white/5 transition-colors mb-1 last:mb-0"
                >
                  <span>{item.label}</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${item.state ? 'bg-[#AFFF25] border-[#AFFF25] text-black' : 'border-white/20'}`}>
                    {item.state && <Check size={12} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {openDropdown === 'brand' && (
            <div className="absolute top-full left-6 right-6 mt-2 z-50 bg-[#040221] border border-white/10 rounded-[24px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2 max-h-72 overflow-y-auto no-scrollbar">
              <button 
                onClick={() => { setSelectedBrand(null); setOpenDropdown(null); }}
                className={`w-full text-center px-4 py-3 rounded-2xl text-sm mb-2 transition-colors ${!selectedBrand ? 'bg-[#AFFF25] text-black font-bold' : 'text-white/60 hover:bg-white/5 hover:text-white font-bold'}`}
              >
                Toutes les marques
              </button>
              {BRANDS.map(brand => {
                const slug = brand.toLowerCase().replace(/\s+/g, '-');
                return (
                  <button 
                    key={brand}
                    onClick={() => { setSelectedBrand(brand); setOpenDropdown(null); }}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm mb-1 transition-colors ${selectedBrand === brand ? 'bg-white/10 text-white font-bold' : 'text-white font-bold hover:bg-white/5'}`}
                  >
                    <img src={`/asset/logo-marque/${slug}.png`} alt={brand} className="h-5 object-contain mix-blend-screen opacity-90" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span>{brand}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. GRILLE DE CARTES PINTEREST - PASSÉE SUR 3 COLONNES */}
        <div className="px-6 grid grid-cols-3 gap-3 pb-20 auto-rows-max">
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
                      alt={card.lastname} 
                      onLoad={(e) => handleImageLoad(card.id, e)}
                      className="w-full h-full object-cover opacity-80" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">Pas d'image</div>
                  )}

                  <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                    <div className="text-[9px] text-white/70 uppercase truncate">{card.firstname}</div>
                    <div className="text-sm font-black text-[#AFFF25] uppercase italic leading-none truncate">{card.lastname}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-10 text-white/40 italic">
              Aucune carte ne correspond à ces filtres.
            </div>
          )}
        </div>
      </>
    );
  };

  // ==========================================
  // VUE INTÉRIEURE D'UN DOSSIER
  // ==========================================
  if (activeFolderId && currentFolder) {
    return (
      <div className="min-h-screen bg-[#040221] text-white font-sans pb-32 animate-in slide-in-from-right-8 duration-300">
        
        <div className="pt-8 pb-4 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <button 
              onClick={() => setActiveFolderId(null)} 
              className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="overflow-hidden">
              <div className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">{currentFolder.type}</div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none truncate">{currentFolder.name}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => toggleFolderFavorite(currentFolder.id)}
              className="p-2 active:scale-90 transition-transform"
            >
              <Star size={24} strokeWidth={currentFolder.is_favorite ? 0 : 2} className={currentFolder.is_favorite ? "text-[#AFFF25] fill-[#AFFF25]" : "text-white/40 hover:text-white"} />
            </button>
            <button 
              onClick={() => deleteFolder(currentFolder.id)}
              className="p-2 active:scale-90 transition-transform text-red-500/80 hover:text-red-500"
            >
              <Trash2 size={24} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {renderCardsAndFilters()}
      </div>
    );
  }

  // ==========================================
  // VUE PRINCIPALE (COLLECTION)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans pb-32">
      
      {/* HEADER & SEARCH */}
      <div className="pt-8 pb-4">
        <h1 className="text-3xl font-black italic text-white uppercase px-6 mb-6 tracking-tighter text-center">Ma Collection</h1>
        
        <div className="relative mx-6 mb-6">
          <input 
            type="text" 
            placeholder="Rechercher un joueur..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-[16px] pr-[44px] text-white placeholder-white/40 focus:outline-none focus:border-[#AFFF25]/50 transition-colors"
          />
          <Search className="absolute right-[16px] top-1/2 -translate-y-1/2 text-[#AFFF25]" size={20} />
        </div>

        {/* ONGLETS */}
        <div className="flex px-6 gap-6 border-b border-white/10 mb-2">
          <button 
            onClick={() => setActiveTab('cartes')}
            className={`pb-3 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'cartes' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}
          >
            Cartes
            {activeTab === 'cartes' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('dossiers')}
            className={`pb-3 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'dossiers' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}
          >
            Dossiers
            {activeTab === 'dossiers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}
          </button>
        </div>
      </div>

      {/* VUE CARTES */}
      {activeTab === 'cartes' && renderCardsAndFilters()}

      {/* VUE DOSSIERS */}
      {activeTab === 'dossiers' && (
        <div className="animate-in fade-in duration-300">
          
          <div className="px-6 flex justify-between items-center mb-4 mt-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Star size={18} className="text-[#AFFF25] fill-[#AFFF25]" /> Favoris
            </h2>
            <button onClick={() => setIsModalOpen(true)} className="w-8 h-8 rounded-full bg-[#AFFF25]/20 text-[#AFFF25] flex items-center justify-center hover:bg-[#AFFF25]/30 transition-colors">
              <Plus size={18} />
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar mb-10">
            <div className="flex gap-4 px-6 pb-4 w-max">
              {favoriteFolders.map(folder => (
                <div 
                  key={folder.id} 
                  onClick={() => setActiveFolderId(folder.id)}
                  className="w-[180px] h-[180px] rounded-[24px] p-5 border border-white/10 bg-gradient-to-br from-white/10 to-white/5 flex flex-col justify-between relative group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full bg-[#AFFF25]/10 flex items-center justify-center border border-[#AFFF25]/20">
                    <Folder size={24} className="text-[#AFFF25]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">{folder.type}</div>
                    <div className="text-xl font-black text-white leading-tight mb-1">{folder.name}</div>
                    <div className="text-xs text-[#AFFF25] font-medium">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
              {favoriteFolders.length === 0 && <div className="text-white/40 text-sm italic py-8">Aucun dossier favori.</div>}
              <div className="w-2 shrink-0"></div>
            </div>
          </div>

          <div className="px-6 flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Tous les dossiers</h2>
            <button onClick={() => setIsModalOpen(true)} className="text-[#AFFF25] p-2 active:scale-90 transition-transform">
              <Plus size={20} />
            </button>
          </div>
          
          <div className="px-6 flex flex-col gap-3 pb-20">
            {otherFolders.map(folder => (
              <div 
                key={folder.id} 
                onClick={() => setActiveFolderId(folder.id)}
                className="w-full flex items-center justify-between p-4 rounded-[20px] border border-white/10 bg-white/5 cursor-pointer active:scale-95 transition-transform hover:bg-white/10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Folder size={20} className="text-white/60" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white leading-tight">{folder.name}</div>
                    <div className="text-xs text-[#AFFF25] mt-0.5">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <span className="text-[10px] px-3 py-1 rounded-full bg-white/10 text-white/60 font-bold uppercase tracking-widest">{folder.type}</span>
              </div>
            ))}
            {otherFolders.length === 0 && <div className="text-white/40 text-sm italic">Aucun autre dossier.</div>}
          </div>
        </div>
      )}

      {/* MODAL / POPIN AJOUT DE DOSSIER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-[#040221] rounded-t-[32px] sm:rounded-[32px] p-6 pb-32 sm:pb-6 border-t sm:border border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase italic">Nouveau Dossier</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-[#AFFF25] uppercase tracking-widest mb-2">Nom du dossier</label>
                <input type="text" autoFocus required value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: PC Mbappé, Classeur NBA..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#AFFF25]/50 transition-colors" />
              </div>
              <div className="mb-8">
                <label className="block text-xs font-bold text-[#AFFF25] uppercase tracking-widest mb-2">Type de rangement</label>
                <div className="grid grid-cols-3 gap-2">
                  {FOLDER_TYPES.map(type => (
                    <button key={type} type="button" onClick={() => setNewFolderType(type)} className={`py-2 rounded-lg text-xs font-bold border transition-colors ${newFolderType === type ? 'bg-[#AFFF25] border-[#AFFF25] text-black' : 'bg-transparent border-white/20 text-white/60 hover:bg-white/5'}`}>{type}</button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-[#AFFF25] text-black rounded-xl font-black uppercase tracking-widest text-sm hover:bg-[#9ee615] transition-colors shadow-[0_0_20px_rgba(175,255,37,0.3)]">Créer le dossier</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}