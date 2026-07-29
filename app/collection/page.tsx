'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Folder, LayoutGrid, Star, ChevronLeft, ChevronDown, Trash2, Loader2, Check, Sparkles, Send, Minus, ScanLine, Share2, Copy, ClipboardList } from 'lucide-react';
import QRCode from "react-qr-code";

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

const SPORT_FOLDERS: Record<string, string> = {
  'SOCCER': 'foot',
  'BASKETBALL': 'NBA',
  'BASEBALL': 'MLB',
  'NFL': 'NFL',
  'NHL': 'NHL'
};

const FOLDER_TYPES = ['Binder', 'Deck', 'Boîte', 'Digital', 'Autre'];

import SET_DATA from '@/data/sets.json';
import TYPE_CARTE from '@/data/type-carte.json';
import COLLECTIONS_CATALOG from '@/data/collections/collections_catalog.json';

type Message = { role: 'user' | 'assistant', content: string };

type Profile = {
  avatar_url: string | null;
  full_name: string | null;
  pseudo: string | null;
};

const slugify = (text: string) => {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const FloatingSearchBar = ({ searchQuery, setSearchQuery }: { searchQuery: string, setSearchQuery: (val: string) => void }) => (
  <div className="fixed bottom-[108px] left-0 w-full px-6 z-40 pointer-events-none lg:hidden">
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

const formatLabel = (str: string) => str.replace(/_/g, ' ').toUpperCase();

export default function CollectionPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'cartes' | 'dossiers' | 'checklist'>('cartes');
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});

  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [selectedForFolder, setSelectedForFolder] = useState<Set<string>>(new Set());

  // const [hasStartedScouty, setHasStartedScouty] = useState(false);
  // const [aiLoading, setAiLoading] = useState(false);
  // const [messages, setMessages] = useState<Message[]>([]);
  // const [chatInput, setChatInput] = useState('');
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Checklist filters
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistType, setChecklistType] = useState<string | null>(null);
  const [checklistBrand, setChecklistBrand] = useState<string | null>(null);

  // Checklist navigation
  const [clView, setClView] = useState<'list' | 'detail'>('list');
  const [clSelected, setClSelected] = useState<any | null>(null);
  const [clDetail, setClDetail] = useState<any | null>(null);
  const [clDetailLoading, setClDetailLoading] = useState(false);
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  // const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      const sportParam = params.get('sport');
      
      const savedFilters = sessionStorage.getItem('cardbulk_collection_filters');
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          if (parsed.activeTab) setActiveTab(parsed.activeTab);
          if (parsed.selectedBrands) setSelectedBrands(parsed.selectedBrands);
          if (parsed.showAuto !== undefined) setShowAuto(parsed.showAuto);
          if (parsed.showPatch !== undefined) setShowPatch(parsed.showPatch);
          if (parsed.showNumbered !== undefined) setShowNumbered(parsed.showNumbered);
          
          if (!searchParam && parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
          if (!sportParam && parsed.selectedSport !== undefined) setSelectedSport(parsed.selectedSport);
        } catch (e) {
          console.error("Erreur lecture filtres", e);
        }
      }

      if (searchParam) setSearchQuery(searchParam);
      if (sportParam) setSelectedSport(sportParam);
    }
    fetchCollection();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const filters = {
        activeTab,
        searchQuery,
        selectedSport,
        selectedBrands,
        showAuto,
        showPatch,
        showNumbered
      };
      sessionStorage.setItem('cardbulk_collection_filters', JSON.stringify(filters));
    }
  }, [activeTab, searchQuery, selectedSport, selectedBrands, showAuto, showPatch, showNumbered]);


  // useEffect(() => {
  //   if (activeTab === 'scouty') {
  //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  //   }
  // }, [messages, aiLoading, activeTab]);

  const fetchCollection = async () => {
    if (typeof window !== 'undefined') {
      const savedCards = localStorage.getItem('cardbulk_offline_cards');
      const savedFolders = localStorage.getItem('cardbulk_offline_folders');
      
      if (savedCards) setCards(JSON.parse(savedCards).filter((c: any) => c.is_wishlist !== true));
      if (savedFolders) setFolders(JSON.parse(savedFolders));
      
      if (savedCards || savedFolders) setLoading(false);
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user && !userError) return router.push('/login');
      if (!user) throw new Error("Pas de réseau ou non connecté");

      const [profileRes, cardsRes, foldersRes] = await Promise.all([
       supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('folders').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      if (!cardsRes.error && cardsRes.data) {
        setCards(cardsRes.data.filter(c => c.is_wishlist !== true));
        localStorage.setItem('cardbulk_offline_cards', JSON.stringify(cardsRes.data));
      }
      if (!foldersRes.error && foldersRes.data) {
        setFolders(foldersRes.data);
        localStorage.setItem('cardbulk_offline_folders', JSON.stringify(foldersRes.data));
      }
    } catch (error) {
      console.log("🌐 Mode hors-ligne activé (ou erreur réseau)");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' && profile?.pseudo 
    ? `${window.location.origin}/collection/${profile.pseudo}`
    : '';

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

  // const handleAskAI = async (questionText: string) => {
  //   if (!questionText.trim()) return;

  //   if (!hasStartedScouty) setHasStartedScouty(true);

  //   const newMessages = [...messages, { role: 'user' as const, content: questionText }];
  //   setMessages(newMessages);
  //   setChatInput('');
  //   setAiLoading(true);

  //   const searchTerm = searchQuery.toLowerCase().trim();
  //   const isGlobal = searchTerm.length === 0;

  //   const cardsToSend = isGlobal ? cards : cards.filter(card => {
  //     const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
  //     const reverseFullName = `${card.lastname || ''} ${card.firstname || ''}`.toLowerCase();
  //     return fullName.includes(searchTerm) || reverseFullName.includes(searchTerm);
  //   });

  //   const formattedCollection = cardsToSend.map(c => ({
  //     joueur: `${c.firstname || ''} ${c.lastname || ''}`.trim(),
  //     sport: c.sport || 'Inconnu',
  //     carte: `${c.brand || 'Inconnu'} ${c.series || ''} ${c.year || ''}`.trim(),
  //     details: [
  //       c.is_numbered ? `Numérotée /${c.numbering_max}` : '',
  //       c.is_auto ? 'Auto' : '',
  //       c.is_patch ? 'Patch' : ''
  //     ].filter(Boolean).join(' - ') || 'Base',
  //     prix_paye: c.purchase_price ? `${c.purchase_price}€` : 'Non renseigné'
  //   }));

  //   try {
  //     const response = await fetch('/api/scout', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ messages: newMessages, playerName: isGlobal ? "Global" : searchQuery, collectionData: formattedCollection }),
  //     });
  //     if (!response.ok) throw new Error('Erreur réseau');
  //     const data = await response.json();
  //     setMessages([...newMessages, { role: 'assistant' as const, content: data.text }]);
  //   } catch (error) {
  //     setMessages([...newMessages, { role: 'assistant' as const, content: "Erreur réseau. Veuillez réessayer plus tard." }]);
  //   } finally {
  //     setAiLoading(false);
  //   }
  // };

  if (loading) return <div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const renderCardsAndFilters = () => {
    const baseCards = activeFolderId ? cards.filter(c => c.folder_id === activeFolderId) : cards;
    const uniqueSports = new Set(baseCards.map(c => c.sport));
    const availableSports = SPORT_ORDER.filter(sportKey => uniqueSports.has(sportKey));
    const hasMultipleSports = availableSports.length > 1;

    const cardsForLogos = selectedSport ? baseCards.filter(c => c.sport === selectedSport) : baseCards;
    const activeClubsMap = new Map();
    const invalidClubs = ['n/a', 'na', 'n-a', 'none', 'inconnu', 'null', 'undefined', '-', 'unknown', ''];

    cardsForLogos.forEach(c => {
      if (c.club_name) {
        const clubLower = c.club_name.toString().toLowerCase().trim();
        if (!invalidClubs.includes(clubLower)) {
          const slug = slugify(c.club_name);
          if (slug && !activeClubsMap.has(slug)) {
            activeClubsMap.set(slug, { name: c.club_name, slug: slug, sportFolder: SPORT_FOLDERS[c.sport] || 'foot' });
          }
        }
      }
    });
    const activeClubs = Array.from(activeClubsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const allJsonBrands = SET_DATA.brands?.map((b: any) => b.name) || [];

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
        {hasMultipleSports && (
          <div className="overflow-x-auto mb-4 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-3 px-6 lg:px-[80px] pb-2 w-max">
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

        <div className={`relative z-50 mb-6 px-6 lg:px-[80px] ${!hasMultipleSports && searchQuery.trim().length === 0 ? 'mt-4' : ''}`}>
          {openDropdown && <div className="fixed inset-0 z-[60] bg-black/20" onClick={() => setOpenDropdown(null)}></div>}
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:w-[60%]">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setOpenDropdown(openDropdown === 'spec' ? null : 'spec')} className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border text-xs lg:text-sm font-bold transition-all relative z-[70] ${showAuto || showPatch || showNumbered ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                  Spécificités <ChevronDown size={14} className={openDropdown === 'spec' ? 'rotate-180' : ''} />
                </button>
                <button onClick={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')} className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border text-xs lg:text-sm font-bold transition-all relative z-[70] ${selectedBrands.length > 0 ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                  {selectedBrands.length > 0 ? `${selectedBrands.length} sél.` : 'Marques'} <ChevronDown size={14} className={openDropdown === 'brand' ? 'rotate-180' : ''} />
                </button>
              </div>

              {openDropdown === 'spec' && (
                <div className="absolute top-full left-0 w-full mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2">
                  {[ { label: 'Autographe', state: showAuto, toggle: () => setShowAuto(!showAuto) }, { label: 'Patch', state: showPatch, toggle: () => setShowPatch(!showPatch) }, { label: 'Numéroté', state: showNumbered, toggle: () => setShowNumbered(!showNumbered) } ].map((item, idx) => (
                    <div key={idx} onClick={item.toggle} className="w-full flex items-center justify-between py-3 cursor-pointer group"><span className={`text-sm font-bold transition-colors ${item.state ? 'text-white' : 'text-white/60'}`}>{item.label}</span><div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${item.state ? 'bg-[#AFFF25]' : 'bg-white/20'}`}><div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${item.state ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div></div></div>
                  ))}
                  <button onClick={() => setOpenDropdown(null)} className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">Confirmer</button>
                </div>
              )}

              {openDropdown === 'brand' && (
                <div className="absolute top-full left-0 w-full mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2 max-h-80 flex flex-col">
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 mb-4">
                    {allJsonBrands.map((brand: string) => {
                      const slug = brand.toLowerCase().replace(/\s+/g, '-'); const isActive = selectedBrands.includes(brand);
                      const toggleBrand = () => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand]);
                      return (<div key={brand} onClick={toggleBrand} className="w-full flex items-center justify-between py-2 cursor-pointer group"><div className="flex items-center gap-4"><img src={`/asset/logo-marque/${slug}.png`} alt={brand} className="h-5 object-contain mix-blend-screen" onError={(e) => e.currentTarget.style.display = 'none'} /><span className={`text-sm font-bold transition-colors ${isActive ? 'text-white' : 'text-white/60'}`}>{brand}</span></div><div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${isActive ? 'bg-[#AFFF25]' : 'bg-white/20'}`}><div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div></div></div>);
                    })}
                  </div>
                  <button onClick={() => setOpenDropdown(null)} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">Confirmer</button>
                </div>
              )}
            </div>

            <div className="hidden lg:block w-full lg:w-[40%] relative z-[70]">
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#040221] border border-white/20 rounded-full py-2.5 pl-5 pr-12 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#AFFF25] transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {searchQuery.length === 0 ? (
                  <Search className="text-[#AFFF25]" size={18} />
                ) : (
                  <button onClick={() => setSearchQuery('')} className="text-red-500 hover:text-red-400 transition-colors flex items-center justify-center p-1"><X size={18} strokeWidth={3} /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeClubs.length > 0 && (
          <div className="mb-6 px-6 lg:px-[80px]">
            <div className="flex gap-5 lg:gap-8 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-2 items-center">
              {activeClubs.map(club => (
                <button 
                  key={club.slug} 
                  onClick={() => router.push(`/club/${club.slug}`)} 
                  className="shrink-0 active:scale-95 transition-transform hover:opacity-80"
                  title={club.name}
                >
                  <img 
                    src={`/asset/logo-club/${club.sportFolder}/${club.slug}.svg`} 
                    alt={club.name} 
                    className="h-[45px] lg:h-[60px] w-auto object-contain drop-shadow-md"
                    onError={(e) => e.currentTarget.style.display = 'none'} 
                  />
                </button>
              ))}
              <div className="w-2 shrink-0"></div>
            </div>
          </div>
        )}

        <div className="px-6 lg:px-[80px] grid grid-cols-3 lg:grid-cols-5 gap-3 pb-[180px] grid-flow-dense auto-rows-max">
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
            cards.length === 0 ? (
              <div className="col-span-3 lg:col-span-5 flex flex-col items-center justify-center py-20 px-4 gap-6">
                <div className="text-white/40 italic font-bold text-center">Aucune carte dans ta collection</div>
                <button 
                  onClick={() => router.push('/scanner')} 
                  className="bg-[#AFFF25] text-[#040221] px-6 py-4 rounded-full font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-[0_0_20px_rgba(175,255,37,0.3)] flex items-center gap-2"
                >
                  <ScanLine size={18} strokeWidth={2.5} /> Scanner ma première carte
                </button>
              </div>
            ) : (
              <div className="col-span-3 lg:col-span-5 text-center py-10 text-white/40 italic">Aucune carte ne correspond aux critères.</div>
            )
          )}
        </div>
      </div>
    );
  };

  const openCollection = async (col: any) => {
    setClSelected(col);
    setClView('detail');
    setClDetail(null);
    setClDetailLoading(true);
    try {
      // Check localStorage for manually uploaded data
      const localKey = `checklist_override_${col.folder}`;
      const localData = typeof window !== 'undefined' ? localStorage.getItem(localKey) : null;
      if (localData) {
        setClDetail(JSON.parse(localData));
        setClDetailLoading(false);
        return;
      }
      const res = await fetch(`/api/collection?folder=${encodeURIComponent(col.folder)}`);
      if (res.ok) setClDetail(await res.json());
    } catch {}
    setClDetailLoading(false);
  };

  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clSelected) return;
    setXlsxUploading(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const sheetCategoryMap: Record<string, string> = {
        'Base': 'BASE', 'Autographs': 'AUTOGRAPH', 'Autograph': 'AUTOGRAPH',
        'Inserts': 'INSERT', 'Insert': 'INSERT',
        'Memorabilia': 'RELIC', 'Relics': 'RELIC', 'Relic': 'RELIC',
      };

      const subsets: any[] = [];
      for (const sheetName of wb.SheetNames) {
        const category = sheetCategoryMap[sheetName] || sheetName.toUpperCase();
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[][];

        let currentSection: string | null = null;
        let currentParallels: string[] = [];
        let currentPlayers: { name: string; club: string }[] = [];
        let inParallels = false;
        let cardCount: number | null = null;

        const flush = () => {
          if (currentSection && currentPlayers.length > 0) {
            subsets.push({ subset: category, section: currentSection, card_count: cardCount, parallels: [...currentParallels], players: [...currentPlayers] });
          }
          currentSection = null; currentParallels = []; currentPlayers = []; inParallels = false; cardCount = null;
        };

        for (const row of rows) {
          if (!row || row.length === 0) continue;
          const c0 = String(row[0] ?? '').trim();
          const c1 = String(row[1] ?? '').trim();
          if (row.length >= 2 && c1 && c0.endsWith(',')) {
            if (!inParallels) currentPlayers.push({ name: c0.slice(0, -1).trim(), club: c1 });
            continue;
          }
          if (/^\d+ cards?$/i.test(c0)) { cardCount = parseInt(c0); inParallels = false; continue; }
          if (c0.toLowerCase() === 'parallels') { inParallels = true; continue; }
          if (inParallels && /\/\d+/.test(c0)) { currentParallels.push(c0); continue; }
          if (c0 && row.length === 1 && !/^\d/.test(c0)) { flush(); currentSection = c0; inParallels = false; }
        }
        flush();
      }

      if (subsets.length === 0) {
        alert('Aucune donnée trouvée dans ce fichier. Vérifie que le format est correct (colonnes Nom, Club).');
        return;
      }

      const existing = clDetail || {};
      const updated = { ...existing, subsets, xlsx_parsed: true, xlsx_source: 'manual' };
      const localKey = `checklist_override_${clSelected.folder}`;
      localStorage.setItem(localKey, JSON.stringify(updated));
      setClDetail(updated);
    } catch (err) {
      alert('Erreur lors du parsing du fichier XLSX.');
      console.error(err);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    }
  };

  const CAT_COLORS: Record<string, string> = {
    'BASE':        '#AFFF25',
    'INSERT':      '#34d399',
    'PARALLEL':    '#60a5fa',
    'AUTOGRAPH':   '#f59e0b',
    'RELIC':       '#a78bfa',
    'MEMORABILIA': '#a78bfa',
    'OR':          '#fbbf24',
    'SPECIAL':     '#f43f5e',
  };

  const getMainCat = (cardType: string): string => {
    const u = cardType.toUpperCase();
    if (u.startsWith('BASE')) return 'BASE';
    if (u.startsWith('INSERT') || u.includes('SPECIAL INSERT')) return 'INSERT';
    if (u.startsWith('AUTOGRAPH')) return 'AUTOGRAPH';
    if (u.startsWith('RELIC')) return 'RELIC';
    if (u.startsWith('MEMORABILIA')) return 'MEMORABILIA';
    if (u.startsWith('PARALLEL') || u.startsWith('REFRACTOR')) return 'PARALLEL';
    if (u.startsWith('OR ') || u === 'OR') return 'OR';
    return 'SPECIAL';
  };

  const renderChecklist = () => {
    const catalog = COLLECTIONS_CATALOG as any[];

    // ── Vue détail ──────────────────────────────────────────────────────────
    if (clView === 'detail' && clSelected) {
      const cardTypes: string[] = clSelected.card_types || [];

      // Grouper par catégorie principale
      const CAT_ORDER = ['BASE', 'INSERT', 'PARALLEL', 'AUTOGRAPH', 'RELIC', 'MEMORABILIA', 'OR', 'SPECIAL'];
      const grouped: Record<string, string[]> = {};
      CAT_ORDER.forEach(c => { grouped[c] = []; });
      cardTypes.forEach(ct => { grouped[getMainCat(ct)].push(ct); });

      // Subsets depuis collection.json (si chargés)
      const subsets: any[] = clDetail?.subsets || [];
      const fiche: any = clDetail?.fiche || null;
      const subsetCats = Array.from(new Set(subsets.map((s: any) => s.subset)));

      const publisherSlug = (clSelected.publisher || '').toLowerCase().replace(/\s+/g, '-');

      return (
        <div className="w-full animate-in fade-in duration-300 pb-[180px]">
          {/* Header */}
          <div className="px-6 lg:px-[80px] flex items-center gap-4 mb-6">
            <button onClick={() => { setClView('list'); setClSelected(null); setClDetail(null); }} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0">
              <ChevronLeft size={20} />
            </button>
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-2 mb-1">
                <img src={`/asset/logo-marque/${publisherSlug}.png`} alt={clSelected.publisher} className="h-4 object-contain mix-blend-screen" onError={e => e.currentTarget.style.display = 'none'} />
                <span className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">{clSelected.publisher} · {clSelected.year}</span>
                {clDetail?.xlsx_source === 'manual' && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#AFFF25]/10 text-[#AFFF25] border border-[#AFFF25]/20 font-bold">LOCAL</span>
                )}
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-tight text-white leading-tight truncate">{clSelected.serie}</h2>
            </div>
            {/* Upload XLSX button */}
            <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleXlsxUpload} />
            <button
              onClick={() => xlsxInputRef.current?.click()}
              disabled={xlsxUploading}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#AFFF25]/40 hover:bg-[#AFFF25]/5 transition-all active:scale-95 disabled:opacity-50"
              title="Importer un fichier XLSX"
            >
              {xlsxUploading ? <Loader2 size={15} className="animate-spin text-[#AFFF25]" /> : <Plus size={15} className="text-[#AFFF25]" />}
              <span className="text-xs font-bold text-white/70">XLSX</span>
            </button>
            {clDetail?.xlsx_source === 'manual' && (
              <button
                onClick={() => {
                  if (!clSelected) return;
                  localStorage.removeItem(`checklist_override_${clSelected.folder}`);
                  openCollection(clSelected);
                }}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-red-500/40 hover:bg-red-500/5 transition-all active:scale-95"
                title="Supprimer les données locales"
              >
                <Trash2 size={13} className="text-red-400" />
              </button>
            )}
          </div>

          {/* Fiche technique */}
          {fiche && (
            <div className="mx-6 lg:mx-[80px] mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
              {fiche.contenu_global && <p className="text-xs text-white/60 leading-relaxed">{fiche.contenu_global}</p>}
              {fiche.dotation_boite && <p className="text-xs text-white/40 leading-relaxed italic">{fiche.dotation_boite}</p>}
            </div>
          )}

          {clDetailLoading && (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#AFFF25]" size={28} /></div>
          )}

          {/* Subsets avec joueurs */}
          {!clDetail?.xlsx_parsed && !clDetailLoading && (
            <div className="mx-6 lg:mx-[80px] mb-4 px-4 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#f59e0b] text-xs font-bold shrink-0">⚠ Pas de checklist</span>
                <span className="text-white/40 text-xs truncate">Dépose un fichier XLSX Beckett pour voir les joueurs.</span>
              </div>
              <button onClick={() => xlsxInputRef.current?.click()} className="shrink-0 text-xs font-bold text-[#AFFF25] hover:underline whitespace-nowrap">+ Importer</button>
            </div>
          )}
          {subsets.length > 0 ? (
            <div className="px-6 lg:px-[80px] space-y-8">
              {subsetCats.map(cat => {
                const color = CAT_COLORS[cat] || '#ffffff';
                const items = subsets.filter((s: any) => s.subset === cat);
                const totalPlayers = items.reduce((acc: number, s: any) => acc + (s.players?.length || 0), 0);
                return (
                  <div key={cat}>
                    {/* Header catégorie */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: color + '30' }} />
                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{cat}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: color + '15', color }}>
                        {totalPlayers > 0 ? `${totalPlayers} joueurs` : `${items.length} sets`}
                      </span>
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: color + '30' }} />
                    </div>

                    <div className="space-y-4">
                      {items.map((s: any, idx: number) => {
                        const hasPlayers = s.players && s.players.length > 0;
                        const hasContent = hasPlayers || (s.parallels && s.parallels.length > 0) || s.description;
                        if (!hasContent) return null;
                        return (
                          <div key={idx} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                            {/* Header section */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]" style={{ backgroundColor: color + '08' }}>
                              <span className="text-sm font-black text-white italic uppercase tracking-tight">{s.section}</span>
                              <div className="flex items-center gap-2">
                                {s.card_count && <span className="text-[10px] text-white/40">{s.card_count} cartes</span>}
                                {hasPlayers && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: color + '15', color }}>{s.players.length}</span>}
                              </div>
                            </div>

                            {/* Parallels */}
                            {s.parallels && s.parallels.length > 0 && (
                              <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-white/[0.04]">
                                {s.parallels.map((p: string, pi: number) => (
                                  <span key={pi} className="text-[9px] px-2 py-0.5 rounded-full bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20 font-bold">{p}</span>
                                ))}
                              </div>
                            )}

                            {/* Players */}
                            {hasPlayers && (
                              <div className="divide-y divide-white/[0.04]">
                                {s.players.map((p: any, pi: number) => (
                                  <div key={pi} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[9px] text-white/20 font-mono w-5 shrink-0 text-right">{pi + 1}</span>
                                      <span className="text-sm font-bold text-white">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                      <span className="text-xs text-white/40 truncate max-w-[120px] hidden sm:block">{p.club}</span>
                                      <img
                                        src={`/asset/logo-club/foot/${slugify(p.club)}.svg`}
                                        alt={p.club}
                                        className="h-5 w-5 object-contain opacity-60"
                                        onError={e => (e.currentTarget.style.display = 'none')}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {!hasPlayers && s.description && (
                              <p className="px-4 py-3 text-xs text-white/40 italic">{s.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !clDetailLoading && (
            /* Fallback : card_types depuis le catalog */
            <div className="px-6 lg:px-[80px] space-y-6">
              {CAT_ORDER.filter(cat => grouped[cat].length > 0).map(cat => {
                const color = CAT_COLORS[cat] || '#ffffff';
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: color + '30' }} />
                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{cat}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: color + '15', color }}>{grouped[cat].length}</span>
                      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: color + '30' }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {grouped[cat].map((ct: string, idx: number) => {
                        const sub = ct.includes('/') ? ct.split('/').slice(1).join('/').trim() : ct;
                        return (
                          <span key={idx} className="text-xs px-3 py-1.5 rounded-full border font-medium" style={{ borderColor: color + '30', color: color + 'cc', backgroundColor: color + '08' }}>
                            {sub}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {cardTypes.length === 0 && (
                <div className="text-center py-12 text-white/30 italic text-sm">Aucune donnée disponible pour cette collection.</div>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── Vue liste ───────────────────────────────────────────────────────────
    const publishers = Array.from(new Set(catalog.map(c => c.publisher).filter(Boolean))).sort() as string[];
    const years = Array.from(new Set(catalog.map(c => c.year).filter(Boolean))).sort((a: any, b: any) => b - a) as number[];

    const filtered = (catalog as any[]).filter(col => {
      const term = checklistSearch.toLowerCase().trim();
      const searchMatch = !term || col.serie?.toLowerCase().includes(term) || col.publisher?.toLowerCase().includes(term) || String(col.year).includes(term);
      const pubMatch = !checklistBrand || col.publisher === checklistBrand;
      const yearMatch = !checklistType || String(col.year) === checklistType;
      return searchMatch && pubMatch && yearMatch;
    }).sort((a: any, b: any) => (b.year || 0) - (a.year || 0));

    return (
      <div className="w-full animate-in fade-in duration-300">
        {/* Recherche */}
        <div className="px-6 lg:px-[80px] mb-4 mt-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher une collection..."
              value={checklistSearch}
              onChange={e => setChecklistSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#AFFF25] transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {checklistSearch ? <button onClick={() => setChecklistSearch('')} className="text-red-500"><X size={16} /></button> : <Search size={16} className="text-[#AFFF25]" />}
            </div>
          </div>
        </div>

        {/* Filtre publisher */}
        <div className="overflow-x-auto mb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-2 px-6 lg:px-[80px] pb-1 w-max">
            <button onClick={() => setChecklistBrand(null)} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${!checklistBrand ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white/60'}`}>Tous</button>
            {publishers.map(pub => {
              const slug = pub.toLowerCase().replace(/\s+/g, '-');
              return (
                <button key={pub} onClick={() => setChecklistBrand(checklistBrand === pub ? null : pub)} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-2 ${checklistBrand === pub ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/60'}`}>
                  <img src={`/asset/logo-marque/${slug}.png`} alt={pub} className="h-3.5 object-contain mix-blend-screen" onError={e => e.currentTarget.style.display = 'none'} />
                  {pub}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtre année */}
        <div className="overflow-x-auto mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-2 px-6 lg:px-[80px] pb-1 w-max">
            <button onClick={() => setChecklistType(null)} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${!checklistType ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>Toutes années</button>
            {years.slice(0, 6).map(y => (
              <button key={y} onClick={() => setChecklistType(checklistType === String(y) ? null : String(y))} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${checklistType === String(y) ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>{y}</button>
            ))}
          </div>
        </div>

        {/* Compteur */}
        <div className="px-6 lg:px-[80px] mb-3">
          <span className="text-xs text-white/30">{filtered.length} collection{filtered.length > 1 ? 's' : ''}</span>
        </div>

        {/* Liste collections */}
        <div className="px-6 lg:px-[80px] space-y-2 pb-[180px]">
          {filtered.map((col: any) => {
            const publisherSlug = (col.publisher || '').toLowerCase().replace(/\s+/g, '-');
            const hasAuto = col.card_types?.some((ct: string) => ct.toUpperCase().startsWith('AUTOGRAPH'));
            const hasRelic = col.card_types?.some((ct: string) => ct.toUpperCase().startsWith('RELIC') || ct.toUpperCase().startsWith('MEMORABILIA'));
            return (
              <div
                key={col.folder}
                onClick={() => openCollection(col)}
                className="flex items-center justify-between px-4 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] active:scale-[0.99] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <img src={`/asset/logo-marque/${publisherSlug}.png`} alt={col.publisher} className="h-7 w-7 object-contain mix-blend-screen shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" onError={e => e.currentTarget.style.display = 'none'} />
                  <div className="overflow-hidden">
                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-0.5">{col.publisher} · {col.year}</div>
                    <div className="text-sm font-black text-white italic uppercase tracking-tight truncate">{col.serie}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  {hasAuto && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20 font-bold">AUTO</span>}
                  {hasRelic && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/20 font-bold">RELIC</span>}
                  <ChevronLeft size={14} className="text-white/20 rotate-180" />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-20 text-white/30 italic text-sm">Aucune collection trouvée.</div>
          )}
        </div>
      </div>
    );
  };

  if (activeFolderId && currentFolder) {
    return (
      <div className="min-h-screen bg-[#040221] text-white font-sans pb-32 animate-in slide-in-from-right-8 duration-300">
        <div className="pt-[calc(2rem+env(safe-area-inset-top))] pb-4 px-6 lg:px-[80px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <button onClick={() => setActiveFolderId(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"><ChevronLeft size={20} /></button>
            <div className="overflow-hidden"><div className="text-xs text-[#AFFF25] font-bold uppercase tracking-widest">{currentFolder.type}</div><h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none truncate">{currentFolder.name}</h1></div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => toggleFolderFavorite(currentFolder.id)} className="p-2 active:scale-90 transition-transform"><Star size={24} strokeWidth={currentFolder.is_favorite ? 0 : 2} className={currentFolder.is_favorite ? "text-[#AFFF25] fill-[#AFFF25]" : "text-white/40 hover:text-white"} /></button>
            <button onClick={() => deleteFolder(currentFolder.id)} className="p-2 active:scale-90 transition-transform text-red-500/80 hover:text-red-500"><Trash2 size={24} strokeWidth={1.5} /></button>
          </div>
        </div>
        <div className="px-6 lg:px-[80px] pb-4">
          <button onClick={handleStartSelection} className="w-full py-3.5 border border-dashed border-[#AFFF25]/50 text-[#AFFF25] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#AFFF25]/10 active:scale-[0.98] transition-all"><Plus size={18} /> Gérer les cartes du dossier</button>
        </div>
        {renderCardsAndFilters()}
        <FloatingSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans relative overflow-hidden w-full">
      
      {/* 🌟 MODALE DE PARTAGE */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setShowShareModal(false)}>
          <div className="bg-[#080531] border border-white/10 rounded-3xl p-8 w-full max-w-md relative shadow-[0_0_60px_rgba(175,255,37,0.1)]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowShareModal(false)} className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={20} /></button>
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-[#AFFF25]/10 border border-[#AFFF25]/30 flex items-center justify-center text-[#AFFF25] mb-4">
                <Share2 size={32} />
              </div>
              <h2 className="text-2xl font-black italic uppercase tracking-tight text-white">Partager ma Vitrine</h2>
              <p className="text-sm text-white/60 mt-2">Masque automatiquement vos prix d'achat et infos eBay.</p>
            </div>

            {profile?.pseudo ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl flex justify-center shadow-inner">
                  <QRCode value={shareUrl} size={180} bgColor="#ffffff" fgColor="#080531" level="H" />
                </div>

                <div className="relative">
                  <input type="text" readOnly value={shareUrl} className="w-full bg-black/30 border border-white/10 p-4 pr-14 rounded-xl text-xs text-white/80 font-mono tracking-tight" />
                  <button onClick={copyLink} className="absolute right-2 top-2 bottom-2 px-3 bg-[#AFFF25] text-[#040221] rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 active:scale-95 transition-all">
                    {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                    {linkCopied ? 'Copié' : 'Copier'}
                  </button>
                </div>
                
                <p className="text-[10px] text-white/40 text-center italic">Scanner le QR Code ou copier le lien pour partager via mobile ou réseaux.</p>
              </div>
            ) : (
              <div className="text-center py-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm p-4">
                <strong>Erreur :</strong> Vous devez définir un <u>pseudo unique</u> dans vos paramètres avant de pouvoir partager votre collection.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-[calc(2rem+env(safe-area-inset-top))] pb-4 shrink-0 z-10 relative bg-[#040221] w-full">
        
        {/* 🌟 HEADER AVEC BOUTON PARTAGE */}
        <div className="flex justify-between items-center px-6 mb-6">
           <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">{targetFolderId ? "Sélection" : "Collection"}</h1>
           {!targetFolderId && (
             <button onClick={() => setShowShareModal(true)} className="w-10 h-10 bg-[#AFFF25]/10 border border-[#AFFF25]/30 rounded-full flex items-center justify-center text-[#AFFF25] hover:bg-[#AFFF25]/20 active:scale-95 transition-all">
               <Share2 size={18} />
             </button>
           )}
        </div>

        {!targetFolderId && (
          <div className="flex justify-center px-6 gap-6 mb-4">
            <button onClick={() => setActiveTab('cartes')} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'cartes' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>Cartes{activeTab === 'cartes' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}</button>

            <button onClick={() => { setActiveTab('dossiers'); setSearchQuery(''); }} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative ${activeTab === 'dossiers' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>Dossiers{activeTab === 'dossiers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}</button>

            <button onClick={() => { setActiveTab('checklist'); setSearchQuery(''); }} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative flex items-center gap-1.5 ${activeTab === 'checklist' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}><ClipboardList size={14} />Checklist{activeTab === 'checklist' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}</button>
            
            {/* <button onClick={() => setActiveTab('scouty')} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative flex items-center gap-1.5 ${activeTab === 'scouty' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>
              <Sparkles size={14} className={activeTab === 'scouty' ? "text-[#AFFF25]" : "text-white/40"} /> Scouty
              {activeTab === 'scouty' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}
            </button> */}
          </div>
        )}
      </div>

      <div className="relative h-[calc(100vh-140px)] overflow-y-auto pb-32">
        
        {activeTab === 'cartes' && renderCardsAndFilters()}

        {activeTab === 'checklist' && renderChecklist()}

        {activeTab === 'dossiers' && !targetFolderId && (
          <div className="animate-in fade-in duration-300 w-full">
            <div className="px-6 lg:px-[80px] flex justify-between items-center mb-4 mt-2"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Star size={18} className="text-[#AFFF25] fill-[#AFFF25]" /> Favoris</h2><button onClick={() => setIsModalOpen(true)} className="w-8 h-8 rounded-full bg-[#AFFF25]/20 text-[#AFFF25] flex items-center justify-center hover:bg-[#AFFF25]/30 transition-colors"><Plus size={18} /></button></div>
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mb-10">
              <div className="flex gap-4 px-6 lg:px-[80px] pb-4 w-max">
                {favoriteFolders.map(folder => (<div key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="w-[180px] h-[180px] rounded-[24px] p-5 border border-white/10 bg-gradient-to-br from-white/10 to-white/5 flex flex-col justify-between relative group cursor-pointer active:scale-95 transition-transform"><div className="w-12 h-12 rounded-full bg-[#AFFF25]/10 flex items-center justify-center border border-[#AFFF25]/20"><Folder size={24} className="text-[#AFFF25]" /></div><div><div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">{folder.type}</div><div className="text-xl font-black text-white leading-tight mb-1">{folder.name}</div><div className="text-xs text-[#AFFF25] font-medium">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div></div></div>))}
                {favoriteFolders.length === 0 && <div className="text-white/40 text-sm italic py-8">Aucun dossier favori.</div>}
                <div className="w-2 shrink-0"></div>
              </div>
            </div>
            <div className="px-6 lg:px-[80px] flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-white">Tous les dossiers</h2><button onClick={() => setIsModalOpen(true)} className="text-[#AFFF25] p-2 active:scale-90 transition-transform"><Plus size={20} /></button></div>
            <div className="px-6 lg:px-[80px] grid grid-cols-1 lg:grid-cols-4 gap-3 pb-[180px]">
              {otherFolders.map(folder => (<div key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="w-full flex items-center justify-between p-4 rounded-[20px] border border-white/10 bg-white/5 cursor-pointer active:scale-95 transition-transform hover:bg-white/10"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Folder size={20} className="text-white/60" /></div><div><div className="text-base font-bold text-white leading-tight">{folder.name}</div><div className="text-xs text-[#AFFF25] mt-0.5">{getFolderCardCount(folder.id)} carte{getFolderCardCount(folder.id) > 1 ? 's' : ''}</div></div></div><span className="text-[10px] px-3 py-1 rounded-full bg-white/10 text-white/60 font-bold uppercase tracking-widest">{folder.type}</span></div>))}
              {otherFolders.length === 0 && <div className="text-white/40 text-sm italic">Aucun autre dossier.</div>}
            </div>
          </div>
        )}

        {/* activeTab === 'scouty' && (
          <div className="px-6 flex flex-col h-full relative animate-in fade-in duration-300 lg:max-w-2xl lg:mx-auto">
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
                  <div className="flex gap-2 lg:max-w-2xl lg:mx-auto">
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
        ) */}

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

      {activeTab === 'cartes' && !targetFolderId && (
        <FloatingSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      )}
    </div>
  );
}