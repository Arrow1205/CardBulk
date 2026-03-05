'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function StatsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Onglet actif : 'nombres' ou 'valeurs'
  const [activeTab, setActiveTab] = useState<'nombres' | 'valeurs'>('valeurs');

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

  // 🚀 CALCUL DES STATISTIQUES GLOBAL
  const isVal = activeTab === 'valeurs';
  
  // Fonction utilitaire : on somme +1 (nombres) ou +price (valeurs)
  const calculateTotal = (filterFn: (c: any) => boolean) => {
    return cards.filter(filterFn).reduce((acc, card) => {
      return acc + (isVal ? (parseFloat(card.purchase_price) || 0) : 1);
    }, 0);
  };

  const totalGlobal = calculateTotal(() => true);
  const totalAutos = calculateTotal(c => c.is_auto);
  const totalPatchs = calculateTotal(c => c.is_patch);
  const totalNumbered = calculateTotal(c => c.is_numbered);

  // 🚀 CALCUL POUR LE GRAPHIQUE DONUT (Par Sport)
  const statsBySport: Record<string, number> = {};
  cards.forEach(card => {
    const sport = card.sport || 'Autre';
    const amount = isVal ? (parseFloat(card.purchase_price) || 0) : 1;
    statsBySport[sport] = (statsBySport[sport] || 0) + amount;
  });

  // Tri des sports du plus grand au plus petit
  const sortedSports = Object.entries(statsBySport).sort((a, b) => b[1] - a[1]);
  
  // Génération du CSS pour le graphique "Conic Gradient"
  let currentPercentage = 0;
  const gradientStops = sortedSports.map(([sport, value], index) => {
    const percentage = (value / totalGlobal) * 100;
    const start = currentPercentage;
    const end = currentPercentage + percentage;
    currentPercentage = end;
    
    // On alterne légèrement la luminosité du vert pour différencier les parts
    const colors = ['#AFFF25', '#91DB1C', '#74B514', '#588E0C', '#3D6806'];
    const color = colors[index % colors.length];
    
    // Le gap noir entre les parts (1 degré)
    return `${color} ${start}% ${end - 0.5}%, #040221 ${end - 0.5}% ${end}%`;
  }).join(', ');

  const formattedTotal = isVal 
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalGlobal)
    : `${totalGlobal} Cartes`;

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-36 font-sans relative overflow-x-hidden">
      
      {/* Halo lumineux en haut */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#AFFF25]/20 via-[#040221]/0 to-transparent pointer-events-none -z-10"></div>

      <header className="pt-10 pb-6 text-center">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">STATS</h1>
      </header>

      {/* ONGLES NOMBRES / VALEURS */}
      <div className="flex justify-center gap-10 mb-10">
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

      {/* GROS CHIFFRE CENTRAL */}
      <div className="text-center mb-8 px-4">
        <div className="text-6xl font-black italic tracking-tighter leading-none whitespace-nowrap">
          {formattedTotal.replace('€', '').trim()} <span className="text-5xl">€</span>
        </div>
        {!isVal && <div className="text-[#AFFF25] text-xs font-bold uppercase tracking-widest mt-2">Dans ta collection</div>}
      </div>

      {/* 3 BOITES DE SOUS-STATISTIQUES */}
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

      {/* GRAPHIQUE DONUT DYNAMIQUE */}
      {totalGlobal > 0 && (
        <div className="relative w-full flex justify-center mt-12 mb-10 px-6">
          <div className="relative w-64 h-64">
            
            {/* Le Cercle Donut créé en CSS magique */}
            <div 
              className="w-full h-full rounded-full drop-shadow-[0_0_20px_rgba(175,255,37,0.1)] transition-all duration-700"
              style={{ 
                background: `conic-gradient(${gradientStops})`,
                /* mask-image permet de faire le "trou" au centre de l'anneau */
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 35%, black 36%)',
                maskImage: 'radial-gradient(circle at center, transparent 35%, black 36%)'
              }}
            ></div>

            {/* Labels flottants autours du graphique */}
            {sortedSports.map(([sport, value], index) => {
              if (index > 3) return null; // On n'affiche que le top 4 pour ne pas surcharger
              
              // Petit calcul mathématique pour placer les textes autour du cercle
              let angle = 0;
              let previousPercent = 0;
              for(let i=0; i<=index; i++) {
                const percent = (sortedSports[i][1] / totalGlobal);
                if (i === index) angle = (previousPercent + percent/2) * 360;
                previousPercent += percent;
              }
              
              const rad = (angle - 90) * (Math.PI / 180);
              const x = Math.cos(rad) * 140; // 140px d'éloignement du centre
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
      )}

    </div>
  );
}
