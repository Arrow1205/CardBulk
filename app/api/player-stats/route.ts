import { NextResponse } from 'next/server';

const BASE = 'https://v3.football.api-sports.io';

async function apiFetch(path: string, key: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    signal: AbortSignal.timeout(10000),
  });
  return res.json();
}

// Normalize: strip accents + lowercase + alnum only — matches the same logic on the client
const normName = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Pick the result whose full name best matches the query
function bestMatch(results: any[], query: string): any | null {
  if (!results.length) return null;
  const q = normName(query);
  // Exact match first
  for (const r of results) {
    const p = r.player;
    const full = normName(`${p.firstname || ''} ${p.lastname || ''}`);
    const rev  = normName(`${p.lastname || ''} ${p.firstname || ''}`);
    if (full === q || rev === q) return p;
  }
  // Partial match
  for (const r of results) {
    const p = r.player;
    const full = normName(`${p.firstname || ''} ${p.lastname || ''}`);
    if (q.includes(full) || full.includes(q)) return p;
  }
  // Fallback: first result
  return results[0].player;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  if (!API_KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    // 1. Search player profile — try full name, fallback to last word only
    let profileData = await apiFetch(
      `/players/profiles?search=${encodeURIComponent(name)}`,
      API_KEY
    );

    // If no result, retry with just the last name token (handles "Desire Doue" → "Doue")
    if (!profileData.response?.length) {
      const lastName = name.split(' ').pop() || name;
      profileData = await apiFetch(
        `/players/profiles?search=${encodeURIComponent(lastName)}`,
        API_KEY
      );
    }

    if (!profileData.response?.length) {
      return NextResponse.json({ player: null, stats: [], trophies: [] });
    }

    const player = bestMatch(profileData.response, name);
    const playerId = player.id;

    // 2. Stats for last 5 seasons
    const currentYear = new Date().getFullYear();
    const seasons = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const statsResults = await Promise.all(
      seasons.map(season =>
        apiFetch(`/players?id=${playerId}&season=${season}`, API_KEY).catch(() => null)
      )
    );

    const stats: any[] = [];
    for (const result of statsResults) {
      if (!result?.response?.length) continue;
      const entry = result.response[0];
      for (const s of entry.statistics || []) {
        stats.push({
          season: s.league?.season,
          team: s.team?.name,
          teamLogo: s.team?.logo,
          league: s.league?.name,
          leagueLogo: s.league?.logo,
          country: s.league?.country,
          appearances: s.games?.appearences ?? null,
          lineups: s.games?.lineups ?? null,
          minutes: s.games?.minutes ?? null,
          rating: s.games?.rating ? parseFloat(s.games.rating).toFixed(1) : null,
          goals: s.goals?.total ?? null,
          assists: s.goals?.assists ?? null,
          yellowCards: s.cards?.yellow ?? null,
          redCards: s.cards?.red ?? null,
          passes: s.passes?.total ?? null,
          shots: s.shots?.total ?? null,
          shotsOn: s.shots?.on ?? null,
          dribbles: s.dribbles?.success ?? null,
        });
      }
    }

    // 3. Trophies
    const trophyData = await apiFetch(`/trophies?player=${playerId}`, API_KEY);
    const trophies = (trophyData.response || [])
      .filter((t: any) => t.place === 'Winner')
      .map((t: any) => ({
        league: t.league,
        country: t.country,
        season: t.season,
        place: t.place,
      }));

    return NextResponse.json({ player, stats, trophies });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
