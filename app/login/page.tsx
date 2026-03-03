'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronLeft, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // Fonction pour se connecter
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: "Email ou mot de passe incorrect.", type: 'error' });
      setLoading(false);
    } else {
      router.push('/collection'); // Redirige vers la collection une fois connecté
    }
  };

  // Fonction pour créer un compte
  const handleSignUp = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: "Compte créé ! Tu peux maintenant te connecter.", type: 'success' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#040221] text-white p-6 flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center mb-12 mt-4">
        <button onClick={() => router.push('/')} className="w-10 h-10 bg-transparent rounded-full flex items-center justify-center border border-white/20">
          <ChevronLeft size={20} />
        </button>
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">
            CONNEXION
          </h1>
          <p className="text-[#AFFF25] text-xs font-bold uppercase tracking-widest">
            Accède à ta collection privée
          </p>
        </div>

        {/* Message d'erreur ou de succès */}
        {message && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-bold text-center ${message.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-[#AFFF25]/20 text-[#AFFF25] border border-[#AFFF25]/50'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Champ Email */}
          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1 ml-1">Email</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 text-white/40" size={18} />
              <input 
                type="email" 
                required
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com" 
                className="w-full bg-transparent border border-white/20 focus:border-[#AFFF25] p-4 rounded-full text-sm font-medium outline-none text-white pl-12 transition-colors"
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div className="relative">
            <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1 ml-1">Mot de passe</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 text-white/40" size={18} />
              <input 
                type="password" 
                required
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full bg-transparent border border-white/20 focus:border-[#AFFF25] p-4 rounded-full text-sm font-medium outline-none text-white pl-12 transition-colors"
              />
            </div>
          </div>

          <div className="pt-6 space-y-4">
            {/* Bouton Connexion */}
            <button 
              type="submit" 
              disabled={loading || !email || !password}
              className="w-full bg-[#AFFF25] text-black font-black italic py-4 rounded-full uppercase tracking-widest shadow-[0_10px_40px_rgba(175,255,37,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center h-[56px]"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Se Connecter'}
            </button>

            {/* Bouton Inscription (Secondaire) */}
            <button 
              type="button"
              onClick={handleSignUp}
              disabled={loading || !email || !password}
              className="w-full bg-transparent border border-[#AFFF25] text-[#AFFF25] font-black italic py-4 rounded-full uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center h-[56px]"
            >
              Créer un compte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
