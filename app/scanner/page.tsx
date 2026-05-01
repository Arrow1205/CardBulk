'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Search, ChevronDown, Plus, Minus, Trash2, RotateCw, SlidersHorizontal, Wand2, X, Check, Camera, Image as ImageIcon, Crop, ArrowRight, ExternalLink } from 'lucide-react';

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
  'NFL': { image: 'NFL', jsonKey: 'nfl', label: 'NFL' },
  'TENNIS': { image: 'Tennis', jsonKey: 'tennis', label: 'Tennis' }
};

export default function ScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // --- ÉTATS D'ÉDITION ---
  const [rotation, setRotation] = useState(0);
  const [blackPoint, setBlackPoint] = useState(0); // Nouveau: Balance des noirs
  
  const [isFormStarted, setIsFormStarted] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Simulation de la fonction de changement de fichier
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setIsEditing(true);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black italic uppercase tracking-wider">Édition Scan</h1>
        <div className="w-10" />
      </div>

      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* ZONE DE PRÉVISUALISATION / ÉDITION */}
        {selectedImage && (
          <div className="relative group">
            <div className="relative rounded-3xl overflow-hidden bg-black/40 border border-white/10 aspect-[3/4] flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Preview"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  // Application du filtre colorimétrique : augmente le contraste et baisse la luminosité
                  filter: `contrast(${100 + blackPoint / 2}%) brightness(${100 - blackPoint / 5}%)`,
                  transition: 'all 0.3s ease'
                }}
                className="max-w-full max-h-full object-contain shadow-2xl"
              />
              
              {isEditing && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex flex-col justify-end p-6">
                  <div className="bg-[#040221]/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                    
                    {/* Gestion de la Rotation */}
                    <div className="flex justify-around items-center">
                       <button 
                        onClick={() => setRotation(prev => prev - 90)}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                       >
                        <RotateCw className="w-6 h-6 scale-x-[-1]" />
                       </button>
                       <button 
                        onClick={() => setRotation(prev => prev + 90)}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                       >
                        <RotateCw className="w-6 h-6" />
                       </button>
                    </div>

                    {/* NOUVEAU : GESTION COLORIMÉTRIQUE (POINTS NOIRS) */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-white/60 uppercase tracking-widest italic">Points Noirs</label>
                        <span className="text-xs font-mono bg-[#AFFF25]/10 px-2 py-1 rounded text-[#AFFF25] border border-[#AFFF25]/20">
                          {blackPoint}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={blackPoint}
                        onChange={(e) => setBlackPoint(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#AFFF25]"
                      />
                      <div className="flex justify-between text-[10px] text-white/40 uppercase italic font-bold">
                        <span>Standard</span>
                        <span>Noir Profond</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setIsEditing(false)}
                      className="w-full bg-[#AFFF25] text-[#040221] py-3 rounded-xl font-black italic uppercase text-sm hover:bg-[#9ee615] transition-all"
                    >
                      Appliquer les réglages
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full hover:bg-black/80 transition-all"
              >
                <SlidersHorizontal className="w-5 h-5 text-[#AFFF25]" />
              </button>
            )}
          </div>
        )}

        {/* RESTE DU FORMULAIRE */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
           <p className="text-center text-white/40 text-sm italic">
             {selectedImage ? "Ajustez la balance des noirs pour une meilleure détection par l'IA." : "Prenez une photo pour commencer."}
           </p>
           
           {!selectedImage && (
             <button 
                onClick={() => cameraInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-all mt-4"
             >
                <div className="p-4 bg-[#AFFF25]/10 rounded-full">
                    <Camera className="w-8 h-8 text-[#AFFF25]" />
                </div>
                <span className="text-sm font-bold uppercase italic text-white/60">Capturer une carte</span>
             </button>
           )}
        </div>

      </div>

      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
        capture="environment" 
      />
    </div>
  );
}