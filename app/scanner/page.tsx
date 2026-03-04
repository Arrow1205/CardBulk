'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown } from 'lucide-react';

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

  // Sécurisation JSON
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
    
    if (selectedBrandObj && selectedBrandObj.sports && selectedBrandObj.sports[sportJsonKey]) {
      availableSets = selectedBrandObj.sports[sportJsonKey];
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
    <div className="min-h-screen bg-[#040221] text-white p-6 pb-24 overflow-y-auto overflow-x-hidden font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() =>