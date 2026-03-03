'use client';
import { supabase } from '@/lib/supabase';
import { Chrome } from 'lucide-react';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirige vers notre futur fichier callback
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) console.error("Erreur Google:", error.message);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-black italic uppercase mb-12 italic tracking-tighter">
        CARD<span className="text-[#AFFF25]">BULK</span>
      </h1>
      
      <button 
        onClick={handleGoogleLogin}
        className="w-full max-w-sm bg-white text-[#040221] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
      >
        <Chrome size={22} />
        Continuer avec Google
      </button>
    </div>
  );
}