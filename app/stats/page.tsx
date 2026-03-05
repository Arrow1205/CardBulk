'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronDown } from 'lucide-react';

export default function StatsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs'>('valeurs');
  
  // 🚀 NOUVEAU : États pour les filtres
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id);

    if (data) setCards(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040221] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
      </div>
    );
  }

  // 🚀 NOUVEAU : Filtrage des cartes avant le calcul des stats
  const filteredCards = cards.filter(card => {
    const matchesSport = selectedSport === '' || card.sport === selectedSport;
    
    let matchesSpec = true;
    if (selectedSpec === 'auto') matchesSpec = card.is_auto;
    if (selectedSpec === 'patch') matchesSpec = card.is_patch;
    if (selectedSpec === 'rookie') matchesSpec = card.is_rookie;
    if (selectedSpec === 'numbered') matchesSpec = card.is_numbered;

    return matchesSport && matchesSpec;
  });

  const isVal = activeTab === 'valeurs';
  
  // Calcul sur les cartes FILTRÉES
  const calculateTotal = (filterFn: (c: any) => boolean) => {
    return filteredCards.filter(filterFn).reduce((acc, card) => {
      return acc + (isVal ? (parseFloat(card.purchase_price) || 0) : 1);
    }, 0);
  };

  const totalGlobal = calculateTotal(() => true);
  const totalAutos = calculateTotal(c => c.is_auto);
  const totalPatchs = calculateTotal(c => c.is_patch);
  const totalNumbered = calculateTotal(c => c.is_numbered);

  // Graphique généré à partir des cartes filtrées
  const statsBySport: Record<string, number> = {};
  filteredCards.forEach(card => {
    const sport = card.sport || 'Autre';
    const amount = isVal ? (parseFloat(card.purchase_price) || 0) : 1;
    statsBySport[sport] = (statsBySport[sport] || 0) + amount;
  });

  const sortedSports = Object.entries(statsBySport).sort((a, b) => b[1] - a[1]);
  
  let currentPercentage = 0;
  const gradientStops = sortedSports.map(([sport, value], index) => {
    const percentage = (value / totalGlobal) * 100;
    const start = currentPercentage;
    const end = currentPercentage + percentage;
    currentPercentage = end;
    
    const colors = ['#AFFF25', '#91DB1C', '#74B514', '#588E0C', '#3D6806'];
    const color = colors[index % colors.length];
    
    return `${color} ${start}% ${end - 0.5}%, #040221 ${end - 0.5}% ${end}%`;
  }).join(', ');

  // 🚀 CORRECTION : Formattage propre sans le € automatique si on est dans "Nombres"
  const formattedTotal = isVal 
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalGlobal)
    : totalGlobal.toString();

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-36 font-sans relative overflow-x-hidden">
      
      <div className="absolute top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#AFFF25]/20 via-[#040221]/0 to-transparent pointer-events-none -z-10"></div>

      <header className="pt-10 pb-4 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">STATS</h1>
      </header>

      {/* 🚀 NOUVEAU : BARRE DE FILTRES */}
      <div className="px-6 flex gap-2 mb-8">
        <div className="relative flex-1">
          <select 
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="w-full bg-[#040221] border border-white/20 rounded-full py-2 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg"
          >
            <option value="">TOUS SPORTS</option>
            <option value="SOCCER">FOOTBALL</option>
            <option value="BASKETBALL">BASKETBALL</option>
            <option value="BASEBALL">BASEBALL</option>
            <option value="F1">FORMULE 1</option>
            <option value="NFL">NFL</option>
            <option value="NHL">NHL</option>
            <option value="TENNIS">TENNIS</option>
            <option value="POKEMON">POKÉMON</option>
            <option value="MARVEL">MARVEL</option>
          </select>
          <ChevronDown className="absolute right-3 top-2 text-white/50 pointer-events-none" size={14} />
        </div>

        <div className="relative flex-1">
          <select 
            value={selectedSpec}
            onChange={(e) => setSelectedSpec(e.target.value)}
            className="w-full bg-[#040221] border border-white/20 rounded-full py-2 pl-4 pr-8 text-xs font-bold uppercase outline-none appearance-none text-white shadow-lg"
          >
            <option value="">SPÉCIFICITÉS</option>
            <option value="auto">AUTO</option>
            <option value="patch">PATCH</option>
            <option value="rookie">ROOKIE</option>
            <option value="numbered">NUMÉROTÉE</option>
          </select>
          <ChevronDown className="absolute right-3 top-2 text-white/50 pointer-events-none" size={14} />
        </div>
      </div>

      <div className="flex justify-center gap-10 mb-8">
        <button 
          onClick={() => setActiveTab('nombres')}
          className={`text-lg font-bold transition-all ${activeTab === 'nombres' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          Nombres
        </button>
        <button 
          onClick={() => setActiveTab('valeurs')}
          className={`text-lg font-bold transition-all ${activeTab === 'valeurs' ? 'text-[#AFFF25] drop-shadow-[0_0_10px_rgba(175,255,37,0.5)]' : 'text-white/40 hover:text-white/70'}`}
        >
          Valeurs
        </button>
      </div>

      {/* 🚀 CORRECTION : Affichage conditionnel de l'Euro */}
      <div className="text-center mb-8 px-4">
        <div className="text-6xl font-black italic tracking-tighter leading-none whitespace-nowrap flex justify-center items-baseline">
          {isVal ? formattedTotal.replace('€', '').trim() : totalGlobal}
          {isVal && <span className="text-5xl ml-1 text-[#AFFF25]">€</span>}
        </div>
        <div className="text-[#AFFF25] text-xs font-bold uppercase tracking-widest mt-2">
          {isVal ? "Valeur totale" : "Cartes trouvées"}
        </div>
      </div>

      <div className="px-6 grid grid-cols-3 gap-3 mb-12">
        <div className="bg-[#080531]/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center">
          <div className="text-[10px] text-white/70 mb-1">Autos</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalAutos} €` : totalAutos}</div>
        </div>
        <div className="bg-[#080531]/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center">
          <div className="text-[10px] text-white/70 mb-1">Patchs</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalPatchs} €` : totalPatchs}</div>
        </div>
        <div className="bg-[#080531]/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col justify-center">
          <div className="text-[10px] text-white/70 mb-1">Numérotées</div>
          <div className="text-[#AFFF25] font-black italic text-lg">{isVal ? `${totalNumbered} €` : totalNumbered}</div>
        </div>
      </div>

      {totalGlobal > 0 ? (
        <div className="relative w-full flex justify-center mt-12 mb-10 px-6">
          <div className="relative w-64 h-64">
            <div 
              className="w-full h-full rounded-full drop-shadow-[0_0_20px_rgba(175,255,37,0.1)] transition-all duration-700"
              style={{ 
                background: `conic-gradient(${gradientStops})`,
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 35%, black 36%)',
                maskImage: 'radial-gradient(circle at center, transparent 35%, black 36%)'
              }}
            ></div>

            {sortedSports.map(([sport, value], index) => {
              if (index > 3) return null; 
              let angle = 0;
              let previousPercent = 0;
              for(let i=0; i<=index; i++) {
                const percent = (sortedSports[i][1] / totalGlobal);
                if (i === index) angle = (previousPercent + percent/2) * 360;
                previousPercent += percent;
              }
              const rad = (angle - 90) * (Math.PI / 180);
              const x = Math.cos(rad) * 140; 
              const y = Math.sin(rad) * 140;

              return (
                <div 
                  key={sport}
                  className="absolute text-[#AFFF25] text-xs font-medium"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                    textShadow: '0 2px 10px rgba(0,0,0,1)'
                  }}
                >
                  {sport}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center mt-12 text-white/40 italic font-bold">
          Aucune donnée à afficher pour ces filtres.
        </div>
      )}

    </div>
  );
}
