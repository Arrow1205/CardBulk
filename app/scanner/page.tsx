'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus } from 'lucide-react';

// IMPORT DE TES DONNÉES JSON
import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import SET_DATA from '@/data/set.json';

// 🎯 LE DICTIONNAIRE MAGIQUE
const SPORT_CONFIG: Record<string, { image: string, jsonKey: string, label: string }> = {
  'SOCCER': { image: 'Soccer', jsonKey: 'football_soccer', label: 'Football (Soccer)' },
  'BASKETBALL': { image: 'Basket', jsonKey: 'basketball', label: 'Basketball' },
  'BASEBALL': { image: 'Baseball', jsonKey: 'baseball', label: 'Baseball' },
  'F1': { image: 'F1', jsonKey: 'f1', label: 'Formule 1' },
  'NFL': { image: 'NFL', jsonKey: 'nfl', label: 'Football Américain (NFL)' },
  'NHL': { image: 'NHL', jsonKey: 'nhl', label: 'Hockey (NHL)' },
  'POKEMON': { image: 'Pokemon', jsonKey: 'pokemon', label: 'Pokémon' },
  'TENNIS': { image: 'Tennis', jsonKey: 'tennis', label: 'Tennis' },
  'MARVEL': { image: 'MArvel', jsonKey: 'marvel', label: 'Marvel' }
};

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [showClubSuggestions, setShowClubSuggestions] = useState(false);

  // 🚀 ÉTATS POUR LES ACCORDÉONS
  const [isJoueurOpen, setIsJoueurOpen] = useState(true);
  const [isCarteOpen, setIsCarteOpen] = useState(true);

  const [formData, setFormData] = useState({
    sport: '',
    firstname: '',
    lastname: '',
    club: '',
    brand: '',
    series: '',
    year: '',
    is_auto: false,
    is_patch: false,
    is_rookie: false,
    is_numbered: false,
    num_low: '',
    num_high: '',
    price: ''
  });

  const yearsList = Array.from({ length: 2027 - 1994 + 1 }, (_, i) => 2027 - i);

  // Sécurisation JSON pour les clubs
  const safeFootballClubs = Array.isArray(FOOTBALL_CLUBS) ? FOOTBALL_CLUBS : [];
  const filteredClubs = safeFootballClubs.filter((c: any) => 
    c.name?.toLowerCase().includes(formData.club.toLowerCase())
  );
  const selectedClub = safeFootballClubs.find((c: any) => c.name?.toLowerCase() === formData.club.toLowerCase());
  const clubSlug = selectedClub ? selectedClub.slug : formData.club.toLowerCase().replace(/\s+/g, '-');

  // Extraction Brands & Sets
  const availableBrands = SET_DATA.brands || [];
  let availableSets: string[] = [];
  
  if (formData.brand && formData.sport && SPORT_CONFIG[formData.sport]) {
    const selectedBrandObj = availableBrands.find((b: any) => b.name?.toLowerCase() === formData.brand.toLowerCase());
    const sportJsonKey = SPORT_CONFIG[formData.sport].jsonKey;
    
    if (selectedBrandObj && selectedBrandObj.sports) {
      const sportsData = selectedBrandObj.sports as any;
      if (sportsData[sportJsonKey]) {
        availableSets = sportsData[sportJsonKey];
      }
    }
  }

  const sportImage = formData.sport ? SPORT_CONFIG[formData.sport]?.image : null;
  const brandSlug = formData.brand ? formData.brand.toLowerCase().replace(/\s+/g, '-') : '';

  const isFormStarted = Object.values(formData).some(val => 
    (typeof val === 'string' && val.trim() !== '') || 
    (typeof val === 'boolean' && val === true)
  );

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);

    try {
      const body = new FormData();
      body.append("image", file);
      
      const res = await fetch("/api/scan", { method: "POST", body });
      const data = await res.json();

      if (!data.error && data.playerName) {
        const parts = data.playerName.split(' ');
        
        setFormData(prev => {
          let aiSport = data.sport?.toUpperCase() || prev.sport;
          if (aiSport === 'FOOTBALL') aiSport = 'SOCCER';

          return {
            ...prev,
            sport: aiSport,
            firstname: parts[0]?.toUpperCase() || '',
            lastname: parts.slice(1).join(' ')?.toUpperCase() || '',
            club: data.club || '', 
            brand: data.brand || prev.brand,
            series: data.series || prev.series,
            year: data.year?.toString() || prev.year,
            is_auto: !!data.is_auto,
            is_patch: !!data.is_patch,
            is_rookie: !!data.is_rookie,
            is_numbered: !!data.is_numbered,
            num_low: data.num_low?.toString() || '',
            num_high: data.num_high?.toString() || ''
          };
        });
        
        // Ouvre les accordéons automatiquement
        setIsJoueurOpen(true);
        setIsCarteOpen(true);
      }
    } catch (err) {
      console.error("Échec silencieux du scan.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveCard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert("Tu dois créer un compte ou te connecter pour sauvegarder tes cartes !");
        router.push('/login'); 
        return; 
      }
      
      const { error } = await supabase.from('cards').insert([{
        user_id: user.id,
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
        image_url: previewUrl,
        club_name: formData.club
      }]);

      if (error) {
        alert("❌ Erreur : " + error.message);
        setLoading(false);
        return;
      }

      router.push('/collection');
      
    } catch (err) {
      alert("❌ Une erreur inattendue est survenue.");
      setLoading(false);
    }
  };

  const hideBrokenImage = (e: any) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <div className="min-h-screen text-white p-6 pb-36 overflow-y-auto overflow-x-hidden font-sans">      
      {/* HEADER */}
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-transparent rounded-full flex items-center justify-center border border-white/20">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">AJOUTER</h1>
          <p className="text-[#AFFF25] text-[10px] italic tracking-widest mt-1">Scan ou upload ta carte</p>
        </div>
        <div className="w-10" />
      </header>

      {/* ZONE PHOTO */}
      <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[3/4] w-full max-w-[240px] mx-auto flex flex-col items-center justify-center overflow-hidden mb-10 cursor-pointer bg-white/5 border border-white/10 rounded-2xl transition-all hover:bg-white/10">
        
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#AFFF25]"></div>
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#AFFF25]"></div>
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#AFFF25]"></div>
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#AFFF25]"></div>

        {previewUrl ? (
          <img src={previewUrl} className="w-[85%] h-[85%] object-contain rounded-xl shadow-2xl" alt="Preview" />
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-[#AFFF25]/10 border border-[#AFFF25]/30 px-6 py-2 rounded-full text-[11px] font-bold text-[#AFFF25] uppercase tracking-widest">
              Scanner la carte
            </div>
          </div>
        )}
        
        {analyzing && (
          <div className="absolute inset-0 bg-[#040221]/90 flex flex-col items-center justify-center backdrop-blur-sm z-20">
             <Loader2 className="animate-spin text-[#AFFF25] mb-2" size={32} />
             <span className="text-[#AFFF25] text-[10px] italic tracking-widest animate-pulse mt-2">ANALYSE EN COURS...</span>
          </div>
        )}
      </div>

      <div className="space-y-8">
        
        {/* ===================== SECTION JOUEUR ===================== */}
        <div>
          {/* En-tête de l'accordéon */}
          <div 
            className="flex justify-between items-center cursor-pointer select-none mb-4"
            onClick={() => setIsJoueurOpen(!isJoueurOpen)}
          >
            <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">Joueur</h2>
            <div className="text-[#AFFF25]">
              {isJoueurOpen ? <Minus size={22} /> : <Plus size={22} />}
            </div>
          </div>

          {/* Contenu de l'accordéon */}
          {isJoueurOpen && (
            <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Sport</label>
                <div className="relative flex items-center">
                  {sportImage && (
                    <img src={`/asset/sports/${sportImage}.png`} onError={hideBrokenImage} className="absolute left-4 w-5 h-5 object-contain z-10" alt="Sport" />
                  )}
                  <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value, series: ''})} className={`w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 transition-colors ${sportImage ? 'pl-12' : 'pl-4'}`}>
                    <option value="">Sélectionne le sport</option>
                    {Object.keys(SPORT_CONFIG).map(sportKey => (
                      <option key={sportKey} value={sportKey}>{SPORT_CONFIG[sportKey].label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Prénom</label>
                <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} placeholder="Prénom du joueur" className="w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 pl-4 transition-colors" />
              </div>

              <div>
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Nom</label>
                <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value.toUpperCase()})} placeholder="Nom du joueur" className="w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 pl-4 transition-colors" />
              </div>

              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Club</label>
                <div className="relative flex items-center">
                  {formData.club && (
                    <img src={`/asset/logo-club/${clubSlug}.svg`} onError={hideBrokenImage} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Club" />
                  )}
                  <input 
                    value={formData.club} 
                    onChange={e => {
                      setFormData({...formData, club: e.target.value});
                      setShowClubSuggestions(true);
                    }} 
                    onFocus={() => setShowClubSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)}
                    placeholder="Recherche un club" 
                    className={`w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 transition-colors ${formData.club ? 'pl-12' : 'pl-4'}`} 
                  />
                  <Search className="absolute right-4 text-[#AFFF25] pointer-events-none" size={16} />
                </div>
                
                {showClubSuggestions && formData.club && filteredClubs.length > 0 && (
                  <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25] rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl">
                    {filteredClubs.slice(0, 20).map((c: any, i: number) => (
                      <li 
                        key={i} 
                        onClick={() => {
                          setFormData({...formData, club: c.name});
                          setShowClubSuggestions(false);
                        }}
                        className="p-3 hover:bg-[#AFFF25]/20 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
                      >
                        <img src={`/asset/logo-club/${c.slug}.svg`} onError={hideBrokenImage} className="w-6 h-6 object-contain" />
                        <span className="text-sm font-bold uppercase">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>


        {/* ===================== SECTION CARTE ===================== */}
        <div>
          {/* En-tête de l'accordéon */}
          <div 
            className="flex justify-between items-center cursor-pointer select-none mb-4"
            onClick={() => setIsCarteOpen(!isCarteOpen)}
          >
            <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">Carte</h2>
            <div className="text-[#AFFF25]">
              {isCarteOpen ? <Minus size={22} /> : <Plus size={22} />}
            </div>
          </div>

          {/* Contenu de l'accordéon */}
          {isCarteOpen && (
            <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
              
              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Brand</label>
                <div className="relative flex items-center">
                  {formData.brand && (
                    <img src={`/asset/brands/${brandSlug}.png`} onError={hideBrokenImage} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Brand" />
                  )}
                  <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value, series: ''})} className={`w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 transition-colors ${formData.brand ? 'pl-12' : 'pl-4'}`}>
                    <option value="">Sélectionne un fabricant</option>
                    {availableBrands.map((b: any, i: number) => (
                      <option key={i} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Set</label>
                <select 
                  value={formData.series} 
                  onChange={e => setFormData({...formData, series: e.target.value})} 
                  disabled={!formData.brand || !formData.sport}
                  className={`w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 pl-4 disabled:opacity-50 disabled:border-white/10 transition-colors`}
                >
                  <option value="">
                    {!formData.sport || !formData.brand ? "Choisis un sport et fabricant" : "Sélectionne la collection"}
                  </option>
                  {availableSets.map((setName: string, i: number) => (
                    <option key={i} value={setName}>{setName}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 bottom-3 text-white/50 pointer-events-none" size={16} />
              </div>

              <div className="relative">
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Année</label>
                <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 pl-4 transition-colors">
                  <option value="">Sélectionne l'année</option>
                  {yearsList.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 bottom-3 text-white/50 pointer-events-none" size={16} />
              </div>

              <div className="space-y-5 pt-4">
                {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
                  const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
                  const active = formData[k as keyof typeof formData];
                  return (
                    <div key={l} className="flex justify-between items-center px-2">
                      <span className="font-black tracking-widest text-sm uppercase">{l}</span>
                      <button onClick={() => setFormData({...formData, [k]: !active})} className={`w-12 h-6 rounded-full relative transition-all border ${active ? 'border-[#AFFF25] bg-[#AFFF25]/20' : 'border-white/30'}`}>
                        <div className={`absolute top-[3px] w-4 h-4 rounded-full transition-all ${active ? 'right-1 bg-[#AFFF25]' : 'left-1 bg-white/50'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {formData.is_numbered && (
                <div className="pt-2 animate-in fade-in zoom-in duration-200">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-2">Numérotation</label>
                  <div className="flex items-center gap-4">
                    <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} placeholder="Ex: 5" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none text-white/80 transition-colors" />
                    <span className="text-[#AFFF25] font-black text-xl">/</span>
                    <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} placeholder="Ex: 50" className="w-24 bg-[#040221] border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none text-white/80 transition-colors" />
                  </div>
                </div>
              )}

              <div className="pt-4 pb-4">
                 <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Prix d'achat</label>
                 <div className="relative w-full">
                   <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Ex: 15" className="w-full bg-[#040221] border border-white/20 focus:border-[#AFFF25] p-3 rounded-full text-right pr-12 text-sm outline-none text-white/80 transition-colors" />
                   <span className="absolute right-4 bottom-3 text-[#AFFF25] font-bold">€</span>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* BOUTON ENREGISTRER */}
        <button 
          onClick={saveCard} 
          disabled={loading || analyzing || !isFormStarted} 
          className={`w-full font-black italic py-4 rounded-full mt-2 mb-6 uppercase tracking-widest transition-all ${
            isFormStarted 
              ? 'bg-[#AFFF25] text-black shadow-[0_10px_40px_rgba(175,255,37,0.3)] hover:scale-[1.02] active:scale-95' 
              : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Enregistrer la carte'}
        </button>
      </div>
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}