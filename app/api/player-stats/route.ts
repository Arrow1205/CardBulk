import { NextResponse } from 'next/server';

const BASE = 'https://api.sofascore.com/api/v1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.sofascore.com/',
  'Accept': 'application/json',
};

async function sofa(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`SofaScore ${res.status}: ${path}`);
  return res.json();
}

const normName = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function bestPlayerMatch(players: any[], query: string): any | null {
  if (!players.length) return null;
  const q = normName(query);
  for (const p of players) {
    const full = normName(p.name || '');
    const short = normName(p.shortName || '');
    if (full === q || short === q) return p;
  }
  for (const p of players) {
    const full = normName(p.name || '');
    if (q.includes(full) || full.includes(q)) return p;
  }
  return players[0];
}

// Current year for filtering recent seasons
const CURRENT_YEAR = new Date().getFullYear();

function seasonYear(yearStr: string): number {
  // SofaScore year format: "25/26" or "2025/2026" or "2025"
  const m = yearStr.match(/(\d{2,4})/);
  if (!m) return 0;
  const y = parseInt(m[1]);
  return y < 100 ? 2000 + y : y;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  try {
    // 1. Search player
    const searchData = await sofa(`/search/all?q=${encodeURIComponent(name)}`);
    const allPlayers = (searchData.results || [])
      .filter((r: any) => r.type === 'player')
      .map((r: any) => r.entity);

    // Also try searching with just last name if needed
    let players = allPlayers;
    if (!players.length) {
      const lastName = name.split(' ').pop() || name;
      const retry = await sofa(`/search/all?q=${encodeURIComponent(lastName)}`);
      players = (retry.results || [])
        .filter((r: any) => r.type === 'player')
        .map((r: any) => r.entity);
    }

    if (!players.length) {
      return NextResponse.json({ player: null, stats: [], trophies: [] });
    }

    const match = bestPlayerMatch(players, name);
    const playerId = match.id;

    // 2. Player details (current team, nationality, age, etc.)
    const [detailData, seasonsData] = await Promise.all([
      sofa(`/player/${playerId}`),
      sofa(`/player/${playerId}/statistics/seasons`).catch(() => ({ uniqueTournamentSeasons: [] })),
    ]);

    const pd = detailData.player || match;
    const birthDate = pd.dateOfBirthTimestamp
      ? new Date(pd.dateOfBirthTimestamp * 1000)
      : null;
    const age = birthDate
      ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    const player = {
      id: playerId,
      firstname: (pd.name || '').split(' ').slice(0, -1).join(' '),
      lastname:  (pd.name || '').split(' ').slice(-1)[0] || pd.name,
      name:      pd.name,
      shortName: pd.shortName,
      photo:     `https://api.sofascore.app/api/v1/player/${playerId}/image`,
      nationality: pd.country?.name || null,
      age,
      currentTeam: pd.team?.name || null,
      currentTeamLogo: pd.team?.id
        ? `https://api.sofascore.app/api/v1/team/${pd.team.id}/image`
        : null,
    };

    // 3. Collect tournament/season pairs — keep recent 5 years only to limit requests
    const pairs: Array<{ utId: number; utName: string; utLogo: string; country: string; sId: number; sYear: string }> = [];

    for (const tEntry of (seasonsData.uniqueTournamentSeasons || [])) {
      const ut = tEntry.uniqueTournament;
      for (const season of (tEntry.seasons || [])) {
        const yr = seasonYear(season.year);
        if (yr < CURRENT_YEAR - 5) continue; // only last 5 years
        pairs.push({
          utId: ut.id,
          utName: ut.name,
          utLogo: `https://api.sofascore.app/api/v1/unique-tournament/${ut.id}/image`,
          country: ut.category?.country?.name || ut.category?.name || '',
          sId: season.id,
          sYear: season.year,
        });
      }
    }

    // 4. Fetch stats for each pair (in parallel, limit 20 concurrent)
    const CHUNK = 20;
    const statsRows: any[] = [];

    for (let i = 0; i < pairs.length; i += CHUNK) {
      const chunk = pairs.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(p =>
          sofa(`/player/${playerId}/unique-tournament/${p.utId}/season/${p.sId}/statistics/overall`)
            .then(d => ({ pair: p, data: d }))
        )
      );
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { pair, data } = r.value;
        const s = data.statistics;
        if (!s || (s.appearances === 0 && s.goals === 0)) continue;

        // Find team name from seasons data (SofaScore doesn't always include team in stats)
        statsRows.push({
          season:      pair.sYear,
          seasonSort:  seasonYear(pair.sYear),
          team:        s.team?.name || player.currentTeam || '',
          teamLogo:    s.team?.id ? `https://api.sofascore.app/api/v1/team/${s.team.id}/image` : player.currentTeamLogo || '',
          league:      pair.utName,
          leagueLogo:  pair.utLogo,
          country:     pair.country,
          appearances: s.appearances ?? null,
          minutes:     s.minutesPlayed ?? null,
          rating:      s.rating ? parseFloat(s.rating).toFixed(1) : null,
          goals:       s.goals ?? null,
          assists:     s.assists ?? null,
          yellowCards: s.yellowCards ?? null,
          redCards:    s.redCards ?? null,
          shots:       s.shots ?? null,
          shotsOn:     s.shotsOnTarget ?? null,
        });
      }
    }

    // Sort by season desc
    statsRows.sort((a, b) => b.seasonSort - a.seasonSort);

    // 5. Honors / trophies
    let trophies: any[] = [];
    try {
      const honorsData = await sofa(`/player/${playerId}/honors`);
      trophies = (honorsData.honors || []).flatMap((h: any) =>
        (h.items || []).map((item: any) => ({
          league:  h.competition?.name || h.name || '',
          country: h.competition?.country?.name || '',
          season:  item.season?.year || item.year || '',
        }))
      );
    } catch {}

    return NextResponse.json({ player, stats: statsRows, trophies });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
