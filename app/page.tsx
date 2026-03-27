'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, User, ChevronDown, LogOut, UserPlus, ScanLine } from 'lucide-react';

// Type pour gérer notre multi-compte
type StoredAccount = {
  id: string;
  email: string;
  pseudo: string;
  access_token: string;
  refresh_token: string;
};

export default function HomePage() {
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const [horizontalCards, setHorizontalCards] = useState<Set<string>>(new Set());

  // 🚨 ÉTATS POUR LE MENU PROFIL ET LE MULTI-COMPTE 🚨
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountListOpen, setIsAccountListOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPseudo, setUserPseudo] = useState<string>('');
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    
    const user = session.user;
    setUserEmail(user.email || '');

    // Récupération du pseudo
    const { data: profile } = await supabase.from('profiles').select('pseudo').eq('id', user.id).single();
    const currentPseudo = profile?.pseudo || 'Pseudo';
    setUserPseudo(currentPseudo);

    // ---- GESTION DU MULTI-COMPTE ----
    const stored = localStorage.getItem('cardbulk_accounts');
    let parsedAccs: StoredAccount[] = stored ? JSON.parse(stored) : [];
    
    const currentAcc: StoredAccount = {
      id: user.id,
      email: user.email || '',
      pseudo: currentPseudo,
      access_token: session.access_token,
      refresh_token: session.refresh_token
    };

    const accIndex = parsedAccs.findIndex(a => a.id === user.id);
    if (accIndex > -1) {
      parsedAccs[accIndex] = currentAcc;
    } else {
      parsedAccs.push(currentAcc);
    }

    localStorage.setItem('cardbulk_accounts', JSON.stringify(parsedAccs));
    setAccounts(parsedAccs);
    // ---------------------------------

    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setCards(data.filter(c => !c.is_wishlist));
    setLoading(false);
  };

  // 🚨 AJOUTER UN COMPTE 🚨
  const handleAddAccount = async () => {
    // Déconnexion avec scope "local" : retire la session du navigateur
    // SANS invalider les tokens côté serveur, ce qui permet de les réutiliser !
    await (supabase.auth.signOut as any)({ scope: 'local' });
    router.push('/login');
  };

  // 🚨 CHANGER DE COMPTE 🚨
  const switchAccount = async (acc: StoredAccount) => {
    setIsMenuOpen(false);
    setLoading(true);
    
    const { error } = await supabase.auth.setSession({
      access_token: acc.access_token,
      refresh_token: acc.refresh_token
    });

    if (error) {
      alert("La session de ce compte a expiré. Veuillez vous reconnecter.");
      const newAccs = accounts.filter(a => a.id !== acc.id);
      localStorage.setItem('cardbulk_accounts', JSON.stringify(newAccs));
      setAccounts(newAccs);
      setLoading(false);
    } else {
      window.location.reload(); // Recharge la page avec le nouveau compte
    }
  };

  // 🚨 SE DÉCONNECTER (Compte actuel) 🚨
  const handleLogout = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.auth.signOut(); // Déconnexion totale pour ce compte

    if (user) {
      const newAccs = accounts.filter(a => a.id !== user.id);
      localStorage.setItem('cardbulk_accounts', JSON.stringify(newAccs));
      
      // S'il reste d'autres comptes, on bascule automatiquement sur le premier dispo
      if (newAccs.length > 0) {
        await supabase.auth.setSession({
          access_token: newAccs[0].access_token,
          refresh_token: newAccs[0].refresh_token
        });
        window.location.reload();
        return;
      }
    }
    router.push('/login');
  };

  const handleImageLoad = (img: HTMLImageElement, id: string) => {
    if (img.naturalWidth > img.naturalHeight) {
      setHorizontalCards(prev => {
        if (prev.has(id)) return prev; 
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    }
  };

  const favoriteCards = cards.filter(c => c.is_favorite);
  const carouselCards = favoriteCards.length > 0 ? favoriteCards : cards.slice(0, 5);
  const recentCards = cards.slice(0, 5);

  useEffect(() => {
    if (carouselCards.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselCards.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselCards.length]);

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.targetTouches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > 50) setActiveIndex((prev) => Math.min(prev + 1, carouselCards.length - 1));
    else if (swipeDistance < -50) setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  if (loading) return <div className="min-h-screen bg-[#040221] flex justify-center items-center"><Loader2 className="animate-spin text-[#AFFF25]" size={40} /></div>;

  const otherAccounts = accounts.filter(a => a.email !== userEmail);

  return (
    <div className="min-h-screen bg-[#040221] text-white pb-32 font-sans overflow-x-hidden relative z-10">
      
      {/* 🚨 MODALE DU MENU UTILISATEUR 🚨 */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute top-[calc(4.5rem+env(safe-area-inset-top))] right-6 w-[280px] bg-[#0A072E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Profil Actif & Switcher */}
            <div className="p-4 transition-colors">
              <div 
                className={`flex items-center justify-between ${otherAccounts.length > 0 ? 'cursor-pointer group' : ''}`}
                onClick={() => otherAccounts.length > 0 && setIsAccountListOpen(!isAccountListOpen)}
              >
                <span className="font-bold text-lg text-[#AFFF25]">{userPseudo || 'Profil'}</span>
                {otherAccounts.length > 0 && (
                  <ChevronDown size={16} className={`text-white/50 transition-transform ${isAccountListOpen ? 'rotate-180' : ''}`} />
                )}
              </div>
              <div className="text-xs text-white/50 mt-1 truncate">{userEmail}</div>

              {/* Liste des autres comptes */}
              {isAccountListOpen && otherAccounts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2 px-1">Changer de compte</div>
                  {otherAccounts.map(acc => (
                    <div 
                      key={acc.id} 
                      onClick={() => switchAccount(acc)} 
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer active:scale-95 transition-all"
                    >
                      <div className="overflow-hidden pr-2">
                        <div className="text-sm font-bold text-white truncate">{acc.pseudo}</div>
                        <div className="text-[10px] text-white/50 truncate">{acc.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ajouter un compte */}
            <div className="border-t border-white/10 p-2">
              <button 
                onClick={handleAddAccount} 
                className="w-full flex items-center gap-3 p-3 text-sm text-white/80 font-medium hover:bg-white/5 rounded-xl transition-colors text-left"
              >
                <UserPlus size={18} />
                Ajouter un autre compte
              </button>
            </div>

            {/* Se déconnecter */}
            <div className="border-t border-white/10 p-2">
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center gap-3 p-3 text-sm text-red-500 font-medium hover:bg-red-500/10 rounded-xl transition-colors text-left"
              >
                <LogOut size={18} />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="pt-[calc(1.5rem+env(safe-area-inset-top))] pb-2 px-6 flex items-center relative">
        <div className="flex-1"></div>
        <img src="/Logo-scan-hobby.svg" alt="Scan Hobby Logo" className="h-[3.4rem] object-contain active:scale-95 transition-transform" />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setIsMenuOpen(true)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-all hover:bg-white/10 text-white">
            <User size={18} />
          </button>
        </div>
      </header>

      <div className="w-full px-[2%] mt-2">
        <div className="relative w-full h-[55vh] flex items-center justify-center overflow-hidden" style={{ perspective: '1200px' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {carouselCards.length === 0 ? (
            
            /* ÉCRAN DE BIENVENUE */
            <div className="flex flex-col items-center justify-center gap-6 px-6 text-center z-20 animate-in fade-in zoom-in duration-500">
              <h1 className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter text-[#AFFF25] leading-none">
                HELLO !<br />
                {userPseudo || 'COLLECTIONNEUR'}
              </h1>
              
              <h3 className="text-base lg:text-lg font-medium text-white max-w-sm mx-auto mb-2">
                Bienvenue sur Scanhobby, numérise ta collection dès maintenant
              </h3>
              
              <button 
                onClick={() => router.push('/scanner')} 
                className="bg-[#AFFF25] text-[#040221] px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-[0_0_20px_rgba(175,255,37,0.3)] flex items-center gap-2 mt-4"
              >
                <ScanLine size={18} strokeWidth={2.5} /> Scanner ma première carte
              </button>
            </div>

          ) : (
            carouselCards.map((card, index) => {
              const isHorizontal = horizontalCards.has(card.id);
              const offset = index - activeIndex;
              const absOffset = Math.abs(offset);
              if (absOffset > 2) return null;

              return (
                <div key={card.id} onClick={() => offset === 0 ? router.push(`/card/${card.id}`) : setActiveIndex(index)} className="absolute flex items-center justify-center transition-transform duration-500 ease-out cursor-pointer" style={{ width: isHorizontal ? '434px' : '240px', height: isHorizontal ? '280px' : '320px', maxWidth: isHorizontal ? '90vw' : '70vw', transform: `translateX(${Math.sign(offset) * (absOffset * 50)}%) translateZ(${absOffset * -150}px) rotateY(${Math.sign(offset) * -35}deg)`, zIndex: 10 - absOffset, opacity: absOffset > 1 ? 0.4 : (absOffset > 1 ? 0 : 1) }}>
                  <div className="w-full h-full relative bg-[#080531]" style={{ borderRadius: '8px', overflow: 'hidden', transform: 'translateZ(0)', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                    {card.image_url ? <img src={card.image_url} onLoad={(e) => handleImageLoad(e.currentTarget, card.id)} className="w-full h-full object-cover block" alt="Card" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No Image</div>}
                    <div className="absolute inset-0 border border-white/10 rounded-[8px] pointer-events-none"></div>
                  </div>
                </div>
              );
            })
          )}
          
          {carouselCards.length > 0 && (
            <div className="absolute bottom-2 flex gap-1.5 z-20">
              {carouselCards.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-[#AFFF25] w-3' : 'bg-white/30'}`} />)}
            </div>
          )}
        </div>
      </div>

      {recentCards.length > 0 && (
        <div className="px-6 mt-8">
          <h2 className="text-xl font-black italic uppercase tracking-tighter mb-4">Derniers ajouts</h2>
          <div className="space-y-3">
            {recentCards.map(card => {
              const isHorizontal = horizontalCards.has(card.id);
              return (
                <div key={card.id} onClick={() => router.push(`/card/${card.id}`)} className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-3 cursor-pointer active:scale-95 transition-transform">
                  <div className={`h-24 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-[#080531] shadow-lg ${isHorizontal ? 'w-32' : 'w-16'}`}>
                    {card.image_url ? <img src={card.image_url} className="w-full h-full object-cover" alt="Thumb" /> : <div className="text-[8px] text-white/30">N/A</div>}
                  </div>
                  <div className="flex flex-col justify-center flex-1 overflow-hidden">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold truncate mb-1">{card.brand} — {card.series || 'Base'}</div>
                    <div className="text-2xl font-black italic text-[#AFFF25] uppercase tracking-tighter leading-none truncate mb-2">{card.firstname} {card.lastname}</div>
                    <div className="flex flex-wrap gap-1">
                      {card.is_patch && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Patch</span>}
                      {card.is_auto && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Auto</span>}
                      {card.is_numbered && <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold text-white">Num</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}