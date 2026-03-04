'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Si l'utilisateur a une session active, on l'envoie sur sa collection
        router.push('/collection');
      } else {
        // Sinon, direction la page de connexion
        router.push('/login');
      }
    };
    
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center relative z-10">
      <Loader2 className="animate-spin text-[#AFFF25] mb-4" size={40} />
      <p className="text-[#AFFF25] text-xs font-bold italic tracking-widest animate-pulse">
        CHARGEMENT...
      </p>
    </div>
  );
}