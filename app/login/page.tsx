'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, Lock, UserPlus, LogIn, ChevronRight } from 'lucide-react';

const SPORT_CONFIG = [
  { id: 'SOCCER', label: 'Football' },
  { id: 'BASKETBALL', label: 'Basketball' },
  { id: 'BASEBALL', label: 'Baseball' },
  { id: 'F1', label: 'Formule 1' },
  { id: 'NFL', label: 'Football Am.' },
  { id: 'NHL', label: 'Hockey' },
  { id: 'TENNIS', label: 'Tennis' }
];

export default function LoginPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [errorMsg, setErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [age, setAge] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  useEffect(() => {
    checkSession();

    // 🚨 LE CORRECTIF EST ICI : Écouteur en temps réel pour capter le retour de Google 🚨
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await checkProfileCompletion(session.user.id);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await checkProfileCompletion(session.user.id);
    } else {
      setInitialCheck(false);
    }
  };

  const checkProfileCompletion = async (userId: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (profile?.pseudo) {
        router.push('/');
      } else {
        setStep(2);
        setInitialCheck(false);
      }
    } catch (err) {
      setStep(2);
      setInitialCheck(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) setStep(2);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await checkProfileCompletion(data.user.id);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` }
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autorisé");

      const { error } = await supabase.from('profiles').update({
        pseudo,
        age: parseInt(age) || null,
        sports: selectedSports
      }).eq('id', user.id);

      if (error) throw error;
      router.push('/');
    } catch (error: any) {
      setErrorMsg(error.message || 'Erreur lors de la sauvegarde du profil.');
      setLoading(false);
    }
  };

  const toggleSport = (sportId: string) => {
    setSelectedSports(prev => prev.includes(sportId) ? prev.filter(id => id !== sportId) : [...prev, sportId]);
  };

  if (initialCheck) return <div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#040221] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden font-sans">
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#AFFF25]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-sm relative z-10">
        <div className="flex justify-center mb-10">
          <img src="/Logo-scan-hobby.svg" alt="Scan Hobby" className="h-16 object-contain" />
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs font-bold p-4 rounded-xl mb-6 text-center">
            {errorMsg}
          </div>
        )}

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-center">{isSignUp ? 'Créer un compte' : 'Se connecter'}</h1>
            <p className="text-white/50 text-xs text-center mb-8 font-medium">{isSignUp ? 'Rejoignez la communauté Scan Hobby' : 'Bon retour parmi nous !'}</p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-white/40" size={18} />
                <input type="email" required placeholder="Adresse Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#080531] border border-white/10 p-3.5 pl-12 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-white/40" size={18} />
                <input type="password" required placeholder="Mot de passe" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#080531] border border-white/10 p-3.5 pl-12 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" />
              </div>
              <button disabled={loading} type="submit" className="w-full bg-[#AFFF25] text-[#040221] py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#9ee615] active:scale-95 transition-all mt-4">
                {loading ? <Loader2 size={16} className="animate-spin" /> : (isSignUp ? <><UserPlus size={16} /> S'inscrire</> : <><LogIn size={16} /> Connexion</>)}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="h-[1px] flex-1 bg-white/10"></div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">OU</span>
              <div className="h-[1px] flex-1 bg-white/10"></div>
            </div>

            <button onClick={handleGoogleAuth} disabled={loading} className="w-full bg-white text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-100 active:scale-95 transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Continuer avec Google
            </button>

            <div className="mt-8 text-center">
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-white/60 text-xs font-medium hover:text-white transition-colors">
                {isSignUp ? "Déjà un compte ? Connectez-vous" : "Pas encore de compte ? Créer un profil"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-center text-[#AFFF25]">Dernière étape !</h1>
            <p className="text-white/60 text-xs text-center mb-8 font-medium">Faisons un peu connaissance pour personnaliser ton expérience.</p>

            <form onSubmit={saveProfile} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Ton Pseudo</label>
                  <input type="text" required placeholder="Ex: PaniniMaster99" value={pseudo} onChange={e => setPseudo(e.target.value)} className="w-full bg-[#080531] border border-white/10 p-3.5 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" />
                </div>
                <div className="relative">
                  <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-1">Ton Âge (Optionnel)</label>
                  <input type="number" placeholder="Ex: 28" min="1" max="99" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-[#080531] border border-white/10 p-3.5 rounded-xl text-sm outline-none focus:border-[#AFFF25]/50 transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#AFFF25] italic tracking-widest block mb-3">Que collectionnes-tu ? (Optionnel)</label>
                <div className="flex flex-wrap gap-2">
                  {SPORT_CONFIG.map(sport => {
                    const isSelected = selectedSports.includes(sport.id);
                    return (
                      <button key={sport.id} type="button" onClick={() => toggleSport(sport.id)} className={`px-4 py-2 rounded-full border text-xs font-bold transition-all duration-200 ${isSelected ? 'bg-[#AFFF25] border-[#AFFF25] text-[#040221]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
                        {sport.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button disabled={loading || !pseudo} type="submit" className="w-full bg-[#AFFF25] text-[#040221] py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#9ee615] active:scale-95 transition-all mt-8 disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>C'est parti <ChevronRight size={16} strokeWidth={3} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}