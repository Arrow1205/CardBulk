'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Loader2, Trophy } from 'lucide-react';

const slugify = (text: string) =>
  text.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');

const unslugify = (slug: string) =>
  slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Normalize for fuzzy matching: strip accents + lowercase + alnum only
const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const SPORT_FOLDERS: Record<string, string> = {
  SOCCER: 'foot', BASKETBALL: 'NBA', BASEBALL: 'MLB', NFL: 'NFL', NHL: 'NHL',
};

function sumStats(rows: any[]) {
  return rows.reduce((acc, s) => ({
    appearances: (acc.appearances ?? 0) + (s.appearances ?? 0),
    minutes:     (acc.minutes ?? 0)     + (s.minutes ?? 0),
    goals:       (acc.goals ?? 0)       + (s.goals ?? 0),
    assists:     (acc.assists ?? 0)      + (s.assists ?? 0),
    shots:       (acc.shots ?? 0)       + (s.shots ?? 0),
    shotsOn:     (acc.shotsOn ?? 0)     + (s.shotsOn ?? 0),
    yellowCards: (acc.yellowCards ?? 0) + (s.yellowCards ?? 0),
    redCards:    (acc.redCards ?? 0)    + (s.redCards ?? 0),
  }), {} as any);
}

function StatCell({ label, value, highlight, warn, danger }: { label: string; value: any; highlight?: boolean; warn?: boolean; danger?: boolean }) {
  return (
    <div className="bg-[#040221] px-2 py-3 text-center">
      <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-sm font-black ${highlight ? 'text-[#AFFF25]' : warn ? 'text-yellow-400' : danger ? 'text-red-500' : 'text-white'}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

export default function JoueurPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const playerName = unslugify(slug); // e.g. "Desire Doue" (no accents, that's OK)

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cartes' | 'stats'>('cartes');
  const [horizontalCards, setHorizontalCards] = useState<Record<string, boolean>>({});
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

  const [statsData, setStatsData] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFetched, setStatsFetched] = useState(false);
  const recentNews: any[] = statsData?.recentNews || [];

  useEffect(() => { loadCards(); }, [slug]);
  useEffect(() => { if (activeTab === 'stats' && !statsFetched) fetchStats(); }, [activeTab]);

  const filterByPlayer = (all: any[]) => {
    const termNorm = norm(playerName);
    if (termNorm.length < 2) return [];
    return all.filter((c: any) => {
      const cardFull = norm(`${c.firstname || ''} ${c.lastname || ''}`);
      if (cardFull.length < 2) return false; // guard: empty card name matches nothing
      const cardRev = norm(`${c.lastname || ''} ${c.firstname || ''}`);
      return cardFull === termNorm || cardRev === termNorm
        || (cardFull.length >= 4 && termNorm.includes(cardFull))
        || (termNorm.length >= 4 && cardFull.includes(termNorm));
    });
  };

  const loadCards = async () => {
    setLoading(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cardbulk_offline_cards') : null;
    if (saved) {
      const all = JSON.parse(saved);
      setCards(filterByPlayer(all.filter((c: any) => !c.is_wishlist)));
      setLoading(false);
    }
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

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsFetched(true);
    try {
      const res = await fetch(`/api/player-stats?name=${encodeURIComponent(playerName)}`);
      setStatsData(await res.json());
    } catch (e) {
      console.error('fetchStats error:', e);
    }
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

  const apiPlayer = statsData?.player;
  const firstCard = cards[0];
  const displayFirstname  = apiPlayer?.firstname || firstCard?.firstname || '';
  const displayLastname   = apiPlayer?.lastname  || firstCard?.lastname  || playerName;
  const playerPhoto       = apiPlayer?.photo || null;
  const playerNationality = apiPlayer?.nationality || null;
  const playerAge         = apiPlayer?.age || null;
  const currentTeam       = apiPlayer?.currentTeam || null;
  const currentTeamLogo   = apiPlayer?.currentTeamLogo || null;

  const uniqueClubs = Array.from(new Set(cards.map(c => c.club_name).filter(Boolean))).sort() as string[];
  const filteredCards = selectedClub ? cards.filter(c => c.club_name === selectedClub) : cards;

  // ── Stats ──
  const allStats: any[] = statsData?.stats || [];
  const trophies: any[] = statsData?.trophies || [];

  // Saison en cours = la plus récente dans les données (tri sur seasonSort ou saison string)
  const sortedAllSeasons = Array.from(new Set(allStats.map(s => s.seasonSort ?? Number(s.season)))).sort((a, b) => b - a);
  const currentSeasonSort = sortedAllSeasons[0] ?? null;
  const currentSeasonLabel = allStats.find(s => (s.seasonSort ?? Number(s.season)) === currentSeasonSort)?.seasonLabel
    ?? (currentSeasonSort ? `${currentSeasonSort}/${String(Number(currentSeasonSort) + 1).slice(-2)}` : null);
  const currentSeasonRows = allStats.filter(s => (s.seasonSort ?? Number(s.season)) === currentSeasonSort);

  // Compétitions internationales (sélection)
  const INTL_KEYWORDS = ['world cup', 'euro', 'nations league', 'copa america', 'afcon', 'gold cup', 'friendlies', 'olympic', 'u21', 'u23'];
  const isIntl = (row: any) => INTL_KEYWORDS.some(k => (row.league || '').toLowerCase().includes(k));

  // Stats des saisons passées uniquement
  const pastRows = allStats.filter(s => (s.seasonSort ?? Number(s.season)) !== currentSeasonSort);

  // Agrégat par club (past seasons — club only, not intl)
  const clubMap: Record<string, { logo: string; rows: any[] }> = {};
  for (const s of pastRows) {
    if (isIntl(s)) continue;
    if (!s.team) continue;
    if ((s.appearances ?? 0) === 0 && (s.goals ?? 0) === 0) continue;
    if (!clubMap[s.team]) clubMap[s.team] = { logo: s.teamLogo || '', rows: [] };
    clubMap[s.team].rows.push(s);
  }
  const clubCareer = Object.entries(clubMap)
    .map(([team, { logo, rows }]) => ({ team, logo, ...sumStats(rows) }))
    .sort((a, b) => (b.appearances ?? 0) - (a.appearances ?? 0));

  // Agrégat sélection (all seasons)
  const intlMap: Record<string, { logo: string; rows: any[] }> = {};
  for (const s of allStats) {
    if (!isIntl(s)) continue;
    if (!s.team) continue;
    if ((s.appearances ?? 0) === 0 && (s.goals ?? 0) === 0) continue;
    if (!intlMap[s.team]) intlMap[s.team] = { logo: s.teamLogo || '', rows: [] };
    intlMap[s.team].rows.push(s);
  }
  const intlCareer = Object.entries(intlMap)
    .map(([team, { logo, rows }]) => ({ team, logo, ...sumStats(rows) }))
    .sort((a, b) => (b.appearances ?? 0) - (a.appearances ?? 0));

  return (
    <div className="min-h-screen bg-[#040221] text-white font-sans">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {playerPhoto && <img src={playerPhoto} alt="" className="w-full h-64 object-cover object-top opacity-10 blur-2xl scale-110" />}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040221]/60 via-[#040221]/90 to-[#040221]" />
      </div>

      {/* Header */}
      <div className="relative z-10 pt-[calc(1.5rem+env(safe-area-inset-top))] px-6 lg:px-[80px] flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-5 flex-1 min-w-0">
          <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
            {playerPhoto
              ? <img src={playerPhoto} alt={displayLastname} className="w-full h-full object-cover object-top" />
              : <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl font-black italic uppercase">{displayLastname.charAt(0)}</div>
            }
          </div>
          <div className="min-w-0">
            {(playerNationality || currentTeam) && (
              <div className="flex items-center gap-2 mb-1">
                {playerNationality && (
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    {playerNationality}{playerAge ? ` · ${playerAge} ans` : ''}
                  </span>
                )}
                {currentTeam && (
                  <span className="flex items-center gap-1 text-[10px] text-white/30 uppercase tracking-widest">
                    {currentTeamLogo && <img src={currentTeamLogo} alt={currentTeam} className="h-3.5 w-3.5 object-contain" onError={e => e.currentTarget.style.display='none'} />}
                    {currentTeam}
                  </span>
                )}
              </div>
            )}
            <div className="text-sm text-white/50 uppercase tracking-widest">{displayFirstname}</div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-[#AFFF25] truncate">{displayLastname}</h1>
            <div className="text-xs text-white/30 mt-1">{cards.length} carte{cards.length !== 1 ? 's' : ''} dans ta collection</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 px-6 lg:px-[80px] mt-6 flex gap-6 border-b border-white/[0.08]">
        {(['cartes', 'stats'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold uppercase tracking-widest transition-colors relative ${activeTab === tab ? 'text-[#AFFF25]' : 'text-white/40 hover:text-white/60'}`}>
            {tab === 'cartes' ? `Cartes (${cards.length})` : 'Stats'}
            {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#AFFF25]" />}
          </button>
        ))}
      </div>

      {/* ── TAB CARTES ── */}
      {activeTab === 'cartes' && (
        <div className="relative z-10 px-6 lg:px-[80px] pt-5 pb-32">
          {cards.length === 0 && (
            <div className="text-center py-20 text-white/30 italic text-sm">Aucune carte de ce joueur dans ta collection.</div>
          )}

          {uniqueClubs.length > 1 && (
            <div className="overflow-x-auto mb-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex gap-2 w-max">
                <button onClick={() => setSelectedClub(null)}
                  className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${!selectedClub ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white/60'}`}>
                  Tous les clubs
                </button>
                {uniqueClubs.map(club => {
                  const sport = cards.find(c => c.club_name === club)?.sport || 'SOCCER';
                  const sportFolder = SPORT_FOLDERS[sport] || 'foot';
                  return (
                    <button key={club} onClick={() => setSelectedClub(selectedClub === club ? null : club)}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${selectedClub === club ? 'bg-[#AFFF25] text-[#040221] border-[#AFFF25]' : 'bg-white/5 border-white/10 text-white/60'}`}>
                      <img src={`/asset/logo-club/${sportFolder}/${slugify(club)}.svg`} alt={club} className={`h-4 w-4 object-contain ${selectedClub === club ? '' : 'opacity-60'}`} onError={e => e.currentTarget.style.display = 'none'} />
                      {club}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 grid-flow-dense">
            {filteredCards.map(card => {
              const isHorizontal = horizontalCards[card.id] || card.is_horizontal;
              return (
                <div key={card.id} onClick={() => router.push(`/card/${card.id}`)}
                  className={`relative rounded-[12px] overflow-hidden bg-white/5 border border-white/10 cursor-pointer active:scale-95 transition-transform hover:border-[#AFFF25]/30 ${isHorizontal ? 'col-span-2 aspect-[1.55]' : 'col-span-1 aspect-[3/4]'}`}>
                  {card.image_url
                    ? <img src={card.image_url} alt={card.lastname} onLoad={e => handleImageLoad(card.id, e)} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px] p-2 text-center">{card.brand} {card.series}</div>
                  }
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                    {card.is_auto    && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#f59e0b]/90 text-black font-black">A</span>}
                    {card.is_patch   && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#a78bfa]/90 text-black font-black">P</span>}
                    {card.is_numbered && <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/80 text-white font-black">/{card.numbering_max}</span>}
                    {card.is_rookie  && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#34d399]/90 text-black font-black">RC</span>}
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
              <p className="text-white/20 text-xs">Essaie de corriger le nom dans l'URL.</p>
            </div>
          )}

          {!statsLoading && statsData?.player && (
            <>
              {/* ── SAISON EN COURS : détail par compétition ── */}
              {currentSeasonRows.length > 0 && (
                <div className="mb-7">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#AFFF25]">Dernière saison</span>
                    <span className="text-[10px] text-white/30">{currentSeasonLabel}</span>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] border border-[#AFFF25]/20 overflow-hidden divide-y divide-white/[0.05]">
                    {currentSeasonRows.filter((s: any) => (s.appearances ?? 0) > 0 || (s.goals ?? 0) > 0).map((s: any, i: number) => (
                      <div key={i}>
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02]">
                          {s.teamLogo && <img src={s.teamLogo} alt={s.team} className="h-5 w-5 object-contain" />}
                          <span className="text-xs font-bold text-white flex-1 truncate">{s.team}</span>
                          {s.leagueLogo && <img src={s.leagueLogo} alt={s.league} className="h-4 w-4 object-contain opacity-50" />}
                          <span className="text-[10px] text-white/30 truncate max-w-[110px]">{s.league}</span>
                          {s.rating && <span className="ml-2 text-[#AFFF25] font-black text-sm shrink-0">{s.rating}</span>}
                        </div>
                        <div className="grid grid-cols-4 gap-px bg-white/[0.04]">
                          <StatCell label="Matchs"  value={s.appearances} />
                          <StatCell label="Min"     value={s.minutes ? `${s.minutes}'` : null} />
                          <StatCell label="Buts"    value={s.goals}   highlight={(s.goals ?? 0) > 0} />
                          <StatCell label="Passes"  value={s.assists} highlight={(s.assists ?? 0) > 0} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CARRIÈRE PAR CLUB ── */}
              {clubCareer.length > 0 && (
                <div className="mb-7">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Carrière · Clubs</div>
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-4 py-2 bg-white/[0.02]">
                      <span className="text-[9px] text-white/25 uppercase tracking-widest">Club</span>
                      {['M', 'Min', 'Buts', 'Passes'].map(h => (
                        <span key={h} className="text-[9px] text-white/25 uppercase tracking-widest text-center w-10">{h}</span>
                      ))}
                    </div>
                    {clubCareer.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {c.logo && <img src={c.logo} alt={c.team} className="h-5 w-5 object-contain shrink-0" onError={e => e.currentTarget.style.display='none'} />}
                          <span className="text-xs font-bold text-white truncate">{c.team}</span>
                        </div>
                        <span className="text-xs font-black text-white text-center w-10">{c.appearances ?? '—'}</span>
                        <span className="text-xs text-white/50 text-center w-10">{c.minutes ? `${c.minutes}'` : '—'}</span>
                        <span className={`text-xs font-black text-center w-10 ${(c.goals ?? 0) > 0 ? 'text-[#AFFF25]' : 'text-white/50'}`}>{c.goals ?? '—'}</span>
                        <span className={`text-xs font-black text-center w-10 ${(c.assists ?? 0) > 0 ? 'text-[#AFFF25]' : 'text-white/50'}`}>{c.assists ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SÉLECTION NATIONALE ── */}
              {intlCareer.length > 0 && (
                <div className="mb-7">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Sélection nationale</div>
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-4 py-2 bg-white/[0.02]">
                      <span className="text-[9px] text-white/25 uppercase tracking-widest">Équipe</span>
                      {['M', 'Min', 'Buts', 'Passes'].map(h => (
                        <span key={h} className="text-[9px] text-white/25 uppercase tracking-widest text-center w-10">{h}</span>
                      ))}
                    </div>
                    {intlCareer.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {c.logo && <img src={c.logo} alt={c.team} className="h-5 w-5 object-contain shrink-0" onError={e => e.currentTarget.style.display='none'} />}
                          <span className="text-xs font-bold text-white truncate">{c.team}</span>
                        </div>
                        <span className="text-xs font-black text-white text-center w-10">{c.appearances ?? '—'}</span>
                        <span className="text-xs text-white/50 text-center w-10">{c.minutes ? `${c.minutes}'` : '—'}</span>
                        <span className={`text-xs font-black text-center w-10 ${(c.goals ?? 0) > 0 ? 'text-[#AFFF25]' : 'text-white/50'}`}>{c.goals ?? '—'}</span>
                        <span className={`text-xs font-black text-center w-10 ${(c.assists ?? 0) > 0 ? 'text-[#AFFF25]' : 'text-white/50'}`}>{c.assists ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allStats.length === 0 && (
                <div className="text-center py-12 text-white/30 italic text-sm">Aucune statistique disponible.</div>
              )}

              {/* ── ACTUALITÉS ── */}
              {recentNews.length > 0 && (
                <div className="mt-7">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Actualités récentes</div>
                  <div className="space-y-2">
                    {recentNews.map((n: any, i: number) => (
                      <div key={i} className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-xs font-bold text-white mb-1">{n.title}</div>
                        <div className="text-[11px] text-white/50 leading-relaxed">{n.summary}</div>
                        {n.date && <div className="text-[9px] text-white/20 mt-1">{n.date}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PALMARÈS ── */}
              {trophies.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Palmarès ({trophies.length})</div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
