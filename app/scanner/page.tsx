'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus, Trash2, RotateCw, SlidersHorizontal, Wand2, X, Check } from 'lucide-react';
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

const DEFAULT_FORM = { sport: '', firstname: '', lastname: '', club: '', brand: '', series: '', year: '', is_auto: false, is_patch: false, is_rookie: false, is_numbered: false, num_low: '', num_high: '', price: '', website_url: '' };

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

  const [scanMode, setScanMode] = useState<'unitaire' | 'lot'>('unitaire');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  
  const [isFetchingEdit, setIsFetchingEdit] = useState(!!editId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [showEditor, setShowEditor] = useState(false);
  const [imgSettings, setImgSettings] = useState({ brightness: 100, contrast: 100, saturation: 100, zoom: 1 });

  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [isJoueurOpen, setIsJoueurOpen] = useState(true);
  const [isCarteOpen, setIsCarteOpen] = useState(true);

  const [formData, setFormData] = useState(DEFAULT_FORM);
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
  const filteredClubs = safeFootballClubs.filter((c: any) => c.name?.toLowerCase().includes(searchStr) || c.slug?.toLowerCase().includes(searchStr)).sort((a: any, b: any) => { if (a.name.toLowerCase().startsWith(searchStr)) return -1; return 1; });
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

  const sportImage = formData.sport ? SPORT_CONFIG[formData.sport]?.image : null;
  const brandSlug = formData.brand ? formData.brand.toLowerCase().replace(/\s+/g, '-') : '';
  const isFormStarted = Object.values(formData).some(val => (typeof val === 'string' && val.trim() !== '') || (typeof val === 'boolean' && val === true));

  // 🚀 IMPORT PAR URL AVEC RECUPERATION DU PRIX
  const handleUrlImport = async () => {
    if (!formData.website_url) return;
    setAnalyzing(true);
    
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.website_url })
      });
      const data = await res.json();
      
      if (data.base64) {
        const imgRes = await fetch(data.base64);
        const blob = await imgRes.blob();
        const file = new File([blob], `scraped-${Date.now()}.jpg`, { type: blob.type });
        
        if (data.price) {
          setFormData(prev => ({ ...prev, price: data.price }));
        }

        setBulkFiles([file]);
        setCurrentBulkIndex(0);
        await processBulkItem([file], 0, false); 
      } else {
        alert("Impossible de trouver une image sur ce lien.");
        setAnalyzing(false);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'importation du lien.");
      setAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (scanMode === 'lot') {
      if (files.length > 10) { alert("Max 10 cartes"); return; }
      setBulkFiles(files); setCurrentBulkIndex(0); await processBulkItem(files, 0, true);
    } else {
      await processBulkItem([files[0]], 0, true);
    }
  };

  const processBulkItem = async (filesList: File[], index: number, resetForm: boolean = true) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const file = filesList[index];
    setSelectedFile(file); 
    setPreviewUrl(URL.createObjectURL(file)); 
    setAnalyzing(true);
    
    const currentUrl = formData.website_url;
    if (resetForm) setFormData(DEFAULT_FORM);

    try {
      const body = new FormData(); 
      body.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body }); 
      const data = await res.json();
      
      if (!data.error) {
        // FILTRE INTELLIGENT DE NETTOYAGE
        // On vire toutes les réponses inutiles que l'IA peut parfois renvoyer
        const cleanValue = (val: any) => {
          if (!val) return '';
          const str = String(val).trim();
          const lower = str.toLowerCase();
          if (['n/a', 'na', 'none', 'inconnu', 'brand', 'null', 'undefined', '-', 'unknown'].includes(lower)) return '';
          return str;
        };

        const cleanPlayerName = cleanValue(data.playerName);
        let fname = ''; let lname = '';
        
        if (cleanPlayerName) {
          const parts = cleanPlayerName.split(' ');
          fname = parts[0]?.toUpperCase() || '';
          lname = parts.slice(1).join(' ')?.toUpperCase() || '';
        }

        setFormData(prev => {
          let aiSport = cleanValue(data.sport).toUpperCase();
          if (aiSport === 'FOOTBALL') aiSport = 'SOCCER';
          
          return {
            ...prev,
            sport: aiSport,
            firstname: fname,
            lastname: lname,
            club: cleanValue(data.club),
            brand: cleanValue(data.brand),
            series: cleanValue(data.series),
            year: cleanValue(data.year),
            is_auto: !!data.is_auto,
            is_patch: !!data.is_patch,
            is_rookie: !!data.is_rookie,
            is_numbered: !!data.is_numbered,
            num_low: cleanValue(data.num_low),
            num_high: cleanValue(data.num_high),
            website_url: resetForm ? '' : currentUrl
          };
        });
      }
    } catch (err) { console.error(err); } 
    finally { setAnalyzing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const rotateImage = async () => {
    if (!previewUrl) return;
    setIsApplyingEdit(true);
    try {
      let currentBlob: Blob | File | null = selectedFile;
      if (!currentBlob && previewUrl) {
        const response = await fetch(previewUrl + "?t=" + new Date().getTime());
        currentBlob = await response.blob();
      }
      if (!currentBlob) return;
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = URL.createObjectURL(currentBlob);
      await new Promise(resolve => { img.onload = resolve; });
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = img.height; canvas.height = img.width;
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(90 * Math.PI / 180); ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const newFile = new File([blob], `rotated-${Date.now()}.png`, { type: blob.type });
        setSelectedFile(newFile); setPreviewUrl(URL.createObjectURL(newFile)); setIsApplyingEdit(false);
      }, currentBlob.type || 'image/png');
    } catch (e) { setIsApplyingEdit(false); }
  };

  const applyImageEdits = async () => {
    if (!previewUrl) return;
    setIsApplyingEdit(true);
    try {
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = previewUrl;
      await new Promise(resolve => { img.onload = resolve; });
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = img.width; canvas.height = img.height;
      ctx.filter = `brightness(${imgSettings.brightness}%) contrast(${imgSettings.contrast}%) saturate(${imgSettings.saturation}%)`;
      const scale = imgSettings.zoom; const sw = img.width / scale; const sh = img.height / scale;
      const sx = (img.width - sw) / 2; const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const newFile = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
        setSelectedFile(newFile); setPreviewUrl(URL.createObjectURL(newFile)); setShowEditor(false); setIsApplyingEdit(false);
        setImgSettings({ brightness: 100, contrast: 100, saturation: 100, zoom: 1 });
      }, 'image/png');
    } catch (e) { setIsApplyingEdit(false); }
  };

  const handleAutoEnhance = () => setImgSettings(prev => ({ ...prev, brightness: 110, contrast: 115, saturation: 120 }));

  // 🚀 FONCTION DE COMPRESSION PUISSANTE AVANT ENVOI
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scaleSize = MAX_WIDTH / img.width;
        
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
             resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
          } else {
             resolve(file);
          }
        }, 'image/jpeg', 0.8); 
      };
    });
  };

  const saveCard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; 
      let finalImageUrl = previewUrl;
      
      if (selectedFile) {
        // 🚀 COMPRESSION DE L'IMAGE POUR DES PERFORMANCES MAXIMALES !
        const compressedFile = await compressImage(selectedFile);
        
        const filePath = `${user.id}/${Date.now()}.jpg`; 
        await supabase.storage.from('card-images').upload(filePath, compressedFile);
        finalImageUrl = supabase.storage.from('card-images').getPublicUrl(filePath).data.publicUrl;
      }
      
      const cardDataToSave = { user_id: user.id, sport: formData.sport, firstname: formData.firstname, lastname: formData.lastname, brand: formData.brand, series: formData.series, year: parseInt(formData.year) || null, is_rookie: formData.is_rookie, is_auto: formData.is_auto, is_patch: formData.is_patch, is_numbered: formData.is_numbered, numbering_low: parseInt(formData.num_low) || null, numbering_max: parseInt(formData.num_high) || null, purchase_price: parseFloat(formData.price) || 0, image_url: finalImageUrl, club_name: formData.club, is_wishlist: isWishlistMode, website_url: formData.website_url };
      
      if (editId) await supabase.from('cards').update(cardDataToSave).eq('id', editId);
      else await supabase.from('cards').insert([cardDataToSave]);

      if (scanMode === 'lot' && currentBulkIndex < bulkFiles.length - 1) {
        setLoading(false);
        const nextIndex = currentBulkIndex + 1;
        setCurrentBulkIndex(nextIndex);
        await processBulkItem(bulkFiles, nextIndex, true);
      } else {
        router.push(isWishlistMode ? '/wishlist' : '/collection');
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const deleteCard = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    setLoading(true); await supabase.from('cards').delete().eq('id', editId);
    router.push(isWishlistMode ? '/wishlist' : '/collection');
  };

  const hideBrokenImage = (e: any) => e.currentTarget.style.display = 'none';

  if (isFetchingEdit) return <div className="min-h-screen text-white flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const pageTitle = isWishlistMode ? 'WISHLIST' : (editId ? 'MODIFIER' : 'AJOUTER');

  return (
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans relative">
      
      {showEditor && previewUrl && (
        <div className="fixed inset-0 z-[100] bg-[#040221] p-6 flex flex-col animate-in fade-in zoom-in duration-300">
          <header className="flex justify-between items-center mb-6 pt-4">
            <button onClick={() => setShowEditor(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:scale-95"><X size={20} /></button>
            <h2 className="text-xl font-black italic uppercase text-[#AFFF25] tracking-widest">Éditeur</h2>
            <button onClick={applyImageEdits} className="w-10 h-10 bg-[#AFFF25] text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(175,255,37,0.5)] active:scale-95"><Check size={20} strokeWidth={3} /></button>
          </header>

          <div className="relative w-full flex-1 max-h-[50vh] rounded-2xl overflow-hidden border border-white/20 bg-black/50 shadow-2xl flex items-center justify-center">
            <img 
              src={previewUrl} 
              className="w-full h-full object-contain"
              style={{
                filter: `brightness(${imgSettings.brightness}%) contrast(${imgSettings.contrast}%) saturate(${imgSettings.saturation}%)`,
                transform: `scale(${imgSettings.zoom})`
              }}
              alt="Preview Edit" 
            />
          </div>

          <div className="mt-8 space-y-6 pb-6 overflow-y-auto">
            <button onClick={handleAutoEnhance} className="w-full py-3 rounded-full bg-[#AFFF25]/10 border border-[#AFFF25] text-[#AFFF25] font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Wand2 size={18} /> Amélioration Auto
            </button>

            <div className="space-y-4">
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Zoom</span><span>{(imgSettings.zoom).toFixed(1)}x</span></div><input type="range" min="1" max="3" step="0.05" value={imgSettings.zoom} onChange={e => setImgSettings({...imgSettings, zoom: parseFloat(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Luminosité</span><span>{imgSettings.brightness}%</span></div><input type="range" min="50" max="150" step="1" value={imgSettings.brightness} onChange={e => setImgSettings({...imgSettings, brightness: parseInt(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Contraste</span><span>{imgSettings.contrast}%</span></div><input type="range" min="50" max="150" step="1" value={imgSettings.contrast} onChange={e => setImgSettings({...imgSettings, contrast: parseInt(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Brillance</span><span>{imgSettings.saturation}%</span></div><input type="range" min="0" max="200" step="1" value={imgSettings.saturation} onChange={e => setImgSettings({...imgSettings, saturation: parseInt(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
            </div>
          </div>
          
          {isApplyingEdit && (
            <div className="absolute inset-0 bg-[#040221]/90 flex flex-col items-center justify-center backdrop-blur-sm z-50">
               <Loader2 className="animate-spin text-[#AFFF25] mb-2" size={40} />
               <span className="text-[#AFFF25] text-xs font-bold tracking-widest animate-pulse mt-2">APPLICATION...</span>
            </div>
          )}
        </div>
      )}

      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20"><ChevronLeft size={20} /></button>
        <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter">{pageTitle}</h1>
        <div className="w-auto min-w-[40px] flex justify-end">
          {editId && (
            <button onClick={deleteCard} className={`h-10 px-3 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDelete ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white text-red-500'}`}>
              <Trash2 size={18} />{confirmDelete && <span className="text-xs font-black ml-2 uppercase">Sûr ?</span>}
            </button>
          )}
        </div>
      </header>

      {!editId && !previewUrl && !isWishlistMode && (
        <div className="flex justify-center gap-8 mb-8">
          <button onClick={() => setScanMode('unitaire')} className={`text-sm font-bold uppercase tracking-widest transition-all ${scanMode === 'unitaire' ? 'text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)] border-b-2 border-[#AFFF25] pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}>Unitaire</button>
          <button onClick={() => setScanMode('lot')} className={`text-sm font-bold uppercase tracking-widest transition-all ${scanMode === 'lot' ? 'text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)] border-b-2 border-[#AFFF25] pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}>En Lot</button>
        </div>
      )}

      <div className="relative w-full max-w-[240px] mx-auto mb-6">
        <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full flex items-center justify-center overflow-hidden cursor-pointer bg-white/5 border border-white/10 rounded-2xl">
          {previewUrl ? (
            <img src={previewUrl} className="w-[85%] h-[85%] object-contain rounded-xl z-0" alt="Preview" />
          ) : (
            <div className="text-[11px] font-bold text-[#AFFF25] border border-[#AFFF25]/30 px-6 py-2 rounded-full uppercase text-center leading-tight">
              {scanMode === 'lot' ? 'SCANNER EN MASSE\n(Max 10)' : 'SCANNER UNE CARTE'}
            </div>
          )}
          
          {analyzing && !showEditor && (
            <div className="absolute inset-0 bg-[#040221]/90 flex flex-col items-center justify-center backdrop-blur-sm z-40">
               <Loader2 className="animate-spin text-[#AFFF25] mb-2" size={32} />
               <span className="text-[#AFFF25] text-[10px] italic tracking-widest animate-pulse mt-2 text-center">
                 {scanMode === 'lot' && bulkFiles.length > 0 ? `ANALYSE ${currentBulkIndex + 1} / ${bulkFiles.length}...` : 'ANALYSE IA...'}
               </span>
            </div>
          )}
        </div>
        
        {previewUrl && (
          <>
            <button onClick={(e) => { e.preventDefault(); rotateImage(); }} className="absolute -right-4 bottom-4 w-12 h-12 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] shadow-[0_0_20px_rgba(175,255,37,0.4)] z-50 active:scale-90 transition-transform">
              <RotateCw size={20} strokeWidth={2.5} />
            </button>
            <button onClick={(e) => { e.preventDefault(); setShowEditor(true); }} className="absolute -left-4 bottom-4 w-12 h-12 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] shadow-[0_0_20px_rgba(175,255,37,0.4)] z-50 active:scale-90 transition-transform">
              <SlidersHorizontal size={20} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {isWishlistMode && (
        <div className="relative w-full max-w-[300px] mx-auto mb-10 flex items-center gap-2 z-10">
          <div className="relative flex-1">
            <input 
              value={formData.website_url} 
              onChange={e => setFormData({...formData, website_url: e.target.value})} 
              placeholder="Coller un lien (Vinted, eBay...)" 
              className="w-full bg-[#040221]/60 backdrop-blur-md border border-white/20 focus:border-[#AFFF25] py-2.5 px-4 rounded-full text-xs outline-none text-white transition-colors" 
            />
          </div>
          <button 
            onClick={handleUrlImport}
            disabled={analyzing || !formData.website_url}
            className="bg-[#AFFF25] text-black px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform"
          >
            {analyzing ? <Loader2 className="animate-spin" size={14} /> : 'Importer'}
          </button>
        </div>
      )}

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
                  <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value, series: ''})} className={`w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm appearance-none outline-none ${sportImage ? 'pl-[44px]' : 'pl-4'}`}>
                    <option value="">Sport</option>
                    {Object.keys(SPORT_CONFIG).map(k => <option key={k} value={k}>{SPORT_CONFIG[k].label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
                </div>
              </div>
              <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} placeholder="Prénom" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 outline-none" />
              <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value.toUpperCase()})} placeholder="Nom" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 outline-none" />
              
              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Club</label>
                <div className="relative flex items-center">
                  {formData.club && <img src={`/asset/logo-club/${clubSlug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Club" />}
                  <input value={formData.club} onChange={e => { setFormData({...formData, club: e.target.value}); setShowClubSuggestions(true); }} onFocus={() => setShowClubSuggestions(true)} onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)} placeholder="Club" className={`w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm outline-none ${formData.club ? 'pl-[44px]' : 'pl-4'}`} />
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
                {formData.brand && <img src={`/asset/brands/${brandSlug}.png`} onError={hideBrokenImage} className="absolute left-4 top-3 w-6 h-6 object-contain z-10" alt="Brand" />}
                <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className={`w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm appearance-none outline-none ${formData.brand ? 'pl-[44px]' : 'pl-4'}`}>
                  <option value="">Fabricant</option>
                  {availableBrands.map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              <div className="relative">
                <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 appearance-none outline-none"><option value="">Collection</option>{availableSets.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              <div className="relative">
                <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 appearance-none outline-none"><option value="">Année</option>{yearsList.map(y => <option key={y} value={y}>{y}</option>)}</select>
                <ChevronDown className="absolute right-4 top-3 text-white/50 pointer-events-none" size={16} />
              </div>
              
              {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
                const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
                const active = formData[k as keyof typeof formData];
                return (
                  <div key={l} className="flex justify-between items-center px-2"><span className="font-black text-sm">{l}</span><button onClick={() => setFormData({...formData, [k]: !active})} className={`w-12 h-6 rounded-full relative border ${active ? 'border-[#AFFF25] bg-[#AFFF25]/20' : 'border-white/30'}`}><div className={`absolute top-[3px] w-4 h-4 rounded-full ${active ? 'right-1 bg-[#AFFF25]' : 'left-1 bg-white/50'}`} /></button></div>
                )
              })}
              
              {formData.is_numbered && (
                <div className="flex items-center gap-4">
                  <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} placeholder="Ex: 5" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none" />
                  <span className="text-[#AFFF25] font-black text-xl">/</span>
                  <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} placeholder="Ex: 50" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none" />
                </div>
              )}

              <div className="relative w-full">
                <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Prix estimé/d'achat" className="w-full bg-[#040221] border border-white/20 p-3 rounded-full text-sm pl-4 pr-8 outline-none" />
                <span className="absolute right-4 top-3 text-[#AFFF25] font-bold">€</span>
              </div>
            </div>
          )}
        </div>

        <button disabled={loading || analyzing || !isFormStarted} onClick={saveCard} className={`w-full font-black italic py-4 rounded-full mt-2 mb-6 uppercase flex justify-center transition-all ${isFormStarted ? 'bg-[#AFFF25] text-black shadow-[0_10px_40px_rgba(175,255,37,0.3)] hover:scale-[1.02] active:scale-95' : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}>
          {loading ? <Loader2 className="animate-spin" /> : 
            editId ? 'Mettre à jour' : 
            (scanMode === 'lot' && currentBulkIndex < bulkFiles.length - 1) ? `Valider & Suivant (${currentBulkIndex + 1}/${bulkFiles.length})` : 
            (scanMode === 'lot' ? `Terminer (${currentBulkIndex + 1}/${bulkFiles.length})` : 'Enregistrer')
          }
        </button>
      </div>
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple={scanMode === 'lot'} />
    </div>
  );
}