'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus, Trash2, RotateCw, SlidersHorizontal, Wand2, X, Check, Camera, Image as ImageIcon, Crop } from 'lucide-react';

// Importation des données Clubs
import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import BASKETBALL_CLUBS from '@/data/basketball-clubs.json';
import BASEBALL_CLUBS from '@/data/baseball-clubs.json';

// Importation des données Joueurs
import NBA_PLAYERS from '@/data/nba-player.json';
import MLB_PLAYERS from '@/data/mlb-player.json';
import TENNIS_PLAYERS from '@/data/tennis-player.json';

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

const SPORT_FOLDERS: Record<string, string> = {
  'SOCCER': 'foot',
  'BASKETBALL': 'NBA',
  'BASEBALL': 'MLB',
  'NFL': 'NFL',
  'NHL': 'NHL'
};

const CLUB_DATA: Record<string, any[]> = {
  'SOCCER': FOOTBALL_CLUBS,
  'BASKETBALL': BASKETBALL_CLUBS,
  'BASEBALL': BASEBALL_CLUBS,
};

const PLAYER_DATA: Record<string, any[]> = {
  'BASKETBALL': NBA_PLAYERS,
  'BASEBALL': MLB_PLAYERS,
  'TENNIS': TENNIS_PLAYERS?.atp_top_100 || []
};

const DEFAULT_FORM = { sport: '', firstname: '', lastname: '', club: '', brand: '', series: '', year: '', is_auto: false, is_patch: false, is_rookie: false, is_numbered: false, num_low: '', num_high: '', price: '', website_url: '', is_graded: false, grading_company: '', grading_grade: '' };

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
  
  // 🚨 NOUVEAU : GESTION RECTO / VERSO
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  
  const [isFetchingEdit, setIsFetchingEdit] = useState(!!editId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // RECTO
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // VERSO
  const [previewUrlBack, setPreviewUrlBack] = useState<string | null>(null);
  const [selectedFileBack, setSelectedFileBack] = useState<File | null>(null);
  
  // ÉTATS POUR LE RECADRAGE POST-CAPTURE
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);

  const [showEditor, setShowEditor] = useState(false);
  const [imgSettings, setImgSettings] = useState({ brightness: 100, contrast: 100, saturation: 100, zoom: 1 });

  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
  
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
          setFormData({ 
            sport: data.sport || '', 
            firstname: data.firstname || '', 
            lastname: data.lastname || '', 
            club: data.club_name || '', 
            brand: data.brand || '', 
            series: data.series || '', 
            year: data.year?.toString() || '', 
            is_auto: data.is_auto || false, 
            is_patch: data.is_patch || false, 
            is_rookie: data.is_rookie || false, 
            is_numbered: data.is_numbered || false, 
            num_low: data.numbering_low?.toString() || '', 
            num_high: data.numbering_max?.toString() || '', 
            price: data.purchase_price?.toString() || '', 
            website_url: data.website_url || '',
            is_graded: data.is_graded || false,
            grading_company: data.grading_company || '',
            grading_grade: data.grading_grade || ''
          });
          setPreviewUrl(data.image_url);
          setPreviewUrlBack(data.image_url_back || null); // Récupère le verso si existant
        }
        setIsFetchingEdit(false);
      };
      fetchCardForEdit();
    }
  }, [editId]);

  const safeClubs = Array.isArray(CLUB_DATA[formData.sport]) ? CLUB_DATA[formData.sport] : [];
  const searchStr = formData.club.toLowerCase();
  const filteredClubs = safeClubs.filter((c: any) => c.name?.toLowerCase().includes(searchStr) || c.slug?.toLowerCase().includes(searchStr)).sort((a: any, b: any) => { if (a.name.toLowerCase().startsWith(searchStr)) return -1; return 1; });
  const selectedClub = filteredClubs[0];
  const clubSlug = selectedClub ? selectedClub.slug : formData.club.toLowerCase().replace(/\s+/g, '-');
  const sportFolder = SPORT_FOLDERS[formData.sport] || 'foot';

  const safePlayers = Array.isArray(PLAYER_DATA[formData.sport]) ? PLAYER_DATA[formData.sport] : [];
  const searchPlayerStr = formData.lastname.toLowerCase();
  const filteredPlayers = searchPlayerStr ? safePlayers.filter((p: any) => p.name?.toLowerCase().includes(searchPlayerStr)).slice(0, 10) : [];

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

  // ==========================================
  // GESTION DES FICHIERS & RECADRAGE
  // ==========================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (files.length > 1 && activeSide === 'front') {
      if (files.length > 10) { alert("Max 10 cartes"); return; }
      setBulkFiles(files); 
      setCurrentBulkIndex(0); 
      await processBulkItem(files, 0, true);
    } else {
      // 📸 On ouvre le RECADREUR
      setCropPreview(URL.createObjectURL(files[0]));
      setCropZoom(1);
    }
  };

  const confirmCrop = () => {
    if (!cropPreview) return;
    setIsApplyingEdit(true);

    const img = new Image();
    img.src = cropPreview;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 750;
      canvas.height = 1050; 
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imgRatio = img.width / img.height;
      const targetRatio = canvas.width / canvas.height;
      let sWidth, sHeight;

      if (imgRatio > targetRatio) {
        sHeight = img.height;
        sWidth = img.height * targetRatio;
      } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
      }

      sWidth /= cropZoom;
      sHeight /= cropZoom;

      const sx = (img.width - sWidth) / 2;
      const sy = (img.height - sHeight) / 2;

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setCropPreview(null);
        setIsApplyingEdit(false);
        
        if (activeSide === 'back') {
          // Verso : On l'ajoute juste visuellement (PAS D'IA !)
          setSelectedFileBack(croppedFile);
          setPreviewUrlBack(URL.createObjectURL(croppedFile));
        } else {
          // Recto : L'IA lit la carte !
          if (scanMode === 'lot') {
             setBulkFiles([croppedFile]);
             setCurrentBulkIndex(0);
             processBulkItem([croppedFile], 0, true);
          } else {
             processBulkItem([croppedFile], 0, true);
          }
        }
      }, 'image/jpeg', 0.9);
    };
  };

  const processBulkItem = async (filesList: File[], index: number, resetForm: boolean = true) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const file = filesList[index];
    
    // Uniquement pour le Recto !
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
            is_graded: !!data.is_graded,
            grading_company: cleanValue(data.grading_company),
            grading_grade: cleanValue(data.grading_grade),
            website_url: resetForm ? '' : currentUrl
          };
        });
      }
    } catch (err) { console.error(err); } 
    finally { 
      setAnalyzing(false); 
      if (cameraInputRef.current) cameraInputRef.current.value = ''; 
      if (galleryInputRef.current) galleryInputRef.current.value = ''; 
    }
  };

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

  const rotateImage = async () => {
    const currentPreview = activeSide === 'front' ? previewUrl : previewUrlBack;
    if (!currentPreview) return;
    setIsApplyingEdit(true);
    try {
      let currentBlob: Blob | File | null = activeSide === 'front' ? selectedFile : selectedFileBack;
      if (!currentBlob && currentPreview) {
        const response = await fetch(currentPreview + "?t=" + new Date().getTime());
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
        if (activeSide === 'front') {
          setSelectedFile(newFile); setPreviewUrl(URL.createObjectURL(newFile));
        } else {
          setSelectedFileBack(newFile); setPreviewUrlBack(URL.createObjectURL(newFile));
        }
        setIsApplyingEdit(false);
      }, currentBlob.type || 'image/png');
    } catch (e) { setIsApplyingEdit(false); }
  };

  const applyImageEdits = async () => {
    const currentPreview = activeSide === 'front' ? previewUrl : previewUrlBack;
    if (!currentPreview) return;
    setIsApplyingEdit(true);
    try {
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = currentPreview;
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
        if (activeSide === 'front') {
          setSelectedFile(newFile); setPreviewUrl(URL.createObjectURL(newFile));
        } else {
          setSelectedFileBack(newFile); setPreviewUrlBack(URL.createObjectURL(newFile));
        }
        setShowEditor(false); setIsApplyingEdit(false);
        setImgSettings({ brightness: 100, contrast: 100, saturation: 100, zoom: 1 });
      }, 'image/png');
    } catch (e) { setIsApplyingEdit(false); }
  };

  const handleAutoEnhance = () => setImgSettings(prev => ({ ...prev, brightness: 110, contrast: 115, saturation: 120 }));

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
      let finalImageUrlBack = previewUrlBack;
      
      if (selectedFile) {
        const compressedFile = await compressImage(selectedFile);
        const filePath = `${user.id}/${Date.now()}.jpg`; 
        await supabase.storage.from('card-images').upload(filePath, compressedFile);
        finalImageUrl = supabase.storage.from('card-images').getPublicUrl(filePath).data.publicUrl;
      }

      if (selectedFileBack) {
        const compressedBack = await compressImage(selectedFileBack);
        const backPath = `${user.id}/${Date.now()}-back.jpg`; 
        await supabase.storage.from('card-images').upload(backPath, compressedBack);
        finalImageUrlBack = supabase.storage.from('card-images').getPublicUrl(backPath).data.publicUrl;
      }
      
      const cardDataToSave = { 
        user_id: user.id, 
        sport: formData.sport, 
        firstname: formData.firstname, 
        lastname: formData.lastname, 
        brand: formData.brand, 
        series: formData.series, 
        year: parseInt(formData.year) || null, 
        is_rookie: formData.is_rookie, 
        is_auto: formData.is_auto, 
        is_patch: formData.is_patch, 
        is_numbered: formData.is_numbered, 
        numbering_low: parseInt(formData.num_low) || null, 
        numbering_max: parseInt(formData.num_high) || null, 
        purchase_price: parseFloat(formData.price) || 0, 
        image_url: finalImageUrl, 
        image_url_back: finalImageUrlBack, // Sauvegarde du Verso !
        club_name: formData.club, 
        is_wishlist: isWishlistMode, 
        website_url: formData.website_url,
        is_graded: formData.is_graded,
        grading_company: formData.is_graded ? formData.grading_company : null,
        grading_grade: formData.is_graded ? formData.grading_grade : null
      };
      
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

  if (isFetchingEdit) return <div className="min-h-screen bg-[#040221] flex flex-col items-center justify-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const pageTitle = isWishlistMode ? 'WISHLIST' : (editId ? 'MODIFIER' : 'AJOUTER');

  // Savoir quelle image on prévisualise selon l'onglet actif
  const activePreviewUrl = activeSide === 'front' ? previewUrl : previewUrlBack;

  return (
    <div className="min-h-screen text-white font-sans relative overflow-x-hidden bg-[#040221]">
      
      {/* ==========================================
          MODAL DE RECADRAGE POST-CAPTURE
      ========================================== */}
      {cropPreview && !analyzing && !activePreviewUrl && (
        <div className="fixed inset-0 z-[200] bg-[#040221] flex flex-col items-center justify-center">
          
          <h2 className="text-xl font-black italic text-[#AFFF25] tracking-widest mb-8 uppercase drop-shadow-md">
            Ajuster le {activeSide === 'front' ? 'Recto' : 'Verso'}
          </h2>

          <div className="relative w-[250px] lg:w-[300px] aspect-[2.5/3.5] border-[3px] border-dashed border-[#AFFF25] rounded-xl flex items-center justify-center z-10 overflow-hidden shadow-[0_0_0_9999px_rgba(4,2,33,0.85)]">
             <img 
               src={cropPreview} 
               className="w-full h-full object-cover origin-center" 
               style={{ transform: `scale(${cropZoom})` }} 
               alt="To Crop" 
             />
          </div>

          <div className="relative z-20 w-[250px] lg:w-[300px] mt-12">
            <label className="text-xs font-bold text-[#AFFF25] uppercase mb-3 flex justify-between tracking-widest">
              <span>Ajuster la taille</span> <span>{cropZoom.toFixed(1)}x</span>
            </label>
            <input 
              type="range" min="1" max="3" step="0.1" 
              value={cropZoom} 
              onChange={e => setCropZoom(parseFloat(e.target.value))} 
              className="w-full accent-[#AFFF25]" 
            />
          </div>

          <div className="relative z-20 flex gap-4 mt-10 w-[250px] lg:w-[300px]">
            <button 
              onClick={() => setCropPreview(null)} 
              className="flex-1 py-3.5 border border-white/20 text-white rounded-full font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button 
              onClick={confirmCrop} 
              disabled={isApplyingEdit}
              className="flex-1 py-3.5 bg-[#AFFF25] text-[#040221] rounded-full font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(175,255,37,0.4)] flex justify-center items-center gap-2"
            >
              {isApplyingEdit ? <Loader2 size={16} className="animate-spin" /> : <><Crop size={16} /> Valider</>}
            </button>
          </div>
        </div>
      )}


      {/* 🔘 HEADER FIXE */}
      <header className="fixed top-0 left-0 w-full h-[88px] z-50 flex items-center justify-between px-6 pointer-events-none">
        <button onClick={() => router.back()} className="pointer-events-auto w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
        <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter pointer-events-auto drop-shadow-lg">{pageTitle}</h1>
        <div className="w-auto min-w-[40px] flex justify-end pointer-events-auto">
          {editId && (
            <button onClick={deleteCard} className={`h-10 px-3 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDelete ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/10 backdrop-blur-md text-red-500 border border-white/20'}`}>
              <Trash2 size={18} />{confirmDelete && <span className="text-xs font-black ml-2 uppercase">Sûr ?</span>}
            </button>
          )}
        </div>
      </header>

      {/* 🖌️ EDITEUR PHOTO MODAL */}
      {showEditor && activePreviewUrl && (
        <div className="fixed inset-0 z-[100] bg-[#040221] p-6 flex flex-col animate-in fade-in zoom-in duration-300">
          <header className="flex justify-between items-center mb-6 pt-4">
            <button onClick={() => setShowEditor(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:scale-95"><X size={20} /></button>
            <h2 className="text-xl font-black italic uppercase text-[#AFFF25] tracking-widest">Éditeur {activeSide === 'front' ? 'Recto' : 'Verso'}</h2>
            <button onClick={applyImageEdits} className="w-10 h-10 bg-[#AFFF25] text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(175,255,37,0.5)] active:scale-95"><Check size={20} strokeWidth={3} /></button>
          </header>

          <div className="relative w-full flex-1 max-h-[50vh] rounded-2xl overflow-hidden border border-white/20 bg-black/50 shadow-2xl flex items-center justify-center">
            <img 
              src={activePreviewUrl} 
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

      {/* 🖼️ PARTIE GAUCHE (UPLOAD / IMAGE) */}
      <div className={`relative lg:fixed lg:top-0 lg:left-0 w-full lg:w-2/3 flex flex-col items-center lg:justify-center pt-[100px] lg:pt-0 pb-8 lg:pb-0 lg:h-screen z-10 px-6 transition-all duration-300`}>
        
        {/* SWITCH RECTO / VERSO (au lieu de Unitaire / Lot) */}
        {!isWishlistMode && (
          <div className="flex justify-center gap-2 mb-8 bg-white/5 p-1 rounded-full border border-white/10 relative w-fit mx-auto">
            <div className={`absolute top-1 bottom-1 w-[100px] rounded-full transition-all duration-300 ${activeSide === 'front' ? 'left-1 bg-[#AFFF25]' : 'translate-x-[102px] bg-white/20'}`}></div>
            <button onClick={() => setActiveSide('front')} className={`relative z-10 w-[100px] py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSide === 'front' ? 'text-[#040221]' : 'text-white/60'}`}>Recto</button>
            <button onClick={() => setActiveSide('back')} className={`relative z-10 w-[100px] py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSide === 'back' ? 'text-white' : 'text-white/60'}`}>Verso</button>
          </div>
        )}

        <div className="relative w-full max-w-[240px] lg:max-w-[350px] mx-auto mb-6 lg:mb-10">
          
          {/* Zone d'affichage d'image ou Boutons de Capture */}
          {activePreviewUrl ? (
            <div className="relative aspect-[3/4] w-full flex items-center justify-center overflow-hidden bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl shadow-2xl">
              <img src={activePreviewUrl} className="w-[85%] h-[85%] object-contain rounded-xl z-0" alt="Preview" />
              
              {/* Overlay d'analyse uniquement si on scanne le recto */}
              {analyzing && !showEditor && activeSide === 'front' && (
                <div className="absolute inset-0 bg-[#040221]/90 flex flex-col items-center justify-center backdrop-blur-sm z-40">
                   <Loader2 className="animate-spin text-[#AFFF25] mb-2 lg:mb-4" size={32} />
                   <span className="text-[#AFFF25] text-[10px] lg:text-xs font-bold tracking-widest animate-pulse mt-2 text-center px-4">
                     {scanMode === 'lot' && bulkFiles.length > 0 ? `ANALYSE ${currentBulkIndex + 1} / ${bulkFiles.length}...` : 'ANALYSE IA EN COURS...'}
                   </span>
                </div>
              )}
              
              {/* Bouton pour supprimer l'image et en reprendre une (seulement pour l'image active) */}
              {!analyzing && (
                <button onClick={() => activeSide === 'front' ? setPreviewUrl(null) : setPreviewUrlBack(null)} className="absolute top-4 right-4 w-8 h-8 bg-black/50 border border-white/20 text-white rounded-full flex items-center justify-center z-50">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="aspect-[3/4] w-full flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl shadow-2xl gap-4 p-6">
              
              {/* BOUTON : Appareil Photo NATIF */}
              <button 
                onClick={() => cameraInputRef.current?.click()} 
                className="w-full flex flex-col items-center justify-center gap-3 bg-[#AFFF25]/10 border border-[#AFFF25]/30 hover:bg-[#AFFF25]/20 hover:border-[#AFFF25] transition-all p-6 rounded-2xl active:scale-95 group"
              >
                <div className="w-12 h-12 rounded-full bg-[#AFFF25] flex items-center justify-center text-[#040221] shadow-[0_0_15px_rgba(175,255,37,0.5)] group-hover:scale-110 transition-transform">
                  <Camera size={24} strokeWidth={2.5} />
                </div>
                <span className="text-xs lg:text-sm font-bold text-[#AFFF25] uppercase tracking-widest text-center">
                  Prendre {activeSide === 'front' ? 'le Recto' : 'le Verso'}
                </span>
              </button>

              <div className="flex items-center gap-2 w-full">
                <div className="h-[1px] flex-1 bg-white/10"></div>
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">OU</span>
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </div>

              {/* BOUTON : Importer depuis la galerie */}
              <button 
                onClick={() => galleryInputRef.current?.click()} 
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all py-4 rounded-xl active:scale-95 text-white/70"
              >
                <ImageIcon size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Ouvrir la Galerie</span>
              </button>
            </div>
          )}
          
          {/* Boutons Rotation et Édition */}
          {activePreviewUrl && (
            <>
              <button onClick={(e) => { e.preventDefault(); rotateImage(); }} className="absolute -right-4 bottom-4 lg:-right-6 lg:bottom-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] shadow-[0_0_20px_rgba(175,255,37,0.4)] z-50 active:scale-90 transition-transform hover:scale-105">
                <RotateCw size={20} className="lg:w-6 lg:h-6" strokeWidth={2.5} />
              </button>
              <button onClick={(e) => { e.preventDefault(); setShowEditor(true); }} className="absolute -left-4 bottom-4 lg:-left-6 lg:bottom-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] shadow-[0_0_20px_rgba(175,255,37,0.4)] z-50 active:scale-90 transition-transform hover:scale-105">
                <SlidersHorizontal size={20} className="lg:w-6 lg:h-6" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>

        {/* Option d'importation par URL */}
        {isWishlistMode && (
          <div className="relative w-full max-w-[300px] lg:max-w-[400px] mx-auto flex items-center gap-2 z-10">
            <div className="relative flex-1">
              <input 
                value={formData.website_url} 
                onChange={e => setFormData({...formData, website_url: e.target.value})} 
                placeholder="Coller un lien (Vinted, eBay...)" 
                className="w-full bg-[#040221]/60 backdrop-blur-md border border-white/20 focus:border-[#AFFF25] py-3 px-4 rounded-full text-xs lg:text-sm outline-none text-white transition-colors" 
              />
            </div>
            <button 
              onClick={handleUrlImport}
              disabled={analyzing || !formData.website_url}
              className="bg-[#AFFF25] text-black px-5 py-3 rounded-full text-[10px] lg:text-xs font-black uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform hover:bg-[#9ee615]"
            >
              {analyzing ? <Loader2 className="animate-spin" size={16} /> : 'Importer'}
            </button>
          </div>
        )}
      </div>

      {/* 📋 PARTIE DROITE (FORMULAIRE) */}
      <div className="relative z-30 w-full lg:w-1/3 lg:ml-auto bg-[#040221] lg:bg-[#040221]/95 lg:backdrop-blur-xl rounded-t-[32px] lg:rounded-none lg:rounded-l-[32px] px-6 pt-8 lg:pt-[100px] pb-32 min-h-[60vh] lg:min-h-screen shadow-[0_-20px_40px_rgba(0,0,0,0.8)] lg:shadow-[-20px_0_40px_rgba(0,0,0,0.8)] border-t lg:border-t-0 lg:border-l border-white/5 transition-all duration-300">
        
        <div className="space-y-8">
          {/* Section Joueur */}
          <div>
            <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setIsJoueurOpen(!isJoueurOpen)}>
              <h2 className="text-2xl font-black italic uppercase">Joueur</h2><div className="text-[#AFFF25]">{isJoueurOpen ? <Minus size={22} /> : <Plus size={22} />}</div>
            </div>
            
            {isJoueurOpen && (
              <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                
                {/* Sélecteur de Sport */}
                <div className="relative">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Sport</label>
                  <div className="relative flex items-center">
                    {sportImage && <img src={`/asset/sports/${sportImage}.png`} onError={hideBrokenImage} className="absolute left-4 w-5 h-5 object-contain z-10" alt="Sport" />}
                    <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value, series: ''})} className={`w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors ${sportImage ? 'pl-[44px]' : 'pl-4'}`}>
                      <option value="">Sélectionner un sport</option>
                      {Object.keys(SPORT_CONFIG).map(k => <option key={k} value={k}>{SPORT_CONFIG[k].label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
                  </div>
                </div>
                
                <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} placeholder="Prénom" className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 outline-none focus:border-[#AFFF25]/50 transition-colors" />
                
                {/* Autocomplétion Joueur */}
                <div className="relative">
                  <input 
                    value={formData.lastname} 
                    onChange={e => { setFormData({...formData, lastname: e.target.value.toUpperCase()}); setShowPlayerSuggestions(true); }} 
                    onFocus={() => setShowPlayerSuggestions(true)} 
                    onBlur={() => setTimeout(() => setShowPlayerSuggestions(false), 200)} 
                    placeholder="Nom" 
                    className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 outline-none focus:border-[#AFFF25]/50 transition-colors" 
                  />
                  {showPlayerSuggestions && formData.lastname && filteredPlayers.length > 0 && (
                    <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-xl">
                      {filteredPlayers.map((p: any, i: number) => (
                        <li key={i} onClick={() => { 
                          const parts = p.name.split(' ');
                          const fname = parts[0];
                          const lname = parts.slice(1).join(' ');
                          setFormData({
                            ...formData, 
                            firstname: fname.toUpperCase(), 
                            lastname: lname.toUpperCase(), 
                            club: p.team || formData.club 
                          }); 
                          setShowPlayerSuggestions(false); 
                        }} className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex flex-col gap-1 border-b border-white/5 last:border-0">
                          <span className="text-sm font-bold uppercase text-white">{p.name}</span>
                          {p.team && <span className="text-[10px] text-[#AFFF25]">{p.team}</span>}
                          {p.country && <span className="text-[10px] text-[#AFFF25]">{p.country}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                {/* Logos de club dynamiques */}
                <div className="relative">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Club / Équipe</label>
                  <div className="relative flex items-center">
                    {formData.club && <img src={`/asset/logo-club/${sportFolder}/${clubSlug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Club" />}
                    <input value={formData.club} onChange={e => { setFormData({...formData, club: e.target.value}); setShowClubSuggestions(true); }} onFocus={() => setShowClubSuggestions(true)} onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)} placeholder="Club" className={`w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm outline-none focus:border-[#AFFF25]/50 transition-colors ${formData.club ? 'pl-[44px]' : 'pl-4'}`} />
                    <Search className="absolute right-4 text-[#AFFF25] pointer-events-none" size={16} />
                  </div>
                  {showClubSuggestions && formData.club && filteredClubs.length > 0 && (
                    <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-xl">
                      {filteredClubs.slice(0, 20).map((c: any, i: number) => (
                        <li key={i} onClick={() => { setFormData({...formData, club: c.name}); setShowClubSuggestions(false); }} className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0">
                          <img src={`/asset/logo-club/${sportFolder}/${c.slug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="w-6 h-6" />
                          <span className="text-sm font-bold uppercase">{c.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section Carte */}
          <div>
            <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setIsCarteOpen(!isCarteOpen)}>
              <h2 className="text-2xl font-black italic uppercase">Carte</h2><div className="text-[#AFFF25]">{isCarteOpen ? <Minus size={22} /> : <Plus size={22} />}</div>
            </div>
            {isCarteOpen && (
              <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="relative">
                  {formData.brand && <img src={`/asset/brands/${brandSlug}.png`} onError={hideBrokenImage} className="absolute left-4 top-3.5 w-6 h-6 object-contain z-10" alt="Brand" />}
                  <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className={`w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors ${formData.brand ? 'pl-[44px]' : 'pl-4'}`}>
                    <option value="">Fabricant</option>
                    {availableBrands.map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-4 text-white/50 pointer-events-none" size={16} />
                </div>
                <div className="relative">
                  <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors"><option value="">Collection</option>{availableSets.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                  <ChevronDown className="absolute right-4 top-4 text-white/50 pointer-events-none" size={16} />
                </div>
                <div className="relative">
                  <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors"><option value="">Année</option>{yearsList.map(y => <option key={y} value={y}>{y}</option>)}</select>
                  <ChevronDown className="absolute right-4 top-4 text-white/50 pointer-events-none" size={16} />
                </div>
                
                <div className="bg-white/5 rounded-2xl p-4 space-y-3 border border-white/10 mt-2">
                  {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE', 'GRADÉE'].map((l) => {
                    let k = `is_${l.toLowerCase()}`;
                    if (l === 'NUMÉROTÉE') k = 'is_numbered';
                    if (l === 'GRADÉE') k = 'is_graded';
                    
                    const active = formData[k as keyof typeof formData];
                    return (
                      <div key={l} className="flex justify-between items-center px-1">
                        <span className="font-bold text-sm text-white/90">{l}</span>
                        <button onClick={() => setFormData({...formData, [k]: !active})} className={`w-12 h-6 rounded-full relative border transition-colors ${active ? 'border-[#AFFF25] bg-[#AFFF25]/20' : 'border-white/30 bg-black/20'}`}>
                          <div className={`absolute top-[3px] w-4 h-4 rounded-full transition-all duration-300 ${active ? 'right-1 bg-[#AFFF25]' : 'left-1 bg-white/50'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {formData.is_graded && (
                  <div className="flex items-center gap-4 animate-in fade-in duration-200">
                    <div className="relative w-1/2">
                      <select value={formData.grading_company} onChange={e => setFormData({...formData, grading_company: e.target.value})} className="w-full bg-[#040221] border border-[#AFFF25]/50 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25] transition-colors">
                        <option value="">Société</option>
                        {['PSA', 'PCA', 'Becket', 'Collect Aura', 'MTG', 'GCC'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-4 text-[#AFFF25]/50 pointer-events-none" size={16} />
                    </div>
                    <div className="relative w-1/2">
                      <select value={formData.grading_grade} onChange={e => setFormData({...formData, grading_grade: e.target.value})} className="w-full bg-[#040221] border border-[#AFFF25]/50 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25] transition-colors">
                        <option value="">Note</option>
                        {['10+', '10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', 'officielle'].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-4 text-[#AFFF25]/50 pointer-events-none" size={16} />
                    </div>
                  </div>
                )}
                
                {formData.is_numbered && (
                  <div className="flex items-center gap-4 justify-center animate-in fade-in duration-200 pt-2">
                    <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} placeholder="Ex: 5" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none focus:shadow-[0_0_10px_rgba(175,255,37,0.3)] transition-all" />
                    <span className="text-[#AFFF25] font-black text-2xl px-2">/</span>
                    <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} placeholder="Ex: 50" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none focus:shadow-[0_0_10px_rgba(175,255,37,0.3)] transition-all" />
                  </div>
                )}

                <div className="relative w-full pt-2">
                  <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Prix estimé / Prix d'achat" className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 pr-10 outline-none focus:border-[#AFFF25]/50 transition-colors" />
                  <span className="absolute right-5 top-5 text-[#AFFF25] font-bold">€</span>
                </div>
              </div>
            )}
          </div>

          {/* Bouton de sauvegarde */}
          <button disabled={loading || analyzing || !isFormStarted} onClick={saveCard} className={`w-full font-black italic py-4 rounded-full mt-6 mb-6 uppercase flex justify-center items-center gap-2 transition-all duration-300 ${isFormStarted ? 'bg-[#AFFF25] text-[#040221] shadow-[0_10px_40px_rgba(175,255,37,0.3)] hover:bg-[#9ee615] active:scale-95' : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="animate-spin" /> : 
              editId ? 'Mettre à jour' : 
              (scanMode === 'lot' && currentBulkIndex < bulkFiles.length - 1) ? `Valider & Suivant (${currentBulkIndex + 1}/${bulkFiles.length})` : 
              (scanMode === 'lot' ? `Terminer (${currentBulkIndex + 1}/${bulkFiles.length})` : 'Enregistrer')
            }
          </button>
        </div>
      </div>
      
      {/* INPUTS NATIFS MASQUÉS (1 pour l'appareil photo direct, 1 pour la galerie) */}
      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
      <input type="file" ref={galleryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple={activeSide === 'front' && scanMode === 'lot'} />
    </div>
  );
}