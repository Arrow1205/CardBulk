'use client';
import { supabase } from '@/lib/supabase';
import { Chrome } from 'lucide-react';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-black italic uppercase mb-4 tracking-tighter">
        CARD<span className="text-[#AFFF25]">BULK</span>
      </h1>
      <p className="text-white/40 uppercase text-[10px] tracking-[0.4em] mb-16 font-bold">The Collector's Empire</p>
      
      <button 
        onClick={handleGoogleLogin}
        className="w-full max-w-sm bg-white text-[#040221] font-bold py-5 rounded-[24px] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl shadow-white/5"
      >
        <Chrome size={24} />
        <span className="uppercase tracking-wider">Continuer avec Google</span>
      </button>

      <div className="mt-20 flex gap-8 opacity-20 italic font-black uppercase text-xs">
        <span>Scan</span>
        <span>Stats</span>
        <span>Collect</span>
      </div>
    </div>
  );
}