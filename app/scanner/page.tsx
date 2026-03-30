'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus, Trash2, RotateCw, SlidersHorizontal, Wand2, X, Check, Camera, Image as ImageIcon, Crop, ArrowRight } from 'lucide-react';

import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import BASKETBALL_CLUBS from '@/data/basketball-clubs.json';
import BASEBALL_CLUBS from '@/data/baseball-clubs.json';
import NBA_PLAYERS from '@/data/nba-player.json';
import MLB_PLAYERS from '@/data/mlb-player.json';
import TENNIS_PLAYERS from '@/data/tennis-player.json';

import SET_DATA from '@/data/set.json';
import TYPE_CARTE from '@/data/type-carte.json';

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

const ALL_BRANDS = (SET_DATA.brands || []).map((b: any) => b.name);

let ALL_SETS: string[] = [];
(SET_DATA.brands || []).forEach((b: any) => {
  if (b.sports) {
    Object.values(b.sports).forEach((arr: any) => {
      if (Array.isArray(arr)) ALL_SETS.push(...arr);
    });
  }
});
ALL_SETS = Array.from(new Set(ALL_SETS));

let ALL_VARIATIONS: string[] = [];
Object.values(TYPE_CARTE).forEach((bData: any) => {
  if (bData.base) ALL_VARIATIONS.push(...bData.base);
  if (bData.parallels) {
    Object.values(bData.parallels).forEach((arr: any) => {
      if (Array.isArray(arr)) ALL_VARIATIONS.push(...arr);
    });
  }
  if (bData.inserts) ALL_VARIATIONS.push(...bData.inserts);
  if (bData.hits) ALL_VARIATIONS.push(...bData.hits);
  if (bData.case_hits) ALL_VARIATIONS.push(...bData.case_hits);
});
ALL_VARIATIONS = Array.from(new Set(ALL_VARIATIONS));

const DEFAULT_FORM = { sport: '', firstname: '', lastname: '', club: '', brand: '', series: '', variation: '', year: '', is_auto: false, is_patch: false, is_rookie: false, is_numbered: false, num_low: '', num_high: '', price: '', website_url: '', is_graded: false, grading_company: '', grading_grade: '' };

type PendingCard = {
  id: string;
  file: File;
  previewUrl: string;
  originalFile: File;        
  originalPreviewUrl: string; 
  status: 'pending' | 'analyzing' | 'done' | 'error';
  aiResult: any;
};

const formatLabel = (str: string) => str.replace(/_/g, ' ').toUpperCase();

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

  const [scanMode, setScanMode] = useState<'unitaire' | 'lot' | 'auto'>('unitaire');
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([]);
  const [currentVerifyIndex, setCurrentVerifyIndex] = useState(0);
  const [isVerifyingBulk, setIsVerifyingBulk] = useState(false);

  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  
  const [isFetchingEdit, setIsFetchingEdit] = useState(!!editId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null); 
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null); 

  const [previewUrlBack, setPreviewUrlBack] = useState<string | null>(null);
  const [selectedFileBack, setSelectedFileBack] = useState<File | null>(null);
  const [originalFileBack, setOriginalFileBack] = useState<File | null>(null); 
  const [originalPreviewUrlBack, setOriginalPreviewUrlBack] = useState<string | null>(null); 

  const [freeCropImage, setFreeCropImage] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState({ top: 10, left: 10, right: 90, bottom: 90 });
  const [draggingCorner, setDraggingCorner] = useState<string | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const freeCropCallbackRef = useRef<((file: File, url: string) => void) | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [imgSettings, setImgSettings] = useState({ brightness: 100, contrast: 100, zoom: 1 });

  const [showClubSuggestions, setShowClubSuggestions] = useState(false);
  const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
  
  const [isJoueurOpen, setIsJoueurOpen] = useState(true);
  const [isCarteOpen, setIsCarteOpen] = useState(true);

  const [formData, setFormData] = useState(DEFAULT_FORM);
  const yearsList = Array.from({ length: 2027 - 1994 + 1 }, (_, i) => 2027 - i);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraZoom, setCameraZoom] = useState(1);
  const [nativeZoomSupported, setNativeZoomSupported] = useState(false);

  const [autoScanProgress, setAutoScanProgress] = useState(0);
  const autoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const motionLoopRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  const scanModeRef = useRef(scanMode);
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);
  const isFlashingRef = useRef(isFlashing);
  useEffect(() => { isFlashingRef.current = isFlashing; }, [isFlashing]);
  const captureRef = useRef(() => {});

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
            variation: data.variation || '', 
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
          setPreviewUrlBack(data.image_url_back || null);
        }
        setIsFetchingEdit(false);
      };
      fetchCardForEdit();
    }
  }, [editId]);

  useEffect(() => { return () => stopCamera(); }, []);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Erreur lecture vidéo:", e));
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (!isCameraOpen || scanMode !== 'auto') {
      if (motionLoopRef.current) cancelAnimationFrame(motionLoopRef.current);
      setAutoScanProgress(0);
      return;
    }

    if (!autoCanvasRef.current) {
      autoCanvasRef.current = document.createElement('canvas');
      autoCanvasRef.current.width = 64; 
      autoCanvasRef.current.height = 64;
    }
    const ctx = autoCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const checkMotion = () => {
      if (!videoRef.current || isFlashingRef.current || isVerifyingBulk || scanModeRef.current !== 'auto') {
        motionLoopRef.current = requestAnimationFrame(checkMotion);
        return;
      }

      if (Date.now() - lastCaptureTimeRef.current < 1500) {
        stableSinceRef.current = Date.now();
        setAutoScanProgress(0);
        motionLoopRef.current = requestAnimationFrame(checkMotion);
        return;
      }

      ctx.drawImage(videoRef.current, 0, 0, 64, 64);
      const currentData = ctx.getImageData(0, 0, 64, 64).data;
      let diff = 0;

      if (prevFrameRef.current) {
        for (let i = 0; i < currentData.length; i += 16) {
          diff += Math.abs(currentData[i] - prevFrameRef.current[i]);     
          diff += Math.abs(currentData[i+1] - prevFrameRef.current[i+1]); 
          diff += Math.abs(currentData[i+2] - prevFrameRef.current[i+2]); 
        }
      }
      prevFrameRef.current = new Uint8ClampedArray(currentData);

      const threshold = 30000;

      if (diff > threshold) {
        stableSinceRef.current = Date.now();
        setAutoScanProgress(0);
      } else {
        if (!stableSinceRef.current) stableSinceRef.current = Date.now();
        const stableTime = Date.now() - stableSinceRef.current;
        const progress = Math.min(100, (stableTime / 1500) * 100);
        setAutoScanProgress(progress);

        if (progress >= 100) {
          captureRef.current(); 
          lastCaptureTimeRef.current = Date.now();
          stableSinceRef.current = Date.now();
          setAutoScanProgress(0);
        }
      }

      motionLoopRef.current = requestAnimationFrame(checkMotion);
    };

    motionLoopRef.current = requestAnimationFrame(checkMotion);

    return () => {
      if (motionLoopRef.current) cancelAnimationFrame(motionLoopRef.current);
    }
  }, [isCameraOpen, scanMode, isVerifyingBulk]);

  useEffect(() => {
    if (isVerifyingBulk && pendingCards.length > 0) {
      const currentCard = pendingCards[currentVerifyIndex];
      setSelectedFile(currentCard.file);
      setPreviewUrl(currentCard.previewUrl);
      
      setOriginalFile(currentCard.originalFile);
      setOriginalPreviewUrl(currentCard.originalPreviewUrl);

      setSelectedFileBack(null);
      setPreviewUrlBack(null);

      if (currentCard.status === 'done' && currentCard.aiResult) {
        setFormData({ ...DEFAULT_FORM, ...currentCard.aiResult });
        setAnalyzing(false);
      } else if (currentCard.status === 'analyzing') {
        setFormData(DEFAULT_FORM);
        setAnalyzing(true);
      } else {
        setFormData(DEFAULT_FORM);
        setAnalyzing(false);
      }
    }
  }, [isVerifyingBulk, currentVerifyIndex, pendingCards]);

  useEffect(() => {
    const handleMove = (e: TouchEvent | MouseEvent) => {
        if (!draggingCorner || !cropContainerRef.current) return;
        if (e.cancelable) e.preventDefault();
        
        const rect = cropContainerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        let xPct = ((clientX - rect.left) / rect.width) * 100;
        let yPct = ((clientY - rect.top) / rect.height) * 100;

        xPct = Math.max(0, Math.min(100, xPct));
        yPct = Math.max(0, Math.min(100, yPct));

        setCropRect(prev => {
            let r = { ...prev };
            const MIN_SIZE = 10; 
            if (draggingCorner.includes('l')) r.left = Math.min(xPct, r.right - MIN_SIZE);
            if (draggingCorner.includes('r')) r.right = Math.max(xPct, r.left + MIN_SIZE);
            if (draggingCorner.includes('t')) r.top = Math.min(yPct, r.bottom - MIN_SIZE);
            if (draggingCorner.includes('b')) r.bottom = Math.max(yPct, r.top + MIN_SIZE);
            return r;
        });
    };
    const handleUp = () => setDraggingCorner(null);

    if (draggingCorner) {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
    }
  }, [draggingCorner]);

  const getLocalImageUrl = async (url: string | null, file: File | null) => {
      if (!url) return null;
      if (!file && url.startsWith('http')) {
          const body = new FormData();
          body.append("action", "proxy");
          body.append("imageUrl", url);
          const res = await fetch("/api/scan", { method: "POST", body });
          const data = await res.json();
          return data.base64 ? data.base64 : url;
      } else if (file) {
          return URL.createObjectURL(file);
      }
      return url;
  };

  const normalizeClubName = (str: string) => {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/\b(fc|sc|ac|rc|as|cf|osc|united|city)\b/g, '') 
      .replace(/[^\w\s]/g, '') 
      .trim();
  };

  const matchClubWithAliases = (rawClub: string, sport: string) => {
    if (!rawClub || !sport) return rawClub;
    const clubs = CLUB_DATA[sport];
    if (!Array.isArray(clubs)) return rawClub;

    const searchNorm = normalizeClubName(rawClub);
    const rawClean = rawClub.toLowerCase().trim();

    for (const c of clubs) {
      if (c.name.toLowerCase().trim() === rawClean) return c.name;
      if (c.aliases && c.aliases.some((a: string) => a.toLowerCase().trim() === rawClean)) return c.name;
      const nameNorm = normalizeClubName(c.name);
      if (nameNorm && searchNorm && nameNorm === searchNorm) return c.name;
      if (c.aliases && c.aliases.some((a: string) => {
          const aNorm = normalizeClubName(a);
          return aNorm && searchNorm && aNorm === searchNorm;
      })) return c.name;
    }
    
    return rawClub;
  };

  const safeClubs = Array.isArray(CLUB_DATA[formData.sport]) ? CLUB_DATA[formData.sport] : [];
  const searchStrNorm = normalizeClubName(formData.club);

  const filteredClubs = safeClubs.filter((c: any) => {
    const nameNorm = normalizeClubName(c.name);
    const slugNorm = normalizeClubName(c.slug);
    const matchName = nameNorm.includes(searchStrNorm) || searchStrNorm.includes(nameNorm);
    const matchSlug = slugNorm.includes(searchStrNorm) || searchStrNorm.includes(slugNorm);
    const matchAlias = c.aliases ? c.aliases.some((alias: string) => normalizeClubName(alias).includes(searchStrNorm) || searchStrNorm.includes(normalizeClubName(alias))) : false;
    return matchName || matchSlug || matchAlias;
  }).sort((a: any, b: any) => { 
    if (a.name.toLowerCase().startsWith(formData.club.toLowerCase())) return -1; 
    return 1; 
  });

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

  const currentBrandVariations = (formData.brand && (TYPE_CARTE as any)[formData.brand]) ? (TYPE_CARTE as any)[formData.brand] : null;

  const sportImage = formData.sport ? SPORT_CONFIG[formData.sport]?.image : null;
  const brandSlug = formData.brand ? formData.brand.toLowerCase().replace(/\s+/g, '-') : '';
  const isFormStarted = Object.values(formData).some(val => (typeof val === 'string' && val.trim() !== '') || (typeof val === 'boolean' && val === true));

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCameraZoom(1); 
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840, min: 1920 }, height: { ideal: 2160, min: 1080 }, frameRate: { ideal: 30 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : null;
      if (capabilities && capabilities.zoom) {
        setNativeZoomSupported(true);
      } else {
        setNativeZoomSupported(false);
      }

    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        streamRef.current = fallbackStream;
        if (videoRef.current) videoRef.current.srcObject = fallbackStream;
      } catch (fallbackErr) {
        alert("Impossible d'accéder à la caméra. Vérifiez vos permissions.");
        setIsCameraOpen(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    setIsCameraOpen(false);
    setCameraZoom(1);
    setAutoScanProgress(0);
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCameraZoom(val);

    if (nativeZoomSupported && streamRef.current) {
      try {
        const track = streamRef.current.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        const min = capabilities.zoom?.min || 1;
        const max = capabilities.zoom?.max || 3;
        const safeVal = Math.max(min, Math.min(max, val));
        await track.applyConstraints({ advanced: [{ zoom: safeVal }] } as any);
      } catch (err) {
        console.warn("Échec du zoom natif, bascule vers le zoom numérique", err);
        setNativeZoomSupported(false); 
      }
    }
  };

  const matchExactCase = (rawString: string, validList: string[]) => {
    if (!rawString) return '';
    const rawClean = rawString.toLowerCase().trim();
    const found = validList.find(item => item.toLowerCase().trim() === rawClean);
    return found || rawString;
  };

  const processBackgroundScan = async (id: string, file: File) => {
    try {
      const body = new FormData(); body.append("image", file);
      body.append("auto_crop", "true"); 

      const res = await fetch("/api/scan", { method: "POST", body }); 
      const data = await res.json();
      
      if (!data.error) {
        const cleanValue = (val: any) => {
          if (!val) return '';
          const str = String(val).trim().toLowerCase();
          if (['n/a', 'na', 'none', 'inconnu', 'brand', 'null', 'undefined', '-', 'unknown'].includes(str)) return '';
          return String(val).trim();
        };

        const cleanPlayerName = cleanValue(data.playerName);
        let fname = ''; let lname = '';
        if (cleanPlayerName) {
          const parts = cleanPlayerName.split(' ');
          fname = parts[0]?.toUpperCase() || '';
          lname = parts.slice(1).join(' ')?.toUpperCase() || '';
        }

        let aiSport = cleanValue(data.sport).toUpperCase();
        if (aiSport === 'FOOTBALL') aiSport = 'SOCCER';

        const aiData = {
          sport: aiSport,
          firstname: fname,
          lastname: lname,
          club: matchClubWithAliases(cleanValue(data.club), aiSport),
          brand: matchExactCase(cleanValue(data.brand), ALL_BRANDS),
          series: matchExactCase(cleanValue(data.series), ALL_SETS),
          variation: matchExactCase(cleanValue(data.variation), ALL_VARIATIONS),
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
        };

        setPendingCards(prev => prev.map(c => c.id === id ? { ...c, status: 'done', aiResult: aiData } : c));

        if (data.cropped_image_base64) {
          const resBlob = await fetch(`data:image/jpeg;base64,${data.cropped_image_base64}`);
          const blob = await resBlob.blob();
          const croppedFile = new File([blob], `auto-cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const newPreviewUrl = URL.createObjectURL(croppedFile);
          
          setPendingCards(prev => prev.map(c => c.id === id ? { ...c, file: croppedFile, previewUrl: newPreviewUrl } : c));
          
          if (pendingCards[currentVerifyIndex]?.id === id) {
            setSelectedFile(croppedFile);
            setPreviewUrl(newPreviewUrl);
          }
        }

      } else {
        setPendingCards(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
      }
    } catch (err) { setPendingCards(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c)); }
  };

  const captureImageAndCrop = () => {
    if (!videoRef.current || !guideRef.current) return;
    
    setIsFlashing(true); 
    setTimeout(() => setIsFlashing(false), 150);
    
    const video = videoRef.current; 
    const guide = guideRef.current;
    
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
    const guideRect = guide.getBoundingClientRect();
    
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    if (!vW || !vH) return; 

    const vRatio = vW / vH;
    const cRatio = containerW / containerH;

    let renderWidth, renderHeight;
    if (cRatio > vRatio) {
      renderWidth = containerW;
      renderHeight = containerW / vRatio;
    } else {
      renderHeight = containerH;
      renderWidth = containerH * vRatio;
    }

    const zoom = nativeZoomSupported ? 1 : cameraZoom;
    renderWidth *= zoom;
    renderHeight *= zoom;

    const offsetX = (containerW - renderWidth) / 2;
    const offsetY = (containerH - renderHeight) / 2;

    const guideLeft = guideRect.left - offsetX;
    const guideTop = guideRect.top - offsetY;

    const scale = vW / renderWidth;

    const cropX = Math.max(0, guideLeft * scale);
    const cropY = Math.max(0, guideTop * scale);
    const cropW = Math.min(vW - cropX, guideRect.width * scale);
    const cropH = Math.min(vH - cropY, guideRect.height * scale);

    const canvas = document.createElement('canvas'); 
    canvas.width = cropW; 
    canvas.height = cropH;
    
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true; 
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fullImageFile = new File([blob], `scanned-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const fullUrl = URL.createObjectURL(fullImageFile);
      
      if ((scanModeRef.current === 'lot' || scanModeRef.current === 'auto') && activeSide === 'front') {
        const newId = Date.now().toString() + Math.random().toString();
        const newCard: PendingCard = { id: newId, file: fullImageFile, previewUrl: fullUrl, originalFile: fullImageFile, originalPreviewUrl: fullUrl, status: 'analyzing', aiResult: null };
        setPendingCards(prev => [...prev, newCard]);
        processBackgroundScan(newId, fullImageFile);
      } else {
        stopCamera();
        if (activeSide === 'front') {
            setOriginalFile(fullImageFile);
            setOriginalPreviewUrl(fullUrl);
        } else {
            setOriginalFileBack(fullImageFile);
            setOriginalPreviewUrlBack(fullUrl);
        }
        processImageScan(fullImageFile, activeSide, activeSide === 'front'); 
      }
    }, 'image/jpeg', 1.0);
  };

  useEffect(() => { captureRef.current = captureImageAndCrop; });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (files.length > 1 && activeSide === 'front') {
      if (files.length > 30) { alert("Max 30 cartes"); return; }
      const newPending: PendingCard[] = files.map((f, i) => {
        const url = URL.createObjectURL(f);
        return { id: Date.now().toString() + i, file: f, previewUrl: url, originalFile: f, originalPreviewUrl: url, status: 'analyzing', aiResult: null };
      });
      setPendingCards(newPending); setIsVerifyingBulk(true); setCurrentVerifyIndex(0);
      newPending.forEach(c => processBackgroundScan(c.id, c.file));
    } else {
      const file = files[0];
      const url = URL.createObjectURL(file);
      
      if (activeSide === 'back') {
          setOriginalFileBack(file);
          setOriginalPreviewUrlBack(url);
          processImageScan(file, 'back', false);
      } else {
          setOriginalFile(file);
          setOriginalPreviewUrl(url);
          if (scanMode === 'lot' || scanMode === 'auto') {
              setBulkFiles([file]); setCurrentBulkIndex(0);
          }
          processImageScan(file, 'front', true);
      }
    }
  };

  const applyFreeCrop = async () => {
    if (!freeCropImage) return;
    setIsApplyingEdit(true);
    
    const img = new Image(); 
    img.src = freeCropImage;
    await new Promise(r => { img.onload = r; });

    const canvas = document.createElement('canvas'); 
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    
    const cX = (cropRect.left / 100) * img.width;
    const cY = (cropRect.top / 100) * img.height;
    const cW = ((cropRect.right - cropRect.left) / 100) * img.width;
    const cH = ((cropRect.bottom - cropRect.top) / 100) * img.height;

    canvas.width = cW; 
    canvas.height = cH;
    ctx.drawImage(img, cX, cY, cW, cH, 0, 0, cW, cH);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const newFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const newUrl = URL.createObjectURL(newFile);
      
      if (freeCropCallbackRef.current) {
          freeCropCallbackRef.current(newFile, newUrl);
      }
      
      setFreeCropImage(null);
      setIsApplyingEdit(false);
    }, 'image/jpeg', 0.95);
  };

  const openManualCrop = async () => {
      const currentOriginalPreview = activeSide === 'front' ? (originalPreviewUrl || previewUrl) : (originalPreviewUrlBack || previewUrlBack);
      let currentOriginalBlob = activeSide === 'front' ? (originalFile || selectedFile) : (originalFileBack || selectedFileBack);
      
      const localSrc = await getLocalImageUrl(currentOriginalPreview, currentOriginalBlob);
      if (!localSrc) return;
      
      setFreeCropImage(localSrc); 
      setCropRect({ top: 10, left: 10, right: 90, bottom: 90 });
      
      freeCropCallbackRef.current = (file, newUrl) => {
          if (activeSide === 'front') {
              setSelectedFile(file);
              setPreviewUrl(newUrl);
          } else {
              setSelectedFileBack(file);
              setPreviewUrlBack(newUrl);
          }
          if (isVerifyingBulk) {
              setPendingCards(prev => prev.map((c, idx) => idx === currentVerifyIndex ? { ...c, file: file, previewUrl: newUrl } : c));
          }
          
          // 🌟 SÉCURITÉ : Ne relance l'IA QUE si on est en train de créer une nouvelle carte, pas en Mode Édition !
          if (!editId) {
             processImageScan(file, activeSide, false);
          }
      };
  };

  const processImageScan = async (file: File, side: 'front' | 'back', resetForm: boolean = false) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const currentUrl = formData.website_url;

    if (side === 'front') {
      setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); 
      if (resetForm) setFormData({ ...DEFAULT_FORM, website_url: currentUrl });
    } else {
      setSelectedFileBack(file); setPreviewUrlBack(URL.createObjectURL(file));
    }
    
    setAnalyzing(true);
    try {
      const body = new FormData(); body.append("image", file);
      body.append("auto_crop", "true"); 

      const res = await fetch("/api/scan", { method: "POST", body }); 
      const data = await res.json();
      
      if (!data.error) {
        
        if (data.cropped_image_base64) {
          const resBlob = await fetch(`data:image/jpeg;base64,${data.cropped_image_base64}`);
          const blob = await resBlob.blob();
          const croppedFile = new File([blob], `auto-cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const newPreviewUrl = URL.createObjectURL(croppedFile);
          
          if (side === 'front') {
            setSelectedFile(croppedFile);
            setPreviewUrl(newPreviewUrl);
          } else {
            setSelectedFileBack(croppedFile);
            setPreviewUrlBack(newPreviewUrl);
          }
        }

        const cleanValue = (val: any) => {
          if (!val) return '';
          const str = String(val).trim().toLowerCase();
          if (['n/a', 'na', 'none', 'inconnu', 'brand', 'null', 'undefined', '-', 'unknown'].includes(str)) return '';
          return String(val).trim();
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
          
          const matchedClub = matchClubWithAliases(cleanValue(data.club), aiSport);
          
          if (side === 'front') {
            return {
              ...prev, sport: aiSport || prev.sport, firstname: fname || prev.firstname, lastname: lname || prev.lastname, club: matchedClub || prev.club, brand: matchExactCase(cleanValue(data.brand), ALL_BRANDS) || prev.brand, series: matchExactCase(cleanValue(data.series), ALL_SETS) || prev.series, variation: matchExactCase(cleanValue(data.variation), ALL_VARIATIONS) || prev.variation, year: cleanValue(data.year) || prev.year, is_auto: !!data.is_auto || prev.is_auto, is_patch: !!data.is_patch || prev.is_patch, is_rookie: !!data.is_rookie || prev.is_rookie, is_numbered: !!data.is_numbered || prev.is_numbered, num_low: cleanValue(data.num_low) || prev.num_low, num_high: cleanValue(data.num_high) || prev.num_high, is_graded: !!data.is_graded || prev.is_graded, grading_company: cleanValue(data.grading_company) || prev.grading_company, grading_grade: cleanValue(data.grading_grade) || prev.grading_grade
            };
          } else {
            return {
              ...prev, sport: prev.sport || aiSport, firstname: prev.firstname || fname, lastname: prev.lastname || lname, club: prev.club || matchedClub, brand: prev.brand || matchExactCase(cleanValue(data.brand), ALL_BRANDS), series: prev.series || matchExactCase(cleanValue(data.series), ALL_SETS), variation: prev.variation || matchExactCase(cleanValue(data.variation), ALL_VARIATIONS), year: prev.year || cleanValue(data.year), is_auto: prev.is_auto || !!data.is_auto, is_patch: prev.is_patch || !!data.is_patch, is_rookie: prev.is_rookie || !!data.is_rookie, is_numbered: prev.is_numbered || !!data.is_numbered, num_low: prev.num_low || cleanValue(data.num_low), num_high: prev.num_high || cleanValue(data.num_high), is_graded: prev.is_graded || !!data.is_graded, grading_company: prev.grading_company || cleanValue(data.grading_company), grading_grade: prev.grading_grade || cleanValue(data.grading_grade)
            };
          }
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
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: formData.website_url }) });
      const data = await res.json();
      if (data.base64) {
        const imgRes = await fetch(data.base64); const blob = await imgRes.blob(); const file = new File([blob], `scraped-${Date.now()}.jpg`, { type: blob.type });
        if (data.price) setFormData(prev => ({ ...prev, price: data.price }));
        
        setOriginalFile(file);
        setOriginalPreviewUrl(URL.createObjectURL(file));
        
        processImageScan(file, 'front', false); 
      } else { alert("Impossible de trouver une image sur ce lien."); setAnalyzing(false); }
    } catch (err) { alert("Erreur lors de l'importation du lien."); setAnalyzing(false); }
  };

  const rotateImage = async () => {
    const currentPreview = activeSide === 'front' ? previewUrl : previewUrlBack;
    if (!currentPreview) return;
    setIsApplyingEdit(true);
    
    try {
      let localSrc = currentPreview;
      let currentBlob: Blob | File | null = activeSide === 'front' ? selectedFile : selectedFileBack;

      if (!currentBlob && currentPreview.startsWith('http')) {
          const body = new FormData();
          body.append("action", "proxy");
          body.append("imageUrl", currentPreview);
          const res = await fetch("/api/scan", { method: "POST", body });
          const data = await res.json();
          if (data.base64) localSrc = data.base64;
      } else if (currentBlob) {
          localSrc = URL.createObjectURL(currentBlob);
      }

      const img = new Image();
      img.src = localSrc;
      await new Promise(r => { img.onload = r; });

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
          const newFile = new File([blob], `rotated-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const newUrl = URL.createObjectURL(newFile);
          
          if (activeSide === 'front') { 
            setSelectedFile(newFile); 
            setPreviewUrl(newUrl); 
          } else { 
            setSelectedFileBack(newFile); 
            setPreviewUrlBack(newUrl); 
          }
          setIsApplyingEdit(false);
          
          // 🌟 SÉCURITÉ : Pas de rescan en mode modification
          if (!editId) {
             processImageScan(newFile, activeSide, false);
          }
      }, 'image/jpeg', 0.95);
    } catch(e) {
      setIsApplyingEdit(false);
    }
  };

  const applyImageEdits = async () => {
    const currentPreview = activeSide === 'front' ? previewUrl : previewUrlBack;
    if (!currentPreview) return;
    setIsApplyingEdit(true);
    
    try {
      let localSrc = currentPreview;
      let currentBlob: Blob | File | null = activeSide === 'front' ? selectedFile : selectedFileBack;

      if (!currentBlob && currentPreview.startsWith('http')) {
          const body = new FormData();
          body.append("action", "proxy");
          body.append("imageUrl", currentPreview);
          const res = await fetch("/api/scan", { method: "POST", body });
          const data = await res.json();
          if (data.base64) localSrc = data.base64;
      } else if (currentBlob) {
          localSrc = URL.createObjectURL(currentBlob);
      }

      const img = new Image();
      img.src = localSrc;
      await new Promise(r => { img.onload = r; });

      const canvas = document.createElement('canvas');
      const scale = imgSettings.zoom;
      
      const sw = img.width / scale;
      const sh = img.height / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;

      canvas.width = sw;
      canvas.height = sh;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const b = imgSettings.brightness / 100;
      const c = imgSettings.contrast / 100;
      const intercept = 128 * (1 - c);

      for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let bl = data[i + 2];

          r *= b; g *= b; bl *= b;

          r = r * c + intercept;
          g = g * c + intercept;
          bl = bl * c + intercept;

          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, bl));
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
          if (!blob) return;
          const newFile = new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const newUrl = URL.createObjectURL(newFile);
          
          if (activeSide === 'front') { 
            setSelectedFile(newFile); 
            setPreviewUrl(newUrl); 
          } else { 
            setSelectedFileBack(newFile); 
            setPreviewUrlBack(newUrl); 
          }

          if (isVerifyingBulk) {
            setPendingCards(prev => prev.map((card, idx) => idx === currentVerifyIndex ? { 
              ...card, file: newFile, previewUrl: newUrl 
            } : card));
          }
          
          setShowEditor(false);
          setImgSettings({ brightness: 100, contrast: 100, zoom: 1 });
          setIsApplyingEdit(false);

          // 🌟 SÉCURITÉ : Pas de rescan en mode modification
          if (!editId) {
             processImageScan(newFile, activeSide, false);
          }
      }, 'image/jpeg', 0.95);
    } catch(e) {
      console.error(e);
      setIsApplyingEdit(false);
    }
  };

  const handleAutoEnhance = () => setImgSettings(prev => ({ ...prev, brightness: 110, contrast: 115 }));

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image(); img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas'); const MAX_WIDTH = 1000; const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize < 1) { canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; } 
        else { canvas.width = img.width; canvas.height = img.height; }
        const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
          else resolve(file);
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
        user_id: user.id, sport: formData.sport, firstname: formData.firstname, lastname: formData.lastname, brand: formData.brand, 
        series: formData.series, variation: formData.variation, year: parseInt(formData.year) || null, is_rookie: formData.is_rookie, is_auto: formData.is_auto, is_patch: formData.is_patch, is_numbered: formData.is_numbered, numbering_low: parseInt(formData.num_low) || null, numbering_max: parseInt(formData.num_high) || null, purchase_price: parseFloat(formData.price) || 0, image_url: finalImageUrl, image_url_back: finalImageUrlBack, club_name: formData.club, is_wishlist: isWishlistMode, website_url: formData.website_url, is_graded: formData.is_graded, grading_company: formData.is_graded ? formData.grading_company : null, grading_grade: formData.is_graded ? formData.grading_grade : null
      };
      
      let currentCardId = editId;

      if (editId) {
         await supabase.from('cards').update(cardDataToSave).eq('id', editId);
      } else {
         const { data, error } = await supabase.from('cards').insert([cardDataToSave]).select('id');
         if (data && data.length > 0) {
             currentCardId = data[0].id;
         }
      }

      const hasBasicInfo = formData.firstname && formData.lastname && formData.year && formData.brand && formData.series && formData.variation;
      const hasNumberingIfRequired = !formData.is_numbered || (formData.is_numbered && formData.num_high);

      if (hasBasicInfo && hasNumberingIfRequired && currentCardId && !isWishlistMode) {
         const formatStr = (val: any) => {
            if (!val) return '';
            const str = String(val).toUpperCase().trim();
            if (str === '-' || str === 'NC' || str === 'N/A' || str === 'EMPTY') return '';
            return str;
         };

         let formattedYear = formData.year;
         if (!['TENNIS', 'BASEBALL', 'F1'].includes(formData.sport) && formData.year && /^\d{4}$/.test(formData.year.toString())) {
           const yearNum = parseInt(formData.year, 10);
           const prevYear = yearNum - 1;
           const shortYear = formData.year.toString().slice(-2);
           formattedYear = `${prevYear}-${shortYear}`;
         }

         const keywordsArray = [
           formatStr(formattedYear), formatStr(formData.brand), formatStr(formData.series), 
           formatStr(formData.firstname), formatStr(formData.lastname), formatStr(formData.variation), 
           formData.is_auto ? 'Auto' : '', formData.is_patch ? 'Patch' : '', 
           formData.is_numbered && formData.num_high ? formatStr(formData.num_high) : ''
         ];
         
         const keywords = keywordsArray.filter(Boolean).join(' ');

         fetch('/api/price-update', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ cardId: currentCardId, keywords })
         }).catch(() => {});
      }

      if (isVerifyingBulk) {
        if (currentVerifyIndex < pendingCards.length - 1) {
          setLoading(false); setCurrentVerifyIndex(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' });
        } else { router.push(isWishlistMode ? '/wishlist' : '/collection'); }
      } else {
        router.push(isWishlistMode ? '/wishlist' : '/collection');
      }
    } catch (err) { console.error(err); setLoading(false); }
  };

  const discardCurrentBulkCard = () => {
    if (pendingCards.length <= 1) {
      setPendingCards([]);
      setIsVerifyingBulk(false);
      setScanMode('unitaire');
      setFormData(DEFAULT_FORM);
      setPreviewUrl(null);
      setSelectedFile(null);
      setOriginalFile(null);
      setOriginalPreviewUrl(null);
      setPreviewUrlBack(null);
      setSelectedFileBack(null);
      setOriginalFileBack(null);
      setOriginalPreviewUrlBack(null);
    } else {
      const newPending = [...pendingCards];
      newPending.splice(currentVerifyIndex, 1);
      setPendingCards(newPending);
      
      if (currentVerifyIndex >= newPending.length) {
        setCurrentVerifyIndex(newPending.length - 1);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeImage = (side: 'front' | 'back') => {
    setActiveSide(side);
    if (side === 'front') { 
        setPreviewUrl(null); 
        setSelectedFile(null); 
        setOriginalFile(null);
        setOriginalPreviewUrl(null);
    } 
    else { 
        setPreviewUrlBack(null); 
        setSelectedFileBack(null); 
        setOriginalFileBack(null);
        setOriginalPreviewUrlBack(null);
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
  const activePreviewUrl = activeSide === 'front' ? previewUrl : previewUrlBack;

  return (
    <div className="min-h-screen text-white font-sans relative overflow-x-hidden bg-[#040221]">
      
      {freeCropImage && !analyzing && !isVerifyingBulk && (
        <div className="fixed inset-0 z-[200] bg-[#040221] flex flex-col items-center justify-between pt-[calc(1.5rem+env(safe-area-inset-top))] pb-32 overflow-hidden">
          
          <h2 className="text-xl font-black italic text-[#AFFF25] tracking-widest uppercase mb-4">Recadrer</h2>
          
          <div className="relative w-full h-[55vh] max-w-lg flex items-center justify-center">
              {/* 🌟 LE CORRECTIF CSS : La boîte moule l'image au pixel près ! */}
              <div className="relative max-w-full max-h-full" ref={cropContainerRef} style={{ width: 'fit-content', height: 'fit-content' }}>
                  <img src={freeCropImage} className="w-auto h-auto max-w-full max-h-[55vh] pointer-events-none block" alt="To Crop" />
                  
                  <div className="absolute inset-0 z-10 touch-none">
                     <div className="absolute top-0 left-0 right-0 bg-black/70" style={{ height: `${cropRect.top}%` }} />
                     <div className="absolute bottom-0 left-0 right-0 bg-black/70" style={{ height: `${100 - cropRect.bottom}%` }} />
                     <div className="absolute top-0 bottom-0 left-0 bg-black/70" style={{ top: `${cropRect.top}%`, bottom: `${100 - cropRect.bottom}%`, width: `${cropRect.left}%` }} />
                     <div className="absolute top-0 bottom-0 right-0 bg-black/70" style={{ top: `${cropRect.top}%`, bottom: `${100 - cropRect.bottom}%`, width: `${100 - cropRect.right}%` }} />

                     <div className="absolute border-2 border-[#AFFF25]" style={{ top: `${cropRect.top}%`, bottom: `${100 - cropRect.bottom}%`, left: `${cropRect.left}%`, right: `${100 - cropRect.right}%` }}>
                         <div onTouchStart={() => setDraggingCorner('tl')} onMouseDown={() => setDraggingCorner('tl')} className="absolute -top-4 -left-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize"><div className="w-4 h-4 bg-[#AFFF25] rounded-full" /></div>
                         <div onTouchStart={() => setDraggingCorner('tr')} onMouseDown={() => setDraggingCorner('tr')} className="absolute -top-4 -right-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize"><div className="w-4 h-4 bg-[#AFFF25] rounded-full" /></div>
                         <div onTouchStart={() => setDraggingCorner('bl')} onMouseDown={() => setDraggingCorner('bl')} className="absolute -bottom-4 -left-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize"><div className="w-4 h-4 bg-[#AFFF25] rounded-full" /></div>
                         <div onTouchStart={() => setDraggingCorner('br')} onMouseDown={() => setDraggingCorner('br')} className="absolute -bottom-4 -right-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize"><div className="w-4 h-4 bg-[#AFFF25] rounded-full" /></div>
                     </div>
                  </div>
              </div>
          </div>

          <div className="w-full flex justify-center gap-4 mt-8 px-8 z-20">
              <button onClick={() => setFreeCropImage(null)} className="w-[140px] py-3.5 bg-white/10 border border-white/20 text-white rounded-full font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">Annuler</button>
              <button onClick={applyFreeCrop} disabled={isApplyingEdit} className="w-[140px] py-3.5 bg-[#AFFF25] text-[#040221] rounded-full font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2">
                 {isApplyingEdit ? <Loader2 size={16} className="animate-spin" /> : <><Crop size={16} /> Valider</>}
              </button>
          </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden">
          
          {(scanMode === 'lot' || scanMode === 'auto') && pendingCards.length > 0 && (<div className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 bg-[#AFFF25] text-[#040221] px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest z-50 animate-in fade-in slide-in-from-top-4">{pendingCards.length} en attente...</div>)}
          
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-100 origin-center" style={{ transform: nativeZoomSupported ? 'scale(1)' : `scale(${cameraZoom})` }} />
          
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div ref={guideRef} className="w-[75%] max-w-[350px] aspect-[2.5/3.5] border-[3px] border-dashed border-[#AFFF25] rounded-xl relative shadow-[0_0_0_9999px_rgba(4,2,33,0.85)]">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#AFFF25]/50 font-light text-4xl leading-none">+</div>
            </div>
          </div>

          {scanMode === 'auto' && (
             <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none">
                <div className="text-white text-xs font-bold uppercase tracking-widest bg-black/50 border border-white/20 px-4 py-2 rounded-full mb-3">Ne bougez plus</div>
             </div>
          )}
          
          {isFlashing && <div className="absolute inset-0 bg-white z-[300] opacity-100 transition-opacity duration-150"></div>}
          <div className="absolute top-0 left-0 w-full px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] z-20 flex justify-between"><button onClick={stopCamera} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 active:scale-95 pointer-events-auto"><X size={20}/></button></div>
          
          <div className="absolute right-4 lg:right-12 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto">
            <div className="bg-black/60 text-[#AFFF25] px-2 py-1.5 rounded-xl text-[10px] font-bold tracking-widest border border-white/10">
              {cameraZoom.toFixed(1)}x
            </div>
            <div className="flex flex-col items-center justify-between bg-black/60 px-2 py-4 rounded-full border border-white/10 h-[200px]">
              <span className="text-white/60 text-[10px] font-bold">3x</span>
              <div className="flex-1 w-full relative flex items-center justify-center">
                <input 
                  type="range" min="1" max="3" step="0.1" 
                  value={cameraZoom} 
                  onChange={handleZoomChange} 
                  className="w-[120px] h-1 bg-white/20 rounded-full appearance-none outline-none accent-[#AFFF25] -rotate-90 absolute" 
                />
              </div>
              <span className="text-white/60 text-[10px] font-bold">1x</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 w-full pb-32 pt-20 flex flex-col items-center z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
             <button onClick={captureImageAndCrop} className="w-[72px] h-[72px] bg-white rounded-full border-[4px] border-[#AFFF25] flex items-center justify-center active:scale-90 transition-transform relative overflow-hidden">
                {scanMode === 'auto' && (
                   <div className="absolute inset-0 bg-[#AFFF25] transition-all duration-75 origin-bottom" style={{ transform: `scaleY(${autoScanProgress / 100})` }}></div>
                )}
             </button>

             {(scanMode === 'lot' || scanMode === 'auto') && pendingCards.length > 0 && activeSide === 'front' && (<button onClick={() => { stopCamera(); setIsVerifyingBulk(true); setCurrentVerifyIndex(0); }} className="mt-6 bg-[#AFFF25] text-[#040221] px-6 py-3 rounded-full font-black uppercase tracking-widest text-xs active:scale-95 transition-all flex items-center gap-2">Terminer et Vérifier <ArrowRight size={16} strokeWidth={3} /></button>)}
          </div>
        </div>
      )}

      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pointer-events-none bg-gradient-to-b from-[#040221] to-transparent">
        <button onClick={() => router.back()} className="pointer-events-auto w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"><ChevronLeft size={20} /></button>
        <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter pointer-events-auto">{isVerifyingBulk ? `CARTE ${currentVerifyIndex + 1}/${pendingCards.length}` : pageTitle}</h1>
        <div className="w-auto min-w-[40px] flex justify-end pointer-events-auto">
          {editId && !isVerifyingBulk && (<button onClick={deleteCard} className={`h-10 px-3 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDelete ? 'bg-red-500 text-white' : 'bg-white/10 backdrop-blur-md text-red-500 border border-white/20'}`}><Trash2 size={18} />{confirmDelete && <span className="text-xs font-black ml-2 uppercase">Sûr ?</span>}</button>)}
        </div>
      </header>

      {showEditor && activePreviewUrl && (
        <div className="fixed inset-0 z-[100] bg-[#040221] p-6 flex flex-col animate-in fade-in zoom-in duration-300">
          <header className="flex justify-between items-center mb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
            <button onClick={() => setShowEditor(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:scale-95"><X size={20} /></button>
            <h2 className="text-xl font-black italic uppercase text-[#AFFF25] tracking-widest">Éditeur {activeSide === 'front' ? 'Recto' : 'Verso'}</h2>
            <button onClick={applyImageEdits} className="w-10 h-10 bg-[#AFFF25] text-black rounded-full flex items-center justify-center active:scale-95"><Check size={20} strokeWidth={3} /></button>
          </header>

          <div className="relative w-full flex-1 max-h-[50vh] rounded-2xl overflow-hidden border border-white/20 bg-black/50 flex items-center justify-center">
            <img 
              src={activePreviewUrl} 
              className="w-full h-full object-contain"
              style={{ filter: `brightness(${imgSettings.brightness}%) contrast(${imgSettings.contrast}%)`, transform: `scale(${imgSettings.zoom})` }}
              alt="Preview Edit" 
            />
          </div>

          <div className="mt-8 space-y-6 pb-32 overflow-y-auto">
            <button onClick={handleAutoEnhance} className="w-full py-3 rounded-full bg-[#AFFF25]/10 border border-[#AFFF25] text-[#AFFF25] font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"><Wand2 size={18} /> Amélioration Auto</button>
            <div className="space-y-4">
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Zoom</span><span>{(imgSettings.zoom).toFixed(1)}x</span></div><input type="range" min="1" max="3" step="0.05" value={imgSettings.zoom} onChange={e => setImgSettings({...imgSettings, zoom: parseFloat(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Luminosité</span><span>{imgSettings.brightness}%</span></div><input type="range" min="50" max="150" step="1" value={imgSettings.brightness} onChange={e => setImgSettings({...imgSettings, brightness: parseInt(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
              <div><div className="flex justify-between text-xs text-white/70 font-bold mb-2 uppercase"><span>Contraste</span><span>{imgSettings.contrast}%</span></div><input type="range" min="50" max="150" step="1" value={imgSettings.contrast} onChange={e => setImgSettings({...imgSettings, contrast: parseInt(e.target.value)})} className="w-full accent-[#AFFF25]" /></div>
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

      <div className={`relative lg:fixed lg:top-0 lg:left-0 w-full lg:w-2/3 flex flex-col items-center lg:justify-center pt-[140px] lg:pt-0 pb-8 lg:pb-0 lg:h-screen z-10 px-6 transition-all duration-300`}>
        
        {!isWishlistMode && !isVerifyingBulk && (
          <div className="flex flex-col items-center gap-4 mb-8 w-full mt-4 lg:mt-0">
            <div className="flex justify-center gap-4 sm:gap-8 w-full max-w-md">
              <button onClick={() => setScanMode('unitaire')} className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${scanMode === 'unitaire' ? 'text-[#AFFF25] border-b-2 border-[#AFFF25] pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}>Unitaire</button>
              <button onClick={() => setScanMode('lot')} className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${scanMode === 'lot' ? 'text-[#AFFF25] border-b-2 border-[#AFFF25] pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}>En Lot</button>
              <button onClick={() => setScanMode('auto')} className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${scanMode === 'auto' ? 'text-[#AFFF25] border-b-2 border-[#AFFF25] pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}>Auto <span className="bg-[#AFFF25]/20 text-[#AFFF25] px-1.5 py-0.5 rounded text-[8px]">Bêta</span></button>
            </div>
            
            <div className="relative grid grid-cols-2 bg-[#0A072E] border border-white/10 rounded-full p-1 w-[200px]">
              <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#AFFF25] rounded-full transition-all duration-300 ease-out ${activeSide === 'front' ? 'left-1' : 'left-[calc(50%+2px)]'}`} />
              <button onClick={() => setActiveSide('front')} className={`relative z-10 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeSide === 'front' ? 'text-[#040221]' : 'text-white/60'}`}>Recto</button>
              <button onClick={() => setActiveSide('back')} className={`relative z-10 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeSide === 'back' ? 'text-[#040221]' : 'text-white/60'}`}>Verso</button>
            </div>
          </div>
        )}

        {isVerifyingBulk && (
          <div className="relative grid grid-cols-2 bg-[#0A072E] border border-white/10 rounded-full p-1 w-[200px] mb-8 mt-4 lg:mt-0">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#AFFF25] rounded-full transition-all duration-300 ease-out ${activeSide === 'front' ? 'left-1' : 'left-[calc(50%+2px)]'}`} />
            <button onClick={() => setActiveSide('front')} className={`relative z-10 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeSide === 'front' ? 'text-[#040221]' : 'text-white/60'}`}>Recto</button>
            <button onClick={() => setActiveSide('back')} className={`relative z-10 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeSide === 'back' ? 'text-[#040221]' : 'text-white/60'}`}>Verso</button>
          </div>
        )}

        <div className="relative w-full max-w-[220px] lg:max-w-[320px] mx-auto mb-6 lg:mb-10">
          
          {activePreviewUrl ? (
            <div className="relative aspect-[3/4] w-full flex items-center justify-center overflow-hidden bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl">
              <img src={activePreviewUrl} className="w-[85%] h-[85%] object-contain rounded-xl z-0" alt="Preview" />
              
              {/* 🌟 LE CORRECTIF D'AFFICHAGE DU CHARGEMENT : on le voit maintenant aussi sur le Verso ! */}
              {(analyzing || (isVerifyingBulk && pendingCards[currentVerifyIndex]?.status === 'analyzing')) && !showEditor && (
                <div className="absolute inset-0 bg-[#040221]/90 flex flex-col items-center justify-center backdrop-blur-sm z-40">
                   <Loader2 className="animate-spin text-[#AFFF25] mb-2 lg:mb-4" size={32} />
                   <span className="text-[#AFFF25] text-[10px] lg:text-xs font-bold tracking-widest animate-pulse mt-2 text-center px-4">
                     {isVerifyingBulk ? 'L\'IA TERMINE SON ANALYSE...' : 'ANALYSE IA EN COURS...'}
                   </span>
                </div>
              )}
              
              {!analyzing && !(isVerifyingBulk && pendingCards[currentVerifyIndex]?.status === 'analyzing') && (
                <button onClick={() => activeSide === 'front' ? setPreviewUrl(null) : setPreviewUrlBack(null)} className="absolute top-4 right-4 w-8 h-8 bg-black/50 border border-white/20 text-white rounded-full flex items-center justify-center z-50">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="aspect-[3/4] w-full flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl gap-4 p-6">
              <button onClick={startCamera} className="w-full flex flex-col items-center justify-center gap-3 bg-[#AFFF25]/10 border border-[#AFFF25]/30 hover:bg-[#AFFF25]/20 hover:border-[#AFFF25] transition-all p-6 rounded-2xl active:scale-95 group">
                <div className="w-12 h-12 rounded-full bg-[#AFFF25] flex items-center justify-center text-[#040221] group-hover:scale-110 transition-transform"><Camera size={24} strokeWidth={2.5} /></div>
                <span className="text-xs lg:text-sm font-bold text-[#AFFF25] uppercase tracking-widest text-center">Prendre {activeSide === 'front' ? 'le Recto' : 'le Verso'}</span>
              </button>

              {!isVerifyingBulk && (
                <>
                  <div className="flex items-center gap-2 w-full"><div className="h-[1px] flex-1 bg-white/10"></div><span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">OU</span><div className="h-[1px] flex-1 bg-white/10"></div></div>
                  
                  <button onClick={() => galleryInputRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-all p-6 rounded-2xl active:scale-95 group text-white/70">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon size={24} strokeWidth={2.5} />
                    </div>
                    <span className="text-xs lg:text-sm font-bold uppercase tracking-widest text-center">Ouvrir la Galerie</span>
                  </button>
                </>
              )}
            </div>
          )}
          
          {activePreviewUrl && !(isVerifyingBulk && pendingCards[currentVerifyIndex]?.status === 'analyzing') && (
            <>
              <button onClick={(e) => { e.preventDefault(); openManualCrop(); }} className="absolute -left-4 bottom-20 lg:-left-6 lg:bottom-24 w-12 h-12 lg:w-14 lg:h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] z-50 active:scale-90 transition-transform hover:scale-105"><Crop size={20} className="lg:w-6 lg:h-6" strokeWidth={2.5} /></button>
              <button onClick={(e) => { e.preventDefault(); setShowEditor(true); }} className="absolute -left-4 bottom-6 lg:-left-6 lg:bottom-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] z-50 active:scale-90 transition-transform hover:scale-105"><SlidersHorizontal size={20} className="lg:w-6 lg:h-6" strokeWidth={2.5} /></button>
              <button onClick={(e) => { e.preventDefault(); rotateImage(); }} className="absolute -right-4 bottom-6 lg:-right-6 lg:bottom-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#0A072E] border-[3px] border-[#AFFF25] rounded-full flex items-center justify-center text-[#AFFF25] z-50 active:scale-90 transition-transform hover:scale-105"><RotateCw size={20} className="lg:w-6 lg:h-6" strokeWidth={2.5} /></button>
            </>
          )}
        </div>

        {(activePreviewUrl || previewUrlBack) && !analyzing && !isVerifyingBulk && (
          <div className="flex gap-2 w-full max-w-full px-4 lg:max-w-[400px] mx-auto pointer-events-auto">
             <button onClick={() => handleChangeImage('front')} className="flex-1 flex justify-center items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-white/70 bg-white/5 border border-white/10 py-3 rounded-full hover:bg-white/10 active:scale-95 transition-all whitespace-nowrap">
               Changer Recto
             </button>
             <button onClick={() => handleChangeImage('back')} className={`flex-1 flex justify-center items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold py-3 rounded-full active:scale-95 transition-all whitespace-nowrap ${previewUrlBack ? 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10' : 'bg-[#AFFF25]/10 border border-[#AFFF25]/30 text-[#AFFF25] hover:bg-[#AFFF25]/20'}`}>
               {previewUrlBack ? 'Changer Verso' : 'Ajouter verso'}
             </button>
          </div>
        )}
      </div>

      <div className="relative z-30 w-full lg:w-1/3 lg:ml-auto bg-[#040221] lg:bg-[#040221]/95 lg:backdrop-blur-xl rounded-t-[32px] lg:rounded-none lg:rounded-l-[32px] px-6 pt-8 lg:pt-[100px] pb-32 min-h-[60vh] lg:min-h-screen border-t lg:border-t-0 lg:border-l border-white/5 transition-all duration-300">
        
        {isWishlistMode && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-3 uppercase">Importer depuis un lien (Optionnel)</label>
            <div className="flex gap-2">
              <input 
                value={formData.website_url} 
                onChange={e => setFormData({...formData, website_url: e.target.value})} 
                placeholder="Lien eBay, Vinted, Cardhobby..." 
                className="flex-1 bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 outline-none focus:border-[#AFFF25]/50 transition-colors" 
              />
              <button 
                onClick={handleUrlImport} 
                disabled={!formData.website_url || analyzing} 
                className="bg-[#AFFF25] text-[#040221] px-5 rounded-full font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform disabled:opacity-50 shrink-0"
              >
                Importer
              </button>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setIsJoueurOpen(!isJoueurOpen)}>
              <h2 className="text-2xl font-black italic uppercase">Joueur</h2><div className="text-[#AFFF25]">{isJoueurOpen ? <Minus size={22} /> : <Plus size={22} />}</div>
            </div>
            
            {isJoueurOpen && (
              <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
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
                
                <div className="relative">
                  <input value={formData.lastname} onChange={e => { setFormData({...formData, lastname: e.target.value.toUpperCase()}); setShowPlayerSuggestions(true); }} onFocus={() => setShowPlayerSuggestions(true)} onBlur={() => setTimeout(() => setShowPlayerSuggestions(false), 200)} placeholder="Nom" className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 outline-none focus:border-[#AFFF25]/50 transition-colors" />
                  {showPlayerSuggestions && formData.lastname && filteredPlayers.length > 0 && (
                    <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto">
                      {filteredPlayers.map((p: any, i: number) => (
                        <li key={i} onClick={() => { 
                          const parts = p.name.split(' ');
                          setFormData({...formData, firstname: parts[0].toUpperCase(), lastname: parts.slice(1).join(' ').toUpperCase(), club: p.team || formData.club }); 
                          setShowPlayerSuggestions(false); 
                        }} className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex flex-col gap-1 border-b border-white/5 last:border-0">
                          <span className="text-sm font-bold uppercase text-white">{p.name}</span>
                          {p.team && <span className="text-[10px] text-[#AFFF25]">{p.team}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div className="relative">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Club / Équipe</label>
                  <div className="relative flex items-center">
                    {formData.club && <img src={`/asset/logo-club/${sportFolder}/${clubSlug}.svg`} onError={(e) => e.currentTarget.style.display='none'} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Club" />}
                    <input value={formData.club} onChange={e => { setFormData({...formData, club: e.target.value}); setShowClubSuggestions(true); }} onFocus={() => setShowClubSuggestions(true)} onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)} placeholder="Club" className={`w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm outline-none focus:border-[#AFFF25]/50 transition-colors ${formData.club ? 'pl-[44px]' : 'pl-4'}`} />
                    <Search className="absolute right-4 text-[#AFFF25] pointer-events-none" size={16} />
                  </div>
                  {showClubSuggestions && formData.club && filteredClubs.length > 0 && (
                    <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto">
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
                  <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors"><option value="">Collection / Set</option>{availableSets.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                  <ChevronDown className="absolute right-4 top-4 text-white/50 pointer-events-none" size={16} />
                </div>

                <div className="relative">
                  <select value={formData.variation} onChange={e => setFormData({...formData, variation: e.target.value})} className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25]/50 transition-colors">
                    <option value="">Variation (ex: Base, Prizm Silver...)</option>
                    {currentBrandVariations && Object.keys(currentBrandVariations).map(catKey => {
                      if (Array.isArray(currentBrandVariations[catKey])) {
                        return (
                          <optgroup key={catKey} label={formatLabel(catKey)}>
                            {currentBrandVariations[catKey].map((v: string) => <option key={v} value={v}>{v}</option>)}
                          </optgroup>
                        )
                      } else {
                        return Object.keys(currentBrandVariations[catKey]).map(subKey => (
                          <optgroup key={`${catKey}-${subKey}`} label={`${formatLabel(catKey)} - ${formatLabel(subKey)}`}>
                            {currentBrandVariations[catKey][subKey].map((v: string) => <option key={v} value={v}>{v}</option>)}
                          </optgroup>
                        ))
                      }
                    })}
                  </select>
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
                      <select value={formData.grading_company} onChange={e => setFormData({...formData, grading_company: e.target.value})} className="w-full bg-[#040221] border border-[#AFFF25]/50 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25] transition-colors"><option value="">Société</option>{['PSA', 'PCA', 'Becket', 'Collect Aura', 'MTG', 'GCC'].map(c => <option key={c} value={c}>{c}</option>)}</select>
                      <ChevronDown className="absolute right-4 top-4 text-[#AFFF25]/50 pointer-events-none" size={16} />
                    </div>
                    <div className="relative w-1/2">
                      <select value={formData.grading_grade} onChange={e => setFormData({...formData, grading_grade: e.target.value})} className="w-full bg-[#040221] border border-[#AFFF25]/50 p-3.5 rounded-full text-sm pl-4 appearance-none outline-none focus:border-[#AFFF25] transition-colors"><option value="">Note</option>{['10+', '10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', 'officielle'].map(n => <option key={n} value={n}>{n}</option>)}</select>
                      <ChevronDown className="absolute right-4 top-4 text-[#AFFF25]/50 pointer-events-none" size={16} />
                    </div>
                  </div>
                )}
                
                {formData.is_numbered && (
                  <div className="flex items-center gap-4 justify-center animate-in fade-in duration-200 pt-2">
                    <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} placeholder="Ex: 5" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none transition-all" />
                    <span className="text-[#AFFF25] font-black text-2xl px-2">/</span>
                    <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} placeholder="Ex: 50" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none transition-all" />
                  </div>
                )}

                <div className="relative w-full pt-2">
                  <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Prix estimé / Prix d'achat" className="w-full bg-[#040221] border border-white/20 p-3.5 rounded-full text-sm pl-4 pr-10 outline-none focus:border-[#AFFF25]/50 transition-colors" />
                  <span className="absolute right-5 top-5 text-[#AFFF25] font-bold">€</span>
                </div>

              </div>
            )}
          </div>

          {isVerifyingBulk ? (
            <div className="flex gap-3 mt-6 mb-6">
              <button 
                onClick={(e) => { e.preventDefault(); discardCurrentBulkCard(); }} 
                disabled={loading} 
                className="w-14 h-14 shrink-0 bg-red-500/10 border border-red-500/50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <Trash2 size={24} strokeWidth={2} />
              </button>
              <button 
                disabled={loading || analyzing || (pendingCards[currentVerifyIndex]?.status === 'analyzing')} 
                onClick={saveCard} 
                className="flex-1 font-black italic py-4 rounded-full uppercase flex justify-center items-center gap-2 transition-all duration-300 bg-[#AFFF25] text-[#040221] hover:bg-[#9ee615] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" /> : currentVerifyIndex < pendingCards.length - 1 ? `Valider & Suivant (${currentVerifyIndex + 1}/${pendingCards.length})` : `Terminer (${currentVerifyIndex + 1}/${pendingCards.length})`}
              </button>
            </div>
          ) : (
            <button 
              disabled={loading || analyzing || !isFormStarted} 
              onClick={saveCard} 
              className={`w-full font-black italic py-4 rounded-full mt-6 mb-6 uppercase flex justify-center items-center gap-2 transition-all duration-300 ${isFormStarted ? 'bg-[#AFFF25] text-[#040221] hover:bg-[#9ee615] active:scale-95' : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
            >
              {loading ? <Loader2 className="animate-spin" /> : editId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          )}

        </div>
      </div>
      
      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
      <input type="file" ref={galleryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple={activeSide === 'front'} />
    </div>
  );
}