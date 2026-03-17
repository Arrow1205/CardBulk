'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Folder, LayoutGrid, Star, ChevronLeft, ChevronDown, Trash2, Loader2, Check, Sparkles, Send } from 'lucide-react';

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

type Message = { role: 'user' | 'assistant', content: string };

const FloatingSearchBar = ({ searchQuery, setSearchQuery }: { searchQuery: string, setSearchQuery: (val: string) => void }) => (
  <div className="fixed bottom-[108px] left-0 w-full px-6 z-40 pointer-events-none">
    <div className="relative w-full max-w-md mx-auto pointer-events-auto">
      <input 
        type="text" 
        placeholder="Rechercher joueur ou club..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-[#040221] border-2 border-[#AFFF25] rounded-full py-3.5 pl-[20px] pr-[44px] text-white placeholder-white/40 focus:outline-none focus:shadow-[0_0_15px_rgba(175,255,37,0.3)] transition-all shadow-[0_10px_40px_rgba(0,0,0,0.9)]"
      />
      
      <div className="absolute right-[16px] top-1/2 -translate-y-1/2">
        {searchQuery.length === 0 ? (
          <Search className="text-[#AFFF25]" size={20} />
        ) : (
          <button onClick={() => setSearchQuery('')} className="text-red-500 hover:text-red-400 transition-colors flex items-center justify-center p-1"><X size={20} strokeWidth={3} /></button>
        )}
      </div>
    </div>
  </div>
);

export default function CollectionPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'cartes' | 'dossiers' | 'scouty'>('cartes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
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
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});

  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [selectedForFolder, setSelectedForFolder] = useState<Set<string>>(new Set());

  // IA STATES
  const [hasStartedScouty, setHasStartedScouty] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      const sportParam = params.get('sport');
      if (searchParam) setSearchQuery(searchParam);
      if (sportParam) setSelectedSport(sportParam);
    }
    fetchCollection();
  }, []);

  useEffect(() => {
    if (activeTab === 'scouty') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, aiLoading, activeTab]);

  const fetchCollection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (cardsData) setCards(cardsData.filter(c => c.is_wishlist !== true));
    const { data: foldersData } = await supabase.from('folders').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (foldersData) setFolders(foldersData);
    setLoading(false);
  };

  const favoriteFolders = folders.filter(f => f.is_favorite);
  const otherFolders = folders.filter(f => !f.is_favorite);
  const currentFolder = folders.find(f => f.id === activeFolderId);

  const getFolderCardCount = (folderId: string) => cards.filter(card => card.folder_id === folderId).length;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('folders').insert([{ name: newFolderName, type: newFolderType, user_id: user.id, is_favorite: false }]).select();
    if (data && data.length > 0) setFolders([...folders, data[0]]);
    setIsModalOpen(false); setNewFolderName(''); setNewFolderType('Binder');
  };

  const toggleFolderFavorite = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    setFolders(folders.map(f => f.id === folderId ? { ...f, is_favorite: !f.is_favorite } : f));
    await supabase.from('folders').update({ is_favorite: !folder.is_favorite }).eq('id', folderId);
  };

  const deleteFolder = async (folderId: string) => {
    if (window.confirm("Supprimer ce dossier ?")) {
      setFolders(folders.filter(f => f.id !== folderId));
      setActiveFolderId(null);
      await supabase.from('folders').delete().eq('id', folderId);
    }
  };

  const handleImageLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth > e.currentTarget.naturalHeight) setHorizontalCards(prev => ({ ...prev, [id]: true }));
  };

  const handleStartSelection = () => {
    if (!activeFolderId) return;
    const alreadyInFolder = cards.filter(c => c.folder_id === activeFolderId).map(c => c.id);
    setSelectedForFolder(new Set(alreadyInFolder));
    setTargetFolderId(activeFolderId);
    setActiveFolderId(null);
    setActiveTab('cartes');
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedForFolder(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  };

  const handleCancelSelection = () => {
    setActiveFolderId(targetFolderId);
    setTargetFolderId(null);
    setSelectedForFolder(new Set());
  };

  const handleConfirmSelection = async () => {
    if (!targetFolderId) return;
    const folderId = targetFolderId;
    const updatedCards = cards.map(c => {
      if (selectedForFolder.has(c.id)) return { ...c, folder_id: folderId };
      else if (c.folder_id === folderId && !selectedForFolder.has(c.id)) return { ...c, folder_id: null };
      return c;
    });
    setCards(updatedCards);
    setActiveFolderId(folderId);
    setTargetFolderId(null);
    setSelectedForFolder(new Set());
    await supabase.from('cards').update({ folder_id: null }).eq('folder_id', folderId);
    const selectedArray = Array.from(selectedForFolder);
    if (selectedArray.length > 0) await supabase.from('cards').update({ folder_id: folderId }).in('id', selectedArray);
  };

  const handleAskAI = async (questionText: string) => {
    if (!questionText.trim()) return;

    if (!hasStartedScouty) setHasStartedScouty(true);

    const newMessages = [...messages, { role: 'user' as const, content: questionText }];
    setMessages(newMessages);
    setChatInput('');
    setAiLoading(true);

    const searchTerm = searchQuery.toLowerCase().trim();
    const isGlobal = searchTerm.length === 0;

    const cardsToSend = isGlobal ? cards : cards.filter(card => {
      const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
      const reverseFullName = `${card.lastname || ''} ${card.firstname || ''}`.toLowerCase();
      return fullName.includes(searchTerm) || reverseFullName.includes(searchTerm);
    });

    const formattedCollection = cardsToSend.map(c => ({
      joueur: `${c.firstname || ''} ${c.lastname || ''}`.trim(),
      sport: c.sport || 'Inconnu',
      carte: `${c.brand || 'Inconnu'} ${c.series || ''} ${c.year || ''}`.trim(),
      details: [
        c.is_numbered ? `Numérotée /${c.numbering_max}` : '',
        c.is_auto ? 'Auto' : '',
        c.is_patch ? 'Patch' : ''
      ].filter(Boolean).join(' - ') || 'Base',
      prix_paye: c.purchase_price ? `${c.purchase_price}€` : 'Non renseigné'
    }));

    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages, 
          playerName: isGlobal ? "Global" : searchQuery,
          collectionData: formattedCollection
        }),
      });

      if (!response.ok) throw new Error('Erreur réseau');

      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant' as const, content: data.text }]);

    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'assistant' as const, content: "Erreur réseau. Veuillez réessayer plus tard." }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const renderCardsAndFilters = () => {
    const baseCards = activeFolderId ? cards.filter(c => c.folder_id === activeFolderId) : cards;
    const uniqueSports = new Set(baseCards.map(c => c.sport));
    const availableSports = SPORT_ORDER.filter(sportKey => uniqueSports.has(sportKey));
    const hasMultipleSports = availableSports.length > 1;

    const filteredCards = baseCards.filter(card => {
      const searchTerm = searchQuery.toLowerCase().trim();
      const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
      const reverseFullName = `${card.lastname || ''} ${card.firstname || ''}`.toLowerCase();
      const searchMatch = !searchQuery || fullName.includes(searchTerm) || reverseFullName.includes(searchTerm) || card.club_name?.toLowerCase().includes(searchTerm);
      const sportMatch = !selectedSport || card.sport === selectedSport;
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(card.brand);
      const autoMatch = !showAuto || card.is_auto;
      const patchMatch = !showPatch || card.is_patch;
      const numberedMatch = !showNumbered || card.is_numbered;
      return searchMatch && sportMatch && brandMatch && autoMatch && patchMatch && numberedMatch;
    });

    return (
      <div className="w-full">
        {/* 1. FILTRE SPORT */}
        {hasMultipleSports && (
          <div className="overflow-x-auto mb-4 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-3 px-6 pb-2 w-max">
              <button onClick={() => setSelectedSport(null)} className={`px-5 py-2 rounded-full border flex items-center gap-2 transition-all ${!selectedSport ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}><LayoutGrid size={16} /> <span className="text-sm font-bold">Tout</span></button>
              {availableSports.map(sportKey => {
                const isSelected = selectedSport === sportKey;
                return (
                  <button key={sportKey} onClick={() => setSelectedSport(sportKey)} className={`px-5 py-2 rounded-full border flex items-center gap-2 transition-all ${isSelected ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                    <img src={`/asset/sports/${isSelected ? 'neg-' : ''}${SPORT_CONFIG[sportKey].image}.png`} className="h-4 object-contain" alt={SPORT_CONFIG[sportKey].label} />
                    <span className="text-sm font-bold whitespace-nowrap">{SPORT_CONFIG[sportKey].label}</span>
                  </button>
                );
              })}
              <div className="w-1 shrink-0"></div>
            </div>
          </div>
        )}

        <div className={`relative z-50 mb-6 px-6 ${!hasMultipleSports && searchQuery.trim().length === 0 ? 'mt-4' : ''}`}>
          {openDropdown && <div className="fixed inset-0 z-[60] bg-black/20" onClick={() => setOpenDropdown(null)}></div>}
          <div className="flex gap-3">
            <button onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full border text-sm font-bold transition-all relative z-[70] ${showAuto || showPatch || showNumbered ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>Spécificités <ChevronDown size={14} className={openDropdown === 'spec' ? 'rotate-180' : ''} /></button>
            <button onClick={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full border text-sm font-bold transition-all relative z-[70] ${selectedBrands.length > 0 ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}><span className="truncate max-w-[100px]">{selectedBrands.length > 0 ? `${selectedBrands.length} sél.` : 'Marques'}</span><ChevronDown size={14} className={openDropdown === 'brand' ? 'rotate-180' : ''} /></button>
          </div>
          {openDropdown === 'spec' && (
            <div className="absolute top-full left-6 right-6 mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2">
              {[ { label: 'Autographe', state: showAuto, toggle: () => setShowAuto(!showAuto) }, { label: 'Patch', state: showPatch, toggle: () => setShowPatch(!showPatch) }, { label: 'Numéroté', state: showNumbered, toggle: () => setShowNumbered(!showNumbered) } ].map((item, idx) => (
                <div key={idx} onClick={item.toggle} className="w-full flex items-center justify-between py-3 cursor-pointer group"><span className={`text-sm font-bold transition-colors ${item.state ? 'text-white' : 'text-white/60'}`}>{item.label}</span><div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${item.state ? 'bg-[#AFFF25]' : 'bg-white/20'}`}><div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${item.state ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div></div></div>
              ))}
              <button onClick={() => setOpenDropdown(null)} className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">Confirmer</button>
            </div>
          )}
          {openDropdown === 'brand' && (
            <div className="absolute top-full left-6 right-6 mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2 max-h-80 flex flex-col">
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 mb-4">
                {BRANDS.map(brand => {
                  const slug = brand.toLowerCase().replace(/\s+/g, '-'); const isActive = selectedBrands.includes(brand);
                  const toggleBrand = () => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand]);
                  return (<div key={brand} onClick={toggleBrand} className="w-full flex items-center justify-between py-2 cursor-pointer group"><div className="flex items-center gap-4"><img src={`/asset/logo-marque/${slug}.png`} alt={brand} className="h-5 object-contain mix-blend-screen" onError={(e) => e.currentTarget.style.display = 'none'} /><span className={`text-sm font-bold transition-colors ${isActive ? 'text-white' : 'text-white/60'}`}>{brand}</span></div><div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${isActive ? 'bg-[#AFFF25]' : 'bg-white/20'}`}><div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div></div></div>);
                })}
              </div>
              <button onClick={() => setOpenDropdown(null)} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">Confirmer</button>
            </div>
          )}
        </div>

        <div className="px-2 grid grid-cols-3 gap-3 pb-[180px] grid-flow-dense auto-rows-max">
          {filteredCards.length > 0 ? (
            filteredCards.map(card => {
              const isHorizontal = horizontalCards[card.id] || card.is_horizontal;
              const isSelected = targetFolderId && selectedForFolder.has(card.id);
              return (
                <div key={card.id} onClick={() => targetFolderId ? toggleCardSelection(card.id) : router.push(`/card/${card.id}`)} className={`relative rounded-lg overflow-hidden cursor-pointer active:scale-95 transition-transform ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'} ${isSelected ? 'ring-2 ring-[#AFFF25] ring-offset-2 ring-offset-[#040221]' : 'bg-white/5 border border-white/10'}`}>
                  {isSelected && <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center transition-all"><div className="bg-[#AFFF25] rounded-full p-1.5 shadow-lg"><Check size={20} className="text-[#040221] stroke-[3]" /></div></div>}
                  {card.image_url ? <img src={card.image_url} alt={card.lastname} onLoad={(e) => handleImageLoad(card.id, e)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">Pas d'image</div>}
                  <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent z-10"><div className="text-[9px] text-white/70 uppercase truncate">{card.firstname}</div><div className="text-sm font-black text-[#AFFF25] uppercase italic leading-none truncate">{card.lastname}</div></div>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-10 text-white/40 italic">Aucune carte ne correspond.</div>
          )}
        </div>
      </div>
    );
  };

  if (activeFolderId && currentFolder) {
    return (
      <div className="min-h-screen bg-[#040221] text-white font-sans pb-32 animate-in slide-in-from-right-8 duration-300">
        <div className="pt-8 pb-4 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <button onClick={() => setActiveFolderId(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"><ChevronLeft size={20} /></button>
            <div className="overflow-hidden"><div className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">{currentFolder.type}</div><h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none truncate">{currentFolder.name}</h1></div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => toggleFolderFavorite(currentFolder.id)} className="p-2 active:scale-90 transition-transform"><Star size={24} strokeWidth={currentFolder.is_favorite ? 0 : 2} className={currentFolder.is_favorite ? "text-[#AFFF25] fill-[#AFFF25]" : "text-white/40 hover:text-white"} /></button>
            <button onClick={() => deleteFolder(currentFolder.id)} className="p-2 active:scale-90 transition-transform text-red-500/80 hover:text-red-500"><Trash2 size={24} strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className="px-6 pb-4">
          <button onClick={handleStartSelection} className="w-full py-3.5 border border-dashed border-[#AFFF25]/50 text-[#AFFF25] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#AFFF25]/10 active:scale-[0.98] transition-all"><Plus size={18} /> Gérer les cartes du dossier</button>
        </div>
        {renderCardsAndFilters()}
        <FloatingSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-hidden">
      <div className="pt-8 pb-4 shrink-0 z-10 relative bg-[#040221]">
        <h1 className="text-3xl font-black italic text-white uppercase px-6 mb-6 tracking-tighter text-center">{targetFolderId ? "Sélection" : "Collection"}</h1>
        {!targetFolderId && (
          <div className="flex justify-center px-6 gap-6 mb-4">
            <button onClick={() => setActiveTab('cartes')} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'cartes' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>Cartes{activeTab === 'cartes' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}</button>
            
            {/* Clic sur l'onglet Dossiers = on vide la recherche pour éviter les bugs */}
            <button onClick={() => { setActiveTab('dossiers'); setSearchQuery(''); }} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'dossiers' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>Dossiers{activeTab === 'dossiers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}</button>
            
            <button onClick={() => setActiveTab('scouty')} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative flex items-center gap-1.5 ${activeTab === 'scouty' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>
              <Sparkles size={14} className={activeTab === 'scouty' ? "text-[#AFFF25]" : "text-white/40"} /> Scouty
              {activeTab === 'scouty' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}
            </button>
          </div>
        )}
      </div>

      {/* CONTENU SELON L'ONGLET ACTIF */}
      <div className="relative h-[calc(100vh-140px)] overflow-y-auto pb-32">
        
        {activeTab === 'cartes' && renderCardsAndFilters()}

        {activeTab === 'dossiers' && !targetFolderId && (
          <div className="animate-in fade-in duration-300">
            <div className="px-6 flex justify-between items-center mb-4 mt-2"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Star size={18} className="text-[#AFFF25] fill-[#AFFF25]" /> Favoris</h2><button onClick={() => setIsModalOpen(true)} className="w-8 h-8 rounded-full bg-[#AFFF25]/20 text-[#AFFF25] flex items-center justify-center hover:bg-[#AFFF25]/30 transition-colors"><Plus size={18} /></button></div>
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mb-10">
              <div className="flex gap-4 px-6 pb-4 w-max">
                {favoriteFolders.map(folder => (<div key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="w-[180px] h-[180px] rounded-[24px] p-5 border border-white/10 bg-gradient-to-br from-white/10 to-white/5 flex flex-col justify-between relative group cursor-pointer active:scale-95 transition-transform"><div className="w-12 h-12 rounded-full bg-[#AFFF25]/10 flex items-center justify-center border border-[#AFFF25]/20"><Folder size={24} className="text-[#AFFF25]" /></div><div><div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">{folder.type}</div><div className="text-xl font-black text-white leading-tight mb-1">{folder.name}</div><div className="text-xs text-[#AFFF25] font-medium">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div></div></div>))}
                {favoriteFolders.length === 0 && <div className="text-white/40 text-sm italic py-8">Aucun dossier favori.</div>}
                <div className="w-2 shrink-0"></div>
              </div>
            </div>
            <div className="px-6 flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-white">Tous les dossiers</h2><button onClick={() => setIsModalOpen(true)} className="text-[#AFFF25] p-2 active:scale-90 transition-transform"><Plus size={20} /></button></div>
            <div className="px-6 flex flex-col gap-3 pb-[180px]">
              {otherFolders.map(folder => (<div key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="w-full flex items-center justify-between p-4 rounded-[20px] border border-white/10 bg-white/5 cursor-pointer active:scale-95 transition-transform hover:bg-white/10"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Folder size={20} className="text-white/60" /></div><div><div className="text-base font-bold text-white leading-tight">{folder.name}</div><div className="text-xs text-[#AFFF25] mt-0.5">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div></div></div><span className="text-[10px] px-3 py-1 rounded-full bg-white/10 text-white/60 font-bold uppercase tracking-widest">{folder.type}</span></div>))}
              {otherFolders.length === 0 && <div className="text-white/40 text-sm italic">Aucun autre dossier.</div>}
            </div>
          </div>
        )}

        {activeTab === 'scouty' && (
          <div className="px-6 flex flex-col h-full relative animate-in fade-in duration-300">
            {!hasStartedScouty ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-20">
                <img src="/asset/scouty.svg" className="w-36 h-36 object-contain mb-6" alt="Scouty Avatar" />
                <h2 className="text-2xl font-black italic text-[#AFFF25] mb-4">Salut moi c'est Scouty !</h2>
                <p className="text-sm text-white/80 leading-relaxed px-2 mb-auto">
                  Je suis ton assistant expert en cartes de sport et investissement.<br/>
                  Je suis là pour t'aider à analyser le marché et évaluer tes cartes {searchQuery ? `de ${searchQuery}` : "!"}
                </p>
                <div className="w-full mt-10">
                  <p className="text-[10px] text-white/40 italic mb-4">Attention : je peux faire des erreurs, vérifie toujours avant de faire des investissements ou des ventes.</p>
                  <button onClick={() => setHasStartedScouty(true)} className="w-full py-4 bg-[#2544ff] text-white rounded-full font-bold text-base active:scale-95 transition-transform shadow-[0_4px_20px_rgba(37,68,255,0.4)]">
                    C'est parti !
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col space-y-4 pb-[220px]">
                  
                  {messages.length === 0 ? (
                    <div className="space-y-6 pt-4">
                      <div className="flex items-start gap-3">
                        <img src="/asset/scouty.svg" alt="Scouty Avatar" className="w-10 h-10 object-contain shrink-0" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <div className="bg-white/10 text-white p-3.5 rounded-2xl rounded-tl-sm text-sm font-medium">
                          Voici quelques questions pour te guider.
                        </div>
                      </div>

                      <div className="space-y-3">
                        {searchQuery.trim().length > 0 ? (
                          <>
                            <button onClick={() => handleAskAI(`Ai-je acheté mes cartes de ${searchQuery} au bon prix par rapport au marché actuel ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Ai-je acheté mes cartes au bon prix ?
                            </button>
                            <button onClick={() => handleAskAI(`Que me manque-t-il typiquement pour faire un Rainbow ou compléter ma collection de ${searchQuery} ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Que me manque-t-il pour un Rainbow ?
                            </button>
                            <button onClick={() => handleAskAI(`Quelles sont les performances actuelles de ${searchQuery} ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                             Quelles sont les performances actuelles du joueur ?
                            </button>
                            <button onClick={() => handleAskAI(`Est-ce que je dois vendre mes cartes de ${searchQuery} en ce moment ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Quel est le meilleur moment pour vendre cette carte ?
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleAskAI(`Fais-moi un résumé de ma collection. Quels sont mes points forts et les plus belles pièces selon toi ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Quels sont les points forts de ma collection ?
                            </button>
                            <button onClick={() => handleAskAI(`Si je devais me séparer de quelques cartes, lesquelles me conseilles-tu de vendre en priorité vu le marché actuel ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Quelles cartes me conseilles-tu de vendre ?
                            </button>
                            <button onClick={() => handleAskAI(`Est-ce que j'ai trop de cartes différentes dans ma collection ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Est-ce que je diversifie trop ma collection ?
                            </button>
                            <button onClick={() => handleAskAI(`Qui sont les rookies du moment en soccer, basket, baseball... sur lesquels investir en 2026 ?`)} className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm font-semibold text-white">
                              Quels joueurs émergents valent le coup d'acheter maintenant ?
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`p-3.5 rounded-2xl max-w-[85%] text-sm shadow-md ${msg.role === 'user' ? 'bg-[#AFFF25] text-[#040221] self-end rounded-tr-sm font-semibold' : 'bg-white/10 text-white self-start rounded-tl-sm leading-relaxed whitespace-pre-wrap'}`}>
                        {msg.content}
                      </div>
                    ))
                  )}
                  
                  {aiLoading && (
                    <div className="bg-white/10 text-white self-start p-3.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-[#AFFF25]" />
                      <span className="text-xs font-medium text-white/70">Scouty analyse...</span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                <div className="fixed bottom-[108px] left-0 w-full px-6 bg-[#040221] pt-4 pb-2 z-40">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAI(chatInput)}
                      placeholder="Pose une question à Scouty..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3.5 text-sm text-white focus:outline-none focus:border-[#2544ff] transition-colors"
                    />
                    <button 
                      onClick={() => handleAskAI(chatInput)}
                      disabled={aiLoading || !chatInput.trim()}
                      className="w-12 h-12 rounded-full bg-[#2544ff] text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform shrink-0 shadow-[0_4px_15px_rgba(37,68,255,0.4)]"
                    >
                      <Send size={18} className="mr-0.5" />
                    </button>
                  </div>
                  <p className="text-[9px] text-white/40 italic text-center mt-3">
                    Attention : je peux faire des erreurs, vérifie toujours avant de faire des investissements ou des ventes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-[#040221] rounded-t-[32px] sm:rounded-[32px] p-6 pb-32 sm:pb-6 border-t sm:border border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white uppercase italic">Nouveau Dossier</h3><button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"><X size={18} /></button></div>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-6"><label className="block text-xs font-bold text-[#AFFF25] uppercase tracking-widest mb-2">Nom du dossier</label><input type="text" autoFocus required value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: PC Mbappé, Classeur NBA..." className="w-full bg-[#040221] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#AFFF25] transition-colors" /></div>
              <div className="mb-8"><label className="block text-xs font-bold text-[#AFFF25] uppercase tracking-widest mb-2">Type de rangement</label><div className="grid grid-cols-3 gap-2">{FOLDER_TYPES.map(type => (<button key={type} type="button" onClick={() => setNewFolderType(type)} className={`py-2 rounded-lg text-xs font-bold border transition-colors ${newFolderType === type ? 'bg-[#AFFF25] border-[#AFFF25] text-[#040221]' : 'bg-transparent border-white/20 text-white/60 hover:bg-white/10'}`}>{type}</button>))}</div></div>
              <button type="submit" className="w-full py-4 bg-[#AFFF25] text-[#040221] rounded-xl font-black uppercase tracking-widest text-sm hover:bg-[#9ee615] transition-colors shadow-[0_0_20px_rgba(175,255,37,0.3)]">Créer le dossier</button>
            </form>
          </div>
        </div>
      )}

      {targetFolderId && (
        <div className="fixed bottom-[180px] left-0 w-full px-6 z-50 pointer-events-none animate-in slide-in-from-bottom-4">
          <div className="relative w-full max-w-md mx-auto pointer-events-auto bg-[#AFFF25] rounded-2xl p-4 shadow-[0_10px_40px_rgba(175,255,37,0.3)] border border-[#9ee615]">
            <div className="flex justify-between items-center mb-3"><span className="text-[#040221] font-black uppercase tracking-widest text-sm">Cartes pour ce dossier</span><span className="bg-[#040221] text-[#AFFF25] px-3 py-1 rounded-full text-xs font-bold">{selectedForFolder.size} incluse(s)</span></div>
            <div className="flex gap-2"><button onClick={handleCancelSelection} className="flex-1 py-3 border border-[#040221]/20 text-[#040221] font-bold rounded-xl uppercase text-xs active:scale-95 transition-transform">Annuler</button><button onClick={handleConfirmSelection} className="flex-1 py-3 bg-[#040221] text-[#AFFF25] font-bold rounded-xl uppercase text-xs active:scale-95 transition-transform">Confirmer</button></div>
          </div>
        </div>
      )}

      {/* Barre de recherche classique */}
      {activeTab === 'cartes' && !targetFolderId && (
        <FloatingSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      )}
    </div>
  );
}