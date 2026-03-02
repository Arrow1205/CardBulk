'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ScannerPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // 1. Activer la caméra au clic
  const startCamera = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    setStream(mediaStream);
    if (videoRef.current) videoRef.current.srcObject = mediaStream;
  };

  // 2. Prendre la photo et l'analyser
  const takePhoto = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current!.videoWidth;
    canvas.height = videoRef.current!.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current!, 0, 0);
    
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

    // Appel à Gemini via notre API
    const res = await fetch('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: base64 }),
    });
    
    const cardData = await res.json();
    
    // On redirige vers la page "Modifier" avec les données pré-remplies par Gemini
    // On passe les données en paramètre ou via un état global
    router.push(`/modifier/new?data=${encodeURIComponent(JSON.stringify(cardData))}`);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      {!stream ? (
        <button onClick={startCamera} className="bg-app-neon text-black px-8 py-4 rounded-full font-bold">
          OUVRIR LA CAMÉRA
        </button>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-10 flex gap-10">
            <button onClick={() => setStream(null)} className="text-white">Annuler</button>
            <button onClick={takePhoto} className="w-20 h-20 bg-white border-4 border-app-neon rounded-full" />
            <div className="w-10" /> {/* Spacer */}
          </div>
        </>
      )}
    </div>
  );
}