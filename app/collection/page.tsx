'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Folder, LayoutGrid, Star, ChevronLeft, ChevronDown, Trash2, Loader2, Check, Sparkles, Send, Minus, ScanLine, Share2, Copy } from 'lucide-react';
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

import SET_DATA from '@/data/set.json';
import TYPE_CARTE from '@/data/type-carte.json';

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
  
  const [activeTab, setActiveTab] = useState<'cartes' | 'dossiers' | 'scouty'>('cartes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]); 
  
  const [showAuto, setShowAuto] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [showNumbered, setShowNumbered] = useState(false);
  
  const [openDropdown, setOpenDropdown] = useState<'brand' | 'spec' | 'variations' | null>(null);
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

  const [hasStartedScouty, setHasStartedScouty] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [expandedVars, setExpandedVars] = useState<Record<string, boolean>>({ base: true });

  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          if (parsed.selectedVariations) setSelectedVariations(parsed.selectedVariations);
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
        selectedVariations,
        showAuto,
        showPatch,
        showNumbered
      };
      sessionStorage.setItem('cardbulk_collection_filters', JSON.stringify(filters));
    }
  }, [activeTab, searchQuery, selectedSport, selectedBrands, selectedVariations, showAuto, showPatch, showNumbered]);


  useEffect(() => {
    if (activeTab === 'scouty') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, aiLoading, activeTab]);

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
        body: JSON.stringify({ messages: newMessages, playerName: isGlobal ? "Global" : searchQuery, collectionData: formattedCollection }),
      });
      if (!response.ok) throw new Error('Erreur réseau');
      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant' as const, content: data.text }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant' as const, content: "Erreur réseau. Veuillez réessayer plus tard." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleVarNode = (node: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedVars(prev => ({ ...prev, [node]: !prev[node] }));
  };

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
    
    // 1. On récupère toutes les variations RÉELLEMENT présentes dans tes cartes affichées
    const activeVariations = new Set(
      baseCards
        .filter(c => (!selectedSport || c.sport === selectedSport) && (selectedBrands.length === 0 || selectedBrands.includes(c.brand)))
        .map(c => c.variation)
        .filter(Boolean)
    );

    let variationsTree: any = {};
    const brandsToUse = selectedBrands.length > 0 ? selectedBrands : Object.keys(TYPE_CARTE);
    
    brandsToUse.forEach(brand => {
      // On gère les espaces et les underscores pour que "Upper Deck" matche bien
      const normalizedKey = brand.replace(/\s+/g, '_');
      const brandData = (TYPE_CARTE as any)[brand] || (TYPE_CARTE as any)[normalizedKey];
      if(!brandData) return;

      Object.keys(brandData).forEach(catKey => {
        const variations = brandData[catKey];
        if (Array.isArray(variations)) {
          variations.forEach((v: any) => {
            const varName = v.variation_name || v;
            // 💡 On ajoute au menu UNIQUEMENT si tu possèdes la carte !
            if (activeVariations.has(varName)) {
              if (!variationsTree[catKey]) variationsTree[catKey] = [];
              variationsTree[catKey].push(varName);
              activeVariations.delete(varName); // On l'enlève du Set pour voir ce qu'il reste
            }
          });
        }
      });
    });

    // 💡 MAGIQUE : Toutes les couleurs/numérotations générées par l'IA ("Red /50") 
    // qui ne sont pas dans le JSON vont dans une catégorie automatique à la fin du filtre !
    if (activeVariations.size > 0) {
      variationsTree["Couleurs & Numérotées (IA)"] = Array.from(activeVariations);
    }

    // On trie par ordre alphabétique pour que ce soit beau
    Object.keys(variationsTree).forEach(key => {
      variationsTree[key] = Array.from(new Set(variationsTree[key])).sort();
    });

    const filteredCards = baseCards.filter(card => {
      const searchTerm = searchQuery.toLowerCase().trim();
      const fullName = `${card.firstname || ''} ${card.lastname || ''}`.toLowerCase();
      const reverseFullName = `${card.lastname || ''} ${card.firstname || ''}`.toLowerCase();
      
      const searchMatch = !searchQuery || fullName.includes(searchTerm) || reverseFullName.includes(searchTerm) || card.club_name?.toLowerCase().includes(searchTerm);
      const sportMatch = !selectedSport || card.sport === selectedSport;
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(card.brand);
      const variationMatch = selectedVariations.length === 0 || selectedVariations.includes(card.variation);
      const autoMatch = !showAuto || card.is_auto;
      const patchMatch = !showPatch || card.is_patch;
      const numberedMatch = !showNumbered || card.is_numbered;
      
      return searchMatch && sportMatch && brandMatch && variationMatch && autoMatch && patchMatch && numberedMatch;
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
                <button onClick={() => setOpenDropdown(openDropdown === 'variations' ? null : 'variations')} className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border text-xs lg:text-sm font-bold transition-all relative z-[70] ${selectedVariations.length > 0 ? 'bg-[#AFFF25]/10 border-[#AFFF25] text-[#AFFF25]' : 'bg-white/5 border-white/10 text-white'}`}>
                  {selectedVariations.length > 0 ? `${selectedVariations.length} sél.` : 'Variations'} <ChevronDown size={14} className={openDropdown === 'variations' ? 'rotate-180' : ''} />
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

              {openDropdown === 'variations' && (
                <div className="absolute top-full left-0 w-full mt-2 z-[70] bg-[#040221] border border-white/10 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2 max-h-96 flex flex-col">
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4 pr-2">
                    {Object.keys(variationsTree).map(catKey => {
                      const isArray = Array.isArray(variationsTree[catKey]);
                      return (
                        <div key={catKey} className="w-full">
                          <div className="flex justify-between items-center py-2 border-b border-white/10 cursor-pointer" onClick={(e) => toggleVarNode(catKey, e)}>
                            <span className="font-black text-[#AFFF25] uppercase text-xs tracking-widest">{formatLabel(catKey)}</span>
                            {expandedVars[catKey] ? <Minus size={14} className="text-[#AFFF25]"/> : <Plus size={14} className="text-[#AFFF25]"/>}
                          </div>
                          
                          {expandedVars[catKey] && (
                            <div className="pl-3 mt-2 space-y-2 border-l-2 border-white/10 ml-1">
                              {isArray ? (
                                Array.from(new Set(variationsTree[catKey])).sort().map((variation: any) => {
                                  const isActive = selectedVariations.includes(variation);
                                  const toggleVariation = (e: any) => { e.stopPropagation(); setSelectedVariations(prev => isActive ? prev.filter(s => s !== variation) : [...prev, variation]); };
                                  return (
                                    <div key={variation} onClick={toggleVariation} className="flex items-center justify-between py-1.5 cursor-pointer group">
                                      <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-white/60'} truncate pr-4`}>{variation}</span>
                                      <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors shrink-0 ${isActive ? 'bg-[#AFFF25]' : 'bg-white/20'}`}>
                                        <div className={`w-3 h-3 rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div>
                                      </div>
                                    </div>
                                  )
                                })
                              ) : (
                                Object.keys(variationsTree[catKey]).map(subKey => {
                                  const subNodeKey = `${catKey}-${subKey}`;
                                  return (
                                    <div key={subKey} className="w-full mb-2">
                                      <div className="flex justify-between items-center py-1.5 cursor-pointer" onClick={(e) => toggleVarNode(subNodeKey, e)}>
                                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">{formatLabel(subKey)}</span>
                                        {expandedVars[subNodeKey] ? <Minus size={12} className="text-white/40"/> : <Plus size={12} className="text-white/40"/>}
                                      </div>
                                      
                                      {expandedVars[subNodeKey] && (
                                        <div className="pl-3 mt-1 space-y-1 border-l-2 border-white/5 ml-1">
                                          {Array.from(new Set(variationsTree[catKey][subKey])).sort().map((variation: any) => {
                                            const isActive = selectedVariations.includes(variation);
                                            const toggleVariation = (e: any) => { e.stopPropagation(); setSelectedVariations(prev => isActive ? prev.filter(s => s !== variation) : [...prev, variation]); };
                                            return (
                                              <div key={variation} onClick={toggleVariation} className="flex items-center justify-between py-1.5 cursor-pointer group">
                                                <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-white/60'} truncate pr-4`}>{variation}</span>
                                                <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors shrink-0 ${isActive ? 'bg-[#AFFF25]' : 'bg-white/20'}`}>
                                                  <div className={`w-3 h-3 rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-4 bg-[#040221]' : 'translate-x-0 bg-white'}`}></div>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <button onClick={() => setOpenDropdown(null)} className="w-full py-3 bg-[#AFFF25] text-[#040221] rounded-xl text-xs font-black uppercase tracking-widest transition-transform active:scale-95 shadow-[0_0_15px_rgba(175,255,37,0.3)]">Appliquer Filtres</button>
                  </div>
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
            
            <button onClick={() => setActiveTab('scouty')} className={`pb-2 font-bold tracking-wide uppercase text-sm transition-colors relative flex items-center gap-1.5 ${activeTab === 'scouty' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>
              <Sparkles size={14} className={activeTab === 'scouty' ? "text-[#AFFF25]" : "text-white/40"} /> Scouty
              {activeTab === 'scouty' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25] shadow-[0_0_8px_rgba(175,255,37,0.5)]"></div>}
            </button>
          </div>
        )}
      </div>

      <div className="relative h-[calc(100vh-140px)] overflow-y-auto pb-32">
        
        {activeTab === 'cartes' && renderCardsAndFilters()}

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

        {activeTab === 'scouty' && (
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

      {activeTab === 'cartes' && !targetFolderId && (
        <FloatingSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      )}
    </div>
  );
}