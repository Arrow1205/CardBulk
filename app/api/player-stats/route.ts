import { NextResponse } from 'next/server';

const BASE = 'https://v3.football.api-sports.io';

async function apiFetch(path: string, key: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

const normName = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function bestMatch(results: any[], query: string): any | null {
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
    // 1. Search player profile
    let profileData = await apiFetch(`/players/profiles?search=${encodeURIComponent(name)}`, API_KEY);
    if (!profileData.response?.length) {
      const lastName = name.split(' ').pop() || name;
      profileData = await apiFetch(`/players/profiles?search=${encodeURIComponent(lastName)}`, API_KEY);
    }
    if (!profileData.response?.length) {
      return NextResponse.json({ player: null, stats: [], trophies: [] });
    }

    const player = bestMatch(profileData.response, name);
    const playerId = player.id;

    // 2. Seasons to fetch
    // Football season "N" = Aug N → May N+1 (e.g. season 2025 = 2025/26)
    // Try from current year down 8 years — empty seasons cost nothing
    const currentYear = new Date().getFullYear();
    const seasons = Array.from({ length: 8 }, (_, i) => currentYear - i);

    console.log(`[player-stats] ${name} → id=${playerId}, trying seasons:`, seasons);

    const statsResults = await Promise.all(
      seasons.map(season =>
        apiFetch(`/players?id=${playerId}&season=${season}`, API_KEY).catch(() => null)
      )
    );

    const stats: any[] = [];
    for (let i = 0; i < statsResults.length; i++) {
      const result = statsResults[i];
      const season = seasons[i];
      if (!result?.response?.length) {
        console.log(`[player-stats] season ${season}: no data`);
        continue;
      }
      console.log(`[player-stats] season ${season}: ${result.response[0].statistics?.length} competitions`);
      const entry = result.response[0];
      for (const s of entry.statistics || []) {
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

    // 3. Trophies
    const trophyData = await apiFetch(`/trophies?player=${playerId}`, API_KEY);
    const trophies = (trophyData.response || [])
      .filter((t: any) => t.place === 'Winner')
      .map((t: any) => ({ league: t.league, country: t.country, season: t.season }));

    // Build player object with current team from most recent stat
    const mostRecent = stats[0];
    const playerOut = {
      ...player,
      photo:           `https://media.api-sports.io/football/players/${playerId}.png`,
      firstname:       player.firstname,
      lastname:        player.lastname,
      nationality:     player.nationality,
      age:             player.age,
      currentTeam:     mostRecent?.team || null,
      currentTeamLogo: mostRecent?.teamLogo || null,
    };

    console.log(`[player-stats] total stat rows: ${stats.length}`);
    return NextResponse.json({ player: playerOut, stats, trophies });
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
