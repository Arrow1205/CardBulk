'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Trophy, Star } from 'lucide-react';

const slugify = (text: string) =>
  text.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');

const unslugify = (slug: string) =>
  slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const SPORT_FOLDERS: Record<string, string> = {
  SOCCER: 'foot', BASKETBALL: 'NBA', BASEBALL: 'MLB', NFL: 'NFL', NHL: 'NHL',
};

export default function JoueurPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const playerName = unslugify(slug);

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cartes' | 'stats'>('cartes');
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

  // API stats
  const [statsData, setStatsData] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFetched, setStatsFetched] = useState(false);

  useEffect(() => {
    loadCards();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'stats' && !statsFetched) fetchStats();
  }, [activeTab]);

  const loadCards = async () => {
    setLoading(true);
    // Offline cache first
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cardbulk_offline_cards') : null;
    if (saved) {
      const all = JSON.parse(saved);
      setCards(filterByPlayer(all));
      setLoading(false);
    }
    // Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('cards').select('*').eq('user_id', user.id);
      if (data) {
        const filtered = filterByPlayer(data.filter((c: any) => !c.is_wishlist));
        setCards(filtered);
        localStorage.setItem('cardbulk_offline_cards', JSON.stringify(data));
      }
    } catch {}
    setLoading(false);
  };

  const filterByPlayer = (all: any[]) => {
    const term = playerName.toLowerCase();
    return all.filter((c: any) => {
      const full = `${c.firstname || ''} ${c.lastname || ''}`.toLowerCase().trim();
      const rev = `${c.lastname || ''} ${c.firstname || ''}`.toLowerCase().trim();
      return full === term || rev === term || full.includes(term) || term.includes(full.replace(/\s+/g, ' '));
    });
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsFetched(true);
    try {
      const res = await fetch(`/api/player-stats?name=${encodeURIComponent(playerName)}`);
      const data = await res.json();
      setStatsData(data);
    } catch {}
    setStatsLoading(false);
  };

  const handleImageLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)
      setHorizontalCards(prev => ({ ...prev, [id]: true }));
  };

  if (loading) return (
    <div className="min-h-screen bg-[#040221] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#AFFF25]" size={40} />
    </div>
  );

  // Player info — from API if available, else from cards
  const apiPlayer = statsData?.player;
  const firstCard = cards[0];
  const displayFirstname = apiPlayer?.firstname || firstCard?.firstname || '';
  const displayLastname = apiPlayer?.lastname || firstCard?.lastname || playerName;
  const playerPhoto = apiPlayer?.photo || null;
  const playerNationality = apiPlayer?.nationality || null;
  const playerAge = apiPlayer?.age || null;

  // Clubs from cards
  const uniqueClubs = Array.from(new Set(
    cards.map(c => c.club_name).filter(Boolean)
  )).sort() as string[];

  const filteredCards = selectedClub
    ? cards.filter(c => c.club_name === selectedClub)
    : cards;

  // Stats grouped by season desc
  const stats: any[] = statsData?.stats || [];
  const trophies: any[] = statsData?.trophies || [];
  const statsBySeason = stats.reduce((acc: Record<string, any[]>, s: any) => {
    const key = String(s.season);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  const sortedSeasons = Object.keys(statsBySeason).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans">
      {/* Background blur from photo */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {playerPhoto && (
          <img src={playerPhoto} alt="" className="w-full h-64 object-cover object-top opacity-10 blur-2xl scale-110" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040221]/60 via-[#040221]/90 to-[#040221]" />
      </div>

      {/* Header */}
      <div className="relative z-10 pt-[calc(1.5rem+env(safe-area-inset-top))] px-6 lg:px-[80px] flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-5 flex-1 min-w-0">
          {/* Photo */}
          <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
            {playerPhoto ? (
              <img src={playerPhoto} alt={displayLastname} className="w-full h-full object-cover object-top" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl font-black italic uppercase">
                {displayLastname.charAt(0)}
              </div>
            )}
          </div>

          {/* Name */}
          <div className="min-w-0">
            {playerNationality && (
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">{playerNationality}{playerAge ? ` · ${playerAge} ans` : ''}</div>
            )}
            <div className="text-sm text-white/50 uppercase tracking-widest">{displayFirstname}</div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-[#AFFF25] truncate">{displayLastname}</h1>
            <div className="text-xs text-white/30 mt-1">{cards.length} carte{cards.length > 1 ? 's' : ''} dans ta collection</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 px-6 lg:px-[80px] mt-6 flex gap-6 border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab('cartes')}
          className={`pb-3 text-sm font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'cartes' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}
        >
          Cartes
          {activeTab === 'cartes' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25]" />}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-3 text-sm font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'stats' ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}
        >
          Stats
          {activeTab === 'stats' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25]" />}
        </button>
      </div>

      {/* ── TAB CARTES ── */}
      {activeTab === 'cartes' && (
        <div className="relative z-10 px-6 lg:px-[80px] pt-5 pb-32">
          {/* Club filter */}
          {uniqueClubs.length > 1 && (
            <div className="overflow-x-auto mb-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex gap-2 w-max">
                <button
                  onClick={() => setSelectedClub(null)}
                  className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${!selectedClub ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white/60'}`}
                >
                  Tous les clubs
                </button>
                {uniqueClubs.map(club => {
                  const sport = cards.find(c => c.club_name === club)?.sport || 'SOCCER';
                  const sportFolder = SPORT_FOLDERS[sport] || 'foot';
                  return (
                    <button
                      key={club}
                      onClick={() => setSelectedClub(selectedClub === club ? null : club)}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${selectedClub === club ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white/60'}`}
                    >
                      <img
                        src={`/asset/logo-club/${sportFolder}/${slugify(club)}.svg`}
                        alt={club}
                        className={`h-4 w-4 object-contain ${selectedClub === club ? '' : 'opacity-60'}`}
                        onError={e => e.currentTarget.style.display = 'none'}
                      />
                      {club}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredCards.length === 0 && (
            <div className="text-center py-20 text-white/30 italic text-sm">Aucune carte pour ce filtre.</div>
          )}

          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 grid-flow-dense">
            {filteredCards.map(card => {
              const isHorizontal = horizontalCards[card.id] || card.is_horizontal;
              return (
                <div
                  key={card.id}
                  onClick={() => router.push(`/card/${card.id}`)}
                  className={`relative rounded-[12px] overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform hover:border-[#AFFF25]/30 ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'}`}
                >
                  {card.image_url ? (
                    <img
                      src={card.image_url}
                      alt={card.lastname}
                      onLoad={e => handleImageLoad(card.id, e)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px] p-2 text-center">
                      {card.brand} {card.series}
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                    {card.is_auto && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#f59e0b]/90 text-black font-black">A</span>}
                    {card.is_patch && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#a78bfa]/90 text-black font-black">P</span>}
                    {card.is_numbered && <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/80 text-white font-black">/{card.numbering_max}</span>}
                    {card.is_rookie && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#34d399]/90 text-black font-black">RC</span>}
                  </div>
                  {card.is_graded && (
                    <div className="absolute bottom-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded bg-[#AFFF25]/90 text-black font-black">
                      {card.grading_company} {card.grading_grade}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB STATS ── */}
      {activeTab === 'stats' && (
        <div className="relative z-10 px-6 lg:px-[80px] pt-5 pb-32">
          {statsLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-[#AFFF25]" size={32} />
              <p className="text-white/40 text-sm">Récupération des stats...</p>
            </div>
          )}

          {!statsLoading && statsData?.player === null && (
            <div className="text-center py-20">
              <p className="text-white/40 text-sm mb-2">Joueur introuvable dans l'API.</p>
              <p className="text-white/20 text-xs">Vérifie que le nom correspond exactement.</p>
            </div>
          )}

          {!statsLoading && statsData && statsData.player && (
            <>
              {/* Current club from most recent stat */}
              {stats[0]?.team && (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  {stats[0].teamLogo && <img src={stats[0].teamLogo} alt={stats[0].team} className="h-10 w-10 object-contain" />}
                  <div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Club actuel</div>
                    <div className="text-lg font-black text-white">{stats[0].team}</div>
                  </div>
                  {stats[0].rating && (
                    <div className="ml-auto text-right">
                      <div className="text-[10px] text-white/40 uppercase tracking-widest">Note moy.</div>
                      <div className="text-2xl font-black text-[#AFFF25]">{stats[0].rating}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Stats table per season */}
              {sortedSeasons.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Statistiques par saison</h3>
                  <div className="space-y-3">
                    {sortedSeasons.map(season => (
                      <div key={season} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                        {statsBySeason[season].map((s: any, i: number) => (
                          <div key={i} className={i > 0 ? 'border-t border-white/[0.05]' : ''}>
                            {/* Season + team header */}
                            <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02]">
                              <div className="text-xs font-black text-[#AFFF25]">{season}/{Number(season) + 1 - 2000}</div>
                              {s.teamLogo && <img src={s.teamLogo} alt={s.team} className="h-5 w-5 object-contain" />}
                              <div className="text-xs font-bold text-white">{s.team}</div>
                              {s.leagueLogo && <img src={s.leagueLogo} alt={s.league} className="h-4 w-4 object-contain ml-auto opacity-60" />}
                              <div className="text-[10px] text-white/30 truncate max-w-[120px]">{s.league}</div>
                            </div>
                            {/* Stats grid */}
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-px bg-white/[0.04]">
                              {[
                                { label: 'Matchs', value: s.appearances ?? '—' },
                                { label: 'Min', value: s.minutes ? `${s.minutes}'` : '—' },
                                { label: 'Buts', value: s.goals ?? '—', highlight: (s.goals ?? 0) > 0 },
                                { label: 'Passes', value: s.assists ?? '—', highlight: (s.assists ?? 0) > 0 },
                                { label: 'Tirs', value: s.shots ?? '—' },
                                { label: 'Tirs C.', value: s.shotsOn ?? '—' },
                                { label: 'J', value: s.yellowCards ?? '—', warn: (s.yellowCards ?? 0) > 0 },
                                { label: 'R', value: s.redCards ?? '—', danger: (s.redCards ?? 0) > 0 },
                              ].map(stat => (
                                <div key={stat.label} className="bg-[#040221] px-3 py-3 text-center">
                                  <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">{stat.label}</div>
                                  <div className={`text-sm font-black ${(stat as any).highlight ? 'text-[#AFFF25]' : (stat as any).warn ? 'text-yellow-400' : (stat as any).danger ? 'text-red-500' : 'text-white'}`}>
                                    {stat.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trophies */}
              {trophies.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">
                    Palmarès ({trophies.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {trophies.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <Trophy size={16} className="text-[#f59e0b] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{t.league}</div>
                          <div className="text-[10px] text-white/40">{t.country} · {t.season}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.length === 0 && !statsLoading && (
                <div className="text-center py-12 text-white/30 italic text-sm">Aucune statistique disponible.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
