'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus, Trash2, RotateCw, Link as LinkIcon } from 'lucide-react';
import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import SET_DATA from '@/data/set.json';

const SPORT_CONFIG: Record<string, { image: string, jsonKey: string, label: string }> = {
  'SOCCER': { image: 'Soccer', jsonKey: 'football_soccer', label: 'Football (Soccer)' },
  'BASKETBALL': { image: 'Basket', jsonKey: 'basketball', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', jsonKey: 'baseball', label: 'Baseball' },
  'F1': { image: 'F1', jsonKey: 'f1', label: 'Formule 1' },
  'NFL': { image: 'NFL', jsonKey: 'nfl', label: 'Football Américain (NFL)' },
  'NHL': { image: 'NHL', jsonKey: 'nhl', label: 'Hockey (NHL)' },
  'TENNIS': { image: 'Tennis', jsonKey: 'tennis', label: 'Tennis' }
};

export default function ScannerPage() { 
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#040221] flex items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>}>
      <ScannerContent />
    </Suspense>
  ); 
}

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); 
  const [isWishlistMode, setIsWishlistMode] = useState(searchParams.get('wishlist') === 'true');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isFetchingEdit, setIsFetchingEdit] = useState(!!editId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [isJoueurOpen, setIsJoueurOpen] = useState(true);
  const [isCarteOpen, setIsCarteOpen] = useState(true);

  const [formData, setFormData] = useState({ sport: '', firstname: '', lastname: '', club: '', brand: '', series: '', year: '', is_auto: false, is_patch: false, is_rookie: false, is_numbered: false, num_low: '', num_high: '', price: '', website_url: '' });
  const yearsList = Array.from({ length: 2027 - 1994 + 1 }, (_, i) => 2027 - i);

  useEffect(() => {
    if (editId) {
      setIsFetchingEdit(true);
      const fetchCardForEdit = async () => {
        const { data } = await supabase.from('cards').select('*').eq('id', editId).single();
        if (data) {
          setIsWishlistMode(data.is_wishlist || false);
          setFormData({ sport: data.sport || '', firstname: data.firstname || '', lastname: data.lastname || '', club: data.club_name || '', brand: data.brand || '', series: data.series || '', year: data.year?.toString() || '', is_auto: data.is_auto || false, is_patch: data.is_patch || false, is_rookie: data.is_rookie || false, is_numbered: data.is_numbered || false, num_low: data.numbering_low?.toString() || '', num_high: data.numbering_max?.toString() || '', price: data.purchase_price?.toString() || '', website_url: data.website_url || '' });
          setPreviewUrl(data.image_url);
        }
        setIsFetchingEdit(false);
      };
      fetchCardForEdit();
    }
  }, [editId]);

  const safeFootballClubs = Array.isArray(FOOTBALL_CLUBS) ? FOOTBALL_CLUBS : [];
  const searchStr = formData.club.toLowerCase();
  const filteredClubs = safeFootballClubs.filter((c: any) => c.name?.toLowerCase().includes(searchStr) || c.slug?.toLowerCase().includes(searchStr))
    .sort((a: any, b: any) => {
      if (a.name.toLowerCase().startsWith(searchStr)) return -1;
      return 1;
    });

  const selectedClub = filteredClubs[0];
  const clubSlug = selectedClub ? selectedClub.slug : formData.club.toLowerCase().replace(/\s+/g, '-');

  const availableBrands = SET_DATA.brands || [];
  let availableSets: string[] = [];
  if (formData.brand && formData.sport && SPORT_CONFIG[formData.sport]) {
    const selectedBrandObj = availableBrands.find((b: any) => b.name?.toLowerCase() === formData.brand.toLowerCase());
    const sportJsonKey = SPORT_CONFIG[formData.sport].jsonKey;
    if (selectedBrandObj && selectedBrandObj.sports) {
      const sportsData = selectedBrandObj.sports as any;
      if (sportsData[sportJsonKey]) availableSets = sportsData[sportJsonKey];
    }
  }

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); setAnalyzing(true);
    try {
      const body = new FormData(); body.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body }); const data = await res.json();
      if (!data.error && data.playerName) {
        const parts = data.playerName.split(' ');
        setFormData(prev => ({ ...prev, sport: data.sport?.toUpperCase() === 'FOOTBALL' ? 'SOCCER' : data.sport?.toUpperCase() || prev.sport, firstname: parts[0]?.toUpperCase() || '', lastname: parts.slice(1).join(' ')?.toUpperCase() || '', club: data.club || '', brand: data.brand || prev.brand, series: data.series || prev.series, year: data.year?.toString() || prev.year, is_auto: !!data.is_auto, is_patch: !!data.is_patch, is_rookie: !!data.is_rookie, is_numbered: !!data.is_numbered, num_low: data.num_low?.toString() || '', num_high: data.num_high?.toString() || '' }));
      }
    } catch (err) {} finally { setAnalyzing(false); }
  };

  const rotateImage = async () => {
    if (!previewUrl) return;
    setAnalyzing(true);
    try {
      let currentBlob: Blob | File | null = selectedFile;
      if (!currentBlob && previewUrl) {
        const response = await fetch(previewUrl + "?t=" + new Date().getTime());
        currentBlob = await response.blob();
      }
      if (!currentBlob) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = URL.createObjectURL(currentBlob);
      await new Promise(resolve => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(90 * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = selectedFile ? selectedFile.name : `rotated-${Date.now()}.png`;
        const newFile = new File([blob], fileName, { type: blob.type });
        setSelectedFile(newFile);
        setPreviewUrl(URL.createObjectURL(newFile)); 
        setAnalyzing(false);
      }, currentBlob.type || 'image/png');
      
    } catch (e) {
      setAnalyzing(false);
    }
  };

  const saveCard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 
    let finalImageUrl = previewUrl;
    if (selectedFile) {
      const filePath = `${user.id}/${Date.now()}.${selectedFile.name.split('.').pop()}`; 
      await supabase.storage.from('card-images').upload(filePath, selectedFile);
      finalImageUrl = supabase.storage.from('card-images').getPublicUrl(filePath).data.publicUrl;
    }
    const cardDataToSave = { user_id: user.id, sport: formData.sport, firstname: formData.firstname, lastname: formData.lastname, brand: formData.brand, series: formData.series, year: parseInt(formData.year) || null, is_rookie: formData.is_rookie, is_auto: formData.is_auto, is_patch: formData.is_patch, is_numbered: formData.is_numbered, numbering_low: parseInt(formData.num_low) || null, numbering_max: parseInt(formData.num_high) || null, purchase_price: parseFloat(formData.price) || 0, image_url: finalImageUrl, club_name: formData.club, is_wishlist: isWishlistMode, website_url: formData.website_url };
    if (editId) await supabase.from('cards').update(cardDataToSave).eq('id', editId);
    else await supabase.from('cards').insert([cardDataToSave]);
    router.push(isWishlistMode ? '/wishlist' : '/collection');
  };

  const deleteCard = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    setLoading(true); await supabase.from('cards').delete().eq('id', editId);
    router.push(isWishlistMode ? '/wishlist' : '/collection');
  };

  const hideBrokenImage = (e: any) => e.currentTarget.style.display = 'none';

  if (isFetchingEdit) return <div className="min-h-screen text-white flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  // 🚀 TITRES EN BLANC ET RENOMMAGE
  const pageTitle = isWishlistMode ? 'WISHLIST' : (editId ? 'MODIFIER' : 'AJOUTER');

  return (
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20"><ChevronLeft size={20} /></button>
        {/* 🚀 TITRE EN BLANC */}
        <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter">
          {pageTitle}
        </h1>
        <div className="w-auto min-w-[40px] flex justify-end">
          {editId && (
            <button onClick={deleteCard} className={`h-10 px-3 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDelete ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white text-red-500'}`}>
              <Trash2 size={18} />{confirmDelete && <span className="text-xs font-black ml-2 uppercase">Sûr ?</span>}
            </button>
          )}
        </div>
      </header>

      <div className="relative w-full max-w-[240px] mx-auto mb-12">
        <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full flex items-center justify-center overflow-hidden cursor-pointer bg-white/5 border border-white/10 rounded-2xl">
          {previewUrl ? <img src={previewUrl} className="w-[85%] h-[85%] object-contain rounded-xl z-0" alt="Preview" /> : <div className="text-[11px] font-bold text-[#AFFF25] border border-[#AFFF25]/30 px-6 py-2 rounded-full">SCANNER</div>}
        </div>
        {previewUrl && (
          <button onClick={(e) => { e.preventDefault(); rotateImage(); }} className="absolute -right-4 -bottom-4 w-14 h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] shadow-[0_0_20px_rgba(175,255,37,0.4)] z-50 active:scale-90 transition-transform">
            <RotateCw size={24} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setIsJoueurOpen(!isJoueurOpen)}>
            <h2 className="text-2xl font-black italic uppercase">Joueur</h2><div className="text-[#AFFF25]">{isJoueurOpen ? <Minus size={22} /> : <Plus size={22} />}</div>
          </div>
          {isJoueurOpen && (
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Sport</label>
                <div className="relative flex items-center">
                  {sportImage && <img src={`/asset/sports/${sportImage}.png`} onError={hideBrokenImage} className="absolute left-4 w-5 h-5 object-contain z-10" alt="Sport" />}
                  <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value, series: ''})} className={`w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 ${sportImage ? 'pl-12' : 'pl-4'}`}><option value="">Sport</option>{Object.keys(SPORT_CONFIG).map(k => <option key={k} value={k}>{SPORT_CONFIG[k].label}</option>)}</select>
                  <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
                </div>
              </div>
              <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} placeholder="Prénom" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4" />
              <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value.toUpperCase()})} placeholder="Nom" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4" />
              
              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Club</label>
                <div className="relative flex items-center">
                  {formData.club && <img src={`/asset/logo-club/${clubSlug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Club" />}
                  <input value={formData.club} onChange={e => { setFormData({...formData, club: e.target.value}); setShowClubSuggestions(true); }} onFocus={() => setShowClubSuggestions(true)} onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)} placeholder="Club" className={`w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm ${formData.club ? 'pl-12' : 'pl-4'}`} />
                  <Search className="absolute right-4 text-[#AFFF25] pointer-events-none" size={16} />
                </div>
                {showClubSuggestions && formData.club && filteredClubs.length > 0 && (
                  <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto">
                    {filteredClubs.slice(0, 20).map((c: any, i: number) => (
                      <li key={i} onClick={() => { setFormData({...formData, club: c.name}); setShowClubSuggestions(false); }} className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3">
                        <img src={`/asset/logo-club/${c.slug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="w-6 h-6" /><span className="text-sm font-bold uppercase">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setIsCarteOpen(!isCarteOpen)}>
            <h2 className="text-2xl font-black italic uppercase">Carte</h2><div className="text-[#AFFF25]">{isCarteOpen ? <Minus size={22} /> : <Plus size={22} />}</div>
          </div>
          {isCarteOpen && (
            <div className="space-y-4">
              <div className="relative">
                <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4"><option value="">Fabricant</option>{availableBrands.map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}</select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              <div className="relative">
                <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4"><option value="">Collection</option>{availableSets.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              <div className="relative">
                <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4"><option value="">Année</option>{yearsList.map(y => <option key={y} value={y}>{y}</option>)}</select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              
              {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
                const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
                const active = formData[k as keyof typeof formData];
                return (
                  <div key={l} className="flex justify-between items-center px-2"><span className="font-black text-sm">{l}</span><button onClick={() => setFormData({...formData, [k]: !active})} className={`w-12 h-6 rounded-full relative border ${active ? 'border-[#AFFF25] bg-[#AFFF25]/20' : 'border-white/30'}`}><div className={`absolute top-[3px] w-4 h-4 rounded-full ${active ? 'right-1 bg-[#AFFF25]' : 'left-1 bg-white/50'}`} /></button></div>
                )
              })}
              
              <div className="relative w-full">
                <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Prix d'achat" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 pr-8" />
                <span className="absolute right-4 top-3 text-[#AFFF25] font-bold">€</span>
              </div>
              
              {isWishlistMode && (
                <div className="relative w-full flex items-center">
                  <LinkIcon className="absolute left-4 text-white/40" size={16} />
                  <input value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="Lien Web (Vinted, eBay...)" className="w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 pl-12 rounded-full text-sm outline-none text-white/80 transition-colors" />
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={saveCard} className="w-full font-black italic py-4 rounded-full mt-2 mb-6 uppercase bg-[#AFFF25] text-black shadow-[0_10px_40px_rgba(175,255,37,0.3)] flex justify-center">{loading ? <Loader2 className="animate-spin" /> : 'Enregistrer'}</button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}