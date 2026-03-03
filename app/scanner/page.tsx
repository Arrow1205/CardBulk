'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown } from 'lucide-react';

// IMPORT DE TA NOUVELLE LISTE JSON (Assure-toi que le fichier existe bien dans le dossier data !)
import FOOTBALL_CLUBS from '@/data/football-clubs.json';

export default function ScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showClubSuggestions, setShowClubSuggestions] = useState(false);

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

  // Années dynamiques de 2027 à 1994
  const yearsList = Array.from({ length: 2027 - 1994 + 1 }, (_, i) => 2027 - i);

  // Filtre les clubs en fonction de la saisie (basé sur le format {id, name, slug})
  const filteredClubs = FOOTBALL_CLUBS.filter((c: any) => 
    c.name.toLowerCase().includes(formData.club.toLowerCase())
  );

  // Trouve le slug exact du club tapé pour afficher le bon logo
  const selectedClub = FOOTBALL_CLUBS.find((c: any) => c.name.toLowerCase() === formData.club.toLowerCase());
  const clubSlug = selectedClub ? selectedClub.slug : formData.club.toLowerCase().replace(/\s+/g, '-');

  // Vérifie si au moins 1 champ est rempli pour allumer le bouton
  const isFormStarted = Object.values(formData).some(val => 
    (typeof val === 'string' && val.trim() !== '') || 
    (typeof val === 'boolean' && val === true)
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFormData(prev => ({
          ...prev,
          sport: data.sport?.toUpperCase() || prev.sport,
          firstname: parts[0]?.toUpperCase() || '',
          lastname: parts.slice(1).join(' ')?.toUpperCase() || '',
          club: data.club || '', // L'IA renvoie idéalement le nom propre
          brand: data.brand?.toUpperCase() || prev.brand,
          series: data.series?.toUpperCase() || prev.series,
          year: data.year?.toString() || prev.year,
          is_auto: !!data.is_auto,
          is_patch: !!data.is_patch,
          is_rookie: !!data.is_rookie,
          is_numbered: !!data.is_numbered,
          num_low: data.num_low?.toString() || '',
          num_high: data.num_high?.toString() || ''
        }));
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
        // Redirection vers la page de login si non connecté
        alert("Tu dois créer un compte ou te connecter pour sauvegarder tes cartes !");
        router.push('/login'); 
        return; // On arrête l'exécution ici
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
        console.error("Erreur Supabase Insert:", error);
        alert("❌ Erreur Supabase : " + error.message);
        setLoading(false);
        return;
      }

      router.push('/collection');
      
    } catch (err) {
      console.error("Erreur critique:", err);
      alert("❌ Une erreur inattendue est survenue.");
      setLoading(false);
    }
  };

  // Cache l'image si le logo n'est pas trouvé
  const hideBrokenImage = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-24 overflow-y-auto overflow-x-hidden font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 bg-transparent rounded-full flex items-center justify-center border border-white/20">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">AJOUTER</h1>
          <p className="text-[#AFFF25] text-[10px] italic tracking-widest mt-1">Scan ou upload ta carte</p>
        </div>
        <div className="w-10" />
      </header>

      <div className="flex gap-2 p-1 bg-transparent rounded-full border border-white/20 mb-8 mx-4">
        <button className="flex-1 bg-[#AFFF25] text-black font-black italic py-2 rounded-full text-[11px] uppercase">Recto</button>
        <button className="flex-1 text-[#AFFF25] font-black italic py-2 rounded-full text-[11px] uppercase">Verso</button>
      </div>

      <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[4/3] w-full max-w-[280px] mx-auto flex flex-col items-center justify-center overflow-hidden mb-6 cursor-pointer">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#AFFF25]"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#AFFF25]"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#AFFF25]"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#AFFF25]"></div>

        {previewUrl ? <img src={previewUrl} className="w-[90%] h-[90%] object-cover rounded-xl" /> : (
          <div className="text-center space-y-4">
            <div className="border border-white/40 px-6 py-2 rounded-full text-[11px] font-medium text-white/80">App photo</div>
            <div className="border border-white/40 px-6 py-2 rounded-full text-[11px] font-medium text-white/80">Bibliothèque</div>
          </div>
        )}
        
        {analyzing && (
          <div className="absolute inset-0 bg-[#040221]/80 flex flex-col items-center justify-center">
             <Loader2 className="animate-spin text-[#AFFF25] mb-2" />
          </div>
        )}
      </div>
      
      <div className="text-center mb-10 h-4">
         {analyzing && <span className="text-[#AFFF25] text-[11px] italic tracking-widest animate-pulse">Analyse en cours !</span>}
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-black italic tracking-tighter text-white">Joueur</h2>
        
        <div className="space-y-4">
          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Sport</label>
            <div className="relative flex items-center">
              {formData.sport && (
                <img src={`/asset/sports/${formData.sport.toLowerCase()}.png`} onError={hideBrokenImage} className="absolute left-4 w-5 h-5 object-contain z-10" alt="Sport" />
              )}
              <select value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} className={`w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 ${formData.sport ? 'pl-12' : 'pl-4'}`}>
                <option value="" className="bg-[#040221]">Sélectionne le sport</option>
                <option value="FOOTBALL" className="bg-[#040221]">Football</option>
                <option value="BASKETBALL" className="bg-[#040221]">Basketball</option>
              </select>
              <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Prénom</label>
            <input value={formData.firstname} onChange={e => setFormData({...formData, firstname: e.target.value.toUpperCase()})} placeholder="Prénom du joueur" className="w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 pl-4" />
          </div>

          <div>
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Nom</label>
            <input value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value.toUpperCase()})} placeholder="Nom du joueur" className="w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 pl-4" />
          </div>

          {/* AUTO-COMPLÉTION POUR LES CLUBS */}
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
                className={`w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium outline-none text-white/80 ${formData.club ? 'pl-12' : 'pl-4'}`} 
              />
              <Search className="absolute right-4 text-[#AFFF25] pointer-events-none" size={16} />
            </div>
            
            {/* Menu Déroulant des suggestions de clubs */}
            {showClubSuggestions && formData.club && filteredClubs.length > 0 && (
              <ul className="absolute z-50 w-full bg-[#080531] border border-[#AFFF25]/50 rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl">
                {filteredClubs.slice(0, 20).map((c: any) => (
                  <li 
                    key={c.id} 
                    onClick={() => {
                      setFormData({...formData, club: c.name});
                      setShowClubSuggestions(false);
                    }}
                    className="p-3 hover:bg-[#AFFF25]/10 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
                  >
                    <img src={`/asset/logo-club/${c.slug}.svg`} onError={hideBrokenImage} className="w-6 h-6 object-contain" />
                    <span className="text-sm font-bold uppercase">{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <h2 className="text-2xl font-black italic tracking-tighter text-white pt-6">Carte</h2>
        
        <div className="space-y-4">
          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Brand</label>
            <div className="relative flex items-center">
              {formData.brand && (
                <img src={`/asset/brands/${formData.brand.toLowerCase()}.png`} onError={hideBrokenImage} className="absolute left-4 w-6 h-6 object-contain z-10" alt="Brand" />
              )}
              <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className={`w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 ${formData.brand ? 'pl-12' : 'pl-4'}`}>
                <option value="" className="bg-[#040221]">Sélectionne un fabricant</option>
                <option value="TOPPS" className="bg-[#040221]">TOPPS</option>
                <option value="PANINI" className="bg-[#040221]">PANINI</option>
              </select>
              <ChevronDown className="absolute right-4 text-white/50 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Set</label>
            <select value={formData.series} onChange={e => setFormData({...formData, series: e.target.value})} className="w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 pl-4">
              <option value="" className="bg-[#040221]">Sélectionne la collection</option>
              <option value="CHROME" className="bg-[#040221]">CHROME</option>
              <option value="PRIZM" className="bg-[#040221]">PRIZM</option>
            </select>
            <ChevronDown className="absolute right-4 bottom-3 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Année</label>
            <select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-sm font-medium appearance-none outline-none text-white/80 pl-4">
              <option value="" className="bg-[#040221]">Sélectionne l'année</option>
              {yearsList.map(year => (
                <option key={year} value={year} className="bg-[#040221]">{year}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 bottom-3 text-white/50 pointer-events-none" size={16} />
          </div>

          <div className="space-y-5 pt-4">
            {['AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'].map((l) => {
              const k = l === 'NUMÉROTÉE' ? 'is_numbered' : `is_${l.toLowerCase()}`;
              const active = formData[k as keyof typeof formData];
              return (
                <div key={l} className="flex justify-between items-center px-1">
                  <span className="font-black tracking-widest text-sm">{l}</span>
                  <button onClick={() => setFormData({...formData, [k]: !active})} className={`w-10 h-5 rounded-full relative transition-all border ${active ? 'border-[#AFFF25] bg-[#AFFF25]/20' : 'border-white/30'}`}>
                    <div className={`absolute top-[2px] w-3.5 h-3.5 rounded-full transition-all ${active ? 'right-1 bg-[#AFFF25]' : 'left-1 bg-white/50'}`} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="pt-2">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-2">Numérotation</label>
            <div className="flex items-center gap-4">
              <input value={formData.num_low} onChange={e => setFormData({...formData, num_low: e.target.value})} placeholder="5" className="flex-1 bg-transparent border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none text-white/80" />
              <span className="text-[#AFFF25] font-bold">/</span>
              <input value={formData.num_high} onChange={e => setFormData({...formData, num_high: e.target.value})} placeholder="50" className="flex-1 bg-transparent border border-[#AFFF25] p-3 rounded-full text-center text-sm outline-none text-white/80" />
            </div>
          </div>

          <div className="pt-4">
             <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Prix d'achat</label>
             <div className="relative">
               <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="50" className="w-full bg-transparent border border-[#AFFF25] p-3 rounded-full text-right pr-10 text-sm outline-none text-white/80" />
               <span className="absolute right-4 bottom-3 text-[#AFFF25] font-bold">€</span>
             </div>
          </div>
        </div>

        <button 
          onClick={saveCard} 
          disabled={loading || analyzing || !isFormStarted} 
          className={`w-full font-black italic py-4 rounded-full mt-8 uppercase tracking-widest transition-all ${
            isFormStarted 
              ? 'bg-[#AFFF25] text-black shadow-[0_10px_40px_rgba(175,255,37,0.3)] active:scale-95' 
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
    </div>
  );
}
