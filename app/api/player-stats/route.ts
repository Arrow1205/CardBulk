import { NextResponse } from 'next/server';

// ── TheSportsDB (free, no key, works server-side) ──
async function tsdbSearch(name: string) {
  const r = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`,
    { signal: AbortSignal.timeout(8000) }
  );
  return r.json();
}

// ── api-football.com ──
const AF_BASE = 'https://v3.football.api-sports.io';
async function afFetch(path: string, key: string) {
  const r = await fetch(`${AF_BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    signal: AbortSignal.timeout(12000),
  });
  return r.json();
}

const normName = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function afBestMatch(results: any[], query: string) {
  if (!results.length) return null;
  const q = normName(query);
  for (const r of results) {
    const p = r.player;
    const full = normName(`${p.firstname || ''} ${p.lastname || ''}`);
    const rev  = normName(`${p.lastname || ''} ${p.firstname || ''}`);
    if (full === q || rev === q) return p;
  }
  for (const r of results) {
    const p = r.player;
    const full = normName(`${p.firstname || ''} ${p.lastname || ''}`);
    if (q.includes(full) || full.includes(q)) return p;
  }
  return results[0].player;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  if (!API_KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    // 1. TheSportsDB — photo, current team, nationality (free, no key)
    let tsdbPlayer: any = null;
    try {
      const tsdbData = await tsdbSearch(name);
      const players: any[] = tsdbData.player || [];
      const q = normName(name);
      tsdbPlayer = players.find(p => normName(p.strPlayer || '') === q)
        || players.find(p => { const n = normName(p.strPlayer || ''); return n.length > 3 && (q.includes(n) || n.includes(q)); })
        || players[0] || null;
    } catch (e) {
      console.warn('[player-stats] TheSportsDB error:', e);
    }

    // 2. api-football — search player id
    let afPlayer: any = null;
    let playerId: number | null = null;
    try {
      let profileData = await afFetch(`/players/profiles?search=${encodeURIComponent(name)}`, API_KEY);
      if (!profileData.response?.length) {
        const lastName = name.split(' ').pop() || name;
        profileData = await afFetch(`/players/profiles?search=${encodeURIComponent(lastName)}`, API_KEY);
      }
      if (profileData.response?.length) {
        afPlayer = afBestMatch(profileData.response, name);
        playerId = afPlayer?.id ?? null;
        console.log(`[player-stats] found player: ${afPlayer?.firstname} ${afPlayer?.lastname} id=${playerId}`);
      } else {
        console.log(`[player-stats] no profile found for "${name}", errors:`, JSON.stringify(profileData.errors));
      }
    } catch (e) {
      console.warn('[player-stats] af profile error:', e);
    }

    // 3. Stats — seasons from api-football
    const stats: any[] = [];
    if (playerId) {
      // Try seasons: current year down 8 years
      const currentYear = new Date().getFullYear();
      const seasons = Array.from({ length: 8 }, (_, i) => currentYear - i);
      console.log(`[player-stats] id=${playerId}, trying seasons:`, seasons);

      const results = await Promise.all(
        seasons.map(s => afFetch(`/players?id=${playerId}&season=${s}`, API_KEY).catch(() => null))
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const season = seasons[i];
        if (!result?.response?.length) {
          console.log(`season ${season}: no data — errors: ${JSON.stringify(result?.errors)}`);
          continue;
        }
        console.log(`season ${season}: ${result.response[0].statistics?.length} entries`);
        for (const s of result.response[0].statistics || []) {
          stats.push({
            season:      season,
            seasonSort:  season,
            seasonLabel: `${season}/${String(season + 1).slice(-2)}`,
            team:        s.team?.name,
            teamLogo:    s.team?.logo,
            league:      s.league?.name,
            leagueLogo:  s.league?.logo,
            country:     s.league?.country,
            appearances: s.games?.appearences ?? null,
            minutes:     s.games?.minutes ?? null,
            rating:      s.games?.rating ? parseFloat(s.games.rating).toFixed(1) : null,
            goals:       s.goals?.total ?? null,
            assists:     s.goals?.assists ?? null,
            yellowCards: s.cards?.yellow ?? null,
            redCards:    s.cards?.red ?? null,
            shots:       s.shots?.total ?? null,
            shotsOn:     s.shots?.on ?? null,
          });
        }
      }

      // 4. Trophies
      let trophies: any[] = [];
      try {
        const trophyData = await afFetch(`/trophies?player=${playerId}`, API_KEY);
        trophies = (trophyData.response || [])
          .filter((t: any) => t.place === 'Winner')
          .map((t: any) => ({ league: t.league, country: t.country, season: t.season }));
        return NextResponse.json({ player: buildPlayer(tsdbPlayer, afPlayer, stats), stats, trophies });
      } catch {}
    }

    return NextResponse.json({ player: buildPlayer(tsdbPlayer, afPlayer, stats), stats, trophies: [] });
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function buildPlayer(tsdb: any, af: any, stats: any[]) {
  const mostRecent = stats[0];
  const birthDate = tsdb?.dateBorn || af?.birth?.date;
  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : af?.age ?? null;

  return {
    id:              af?.id ?? null,
    firstname:       af?.firstname || (tsdb?.strPlayer || '').split(' ').slice(0, -1).join(' '),
    lastname:        af?.lastname  || (tsdb?.strPlayer || '').split(' ').slice(-1)[0] || '',
    photo:           tsdb?.strThumb || tsdb?.strCutout
                       || (af?.id ? `https://media.api-sports.io/football/players/${af.id}.png` : null),
    nationality:     tsdb?.strNationality || af?.nationality || null,
    age,
    currentTeam:     tsdb?.strTeam || mostRecent?.team || null,
    currentTeamLogo: null, // TheSportsDB doesn't expose team logo easily
  };
}
