import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CACHE_TTL_DAYS = 7;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Wikitext utilities ──

function cleanWiki(s: string): string {
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/colspan="\d+"\s*\|[^|!]*/gi, '')
    .replace(/rowspan="\d+"\s*\|/gi, '')
    .replace(/style="[^"]*"\s*\|?/gi, '')
    .replace(/class="[^"]*"\s*\|?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'''+/g, '')
    .trim();
}

// Extract numbers from a `|` data line (cells separated by ||)
function dataNums(line: string): number[] {
  const cleaned = line
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/colspan="\d+"\s*\|[^|]*/gi, '')
    .replace(/rowspan="\d+"\s*\|/gi, '');
  return cleaned.split(/\|+/)
    .map(c => c.trim())
    .filter(c => /^\d+$/.test(c))
    .map(Number);
}

// Extract numbers from a `!` header line (cells separated by !!)
function headerNums(line: string): number[] {
  const cleaned = line
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/colspan="\d+"\s*\|[^!]*/gi, '')
    .replace(/—|–|-{2,}/g, '');
  return cleaned.split(/!!/)
    .map(c => c.replace(/^!/, '').trim())
    .filter(c => /^\d+$/.test(c))
    .map(Number);
}

// ── Club career parser ──
// Wikipedia format:
//   data rows start with |   (| or || separator)
//   total rows start with !  (!! separator), line "Total" or "Career total"

interface ClubRow  { club: string; apps: number; goals: number }
interface SeasonRow { season: string; seasonSort: number; club: string; league: string; apps: number; goals: number }
interface CareerTotal { apps: number; goals: number }

function parseClubTable(wikitext: string): {
  clubCareer: ClubRow[];
  currentSeason: SeasonRow | null;
  careerTotal: CareerTotal | null;
} {
  const tStart = wikitext.indexOf('{|');
  if (tStart === -1) return { clubCareer: [], currentSeason: null, careerTotal: null };
  const tEnd = wikitext.indexOf('|}', tStart);
  const tableText = wikitext.slice(tStart, tEnd);

  const rowBlocks = tableText.split(/^\s*\|-/m).slice(1);

  let currentClub = '';
  let clubRowspan = 0;
  const clubTotals: ClubRow[] = [];          // clubs with a ! Total row
  const clubTotalsSet = new Set<string>();    // names of those clubs
  const clubIndividual = new Map<string, { apps: number; goals: number }[]>();
  let careerTotal: CareerTotal | null = null;
  let currentSeason: SeasonRow | null = null;
  let latestSeasonSort = -1;

  for (const block of rowBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Separate | and ! lines
    const dataLines   = lines.filter(l => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'));
    const headerLines = lines.filter(l => l.startsWith('!'));

    // ── ! Total / Career total block ──
    if (headerLines.length > 0) {
      const firstH = headerLines[0];
      const isCareerTotal = /career\s*total/i.test(firstH);
      const isClubTotal   = !isCareerTotal && /\bTotal\b/i.test(firstH);

      if (isCareerTotal || isClubTotal) {
        let nums = headerNums(firstH);
        if (nums.length < 2 && headerLines[1]) {
          nums = headerNums(headerLines[1]);
        }
        if (nums.length >= 2) {
          const apps  = nums[nums.length - 2];
          const goals = nums[nums.length - 1];
          if (isCareerTotal) {
            careerTotal = { apps, goals };
          } else if (currentClub) {
            clubTotals.push({ club: currentClub, apps, goals });
            clubTotalsSet.add(currentClub);
          }
        }
        // Reset rowspan after a club total so the next club is detected correctly
        clubRowspan = 0;
        continue;
      }
    }

    // ── Regular data row ──
    const cells: string[] = [];
    let hasNewClub = false;

    for (const line of dataLines) {
      const content = line.slice(1);
      const rsMatch = content.match(/^rowspan="(\d+)"\|(.+)/);
      if (rsMatch) {
        clubRowspan = parseInt(rsMatch[1]);
        currentClub = cleanWiki(rsMatch[2].split('||')[0]).replace(/\s*\(loan\)/i, '').trim();
        hasNewClub = true;
        rsMatch[2].split('||').slice(1).forEach(p => cells.push(cleanWiki(p)));
        continue;
      }
      content.split('||').forEach(p => cells.push(cleanWiki(p)));
    }

    if (!hasNewClub) {
      if (clubRowspan > 0) clubRowspan--;
      else if (cells.length > 0 && !cells[0].match(/^\d{4}/) && cells[0] !== '') {
        currentClub = cells.shift()!.replace(/\s*\(loan\)/i, '').trim();
      }
    }

    if (cells.length < 2 || !currentClub) continue;
    const season = cells[0];
    if (!season.match(/\d{4}/)) continue;

    // Collect all numbers from the stats line (last | line of the block)
    const statsLine = dataLines[dataLines.length - 1] || '';
    const nums = dataNums(statsLine);
    if (nums.length < 2) continue;

    const apps  = nums[nums.length - 2];
    const goals = nums[nums.length - 1];
    if (apps === 0 && goals === 0) continue;

    // YYYY-YY → sort key 202526, standalone YYYY → 202500 (so YYYY-YY ranks higher)
    const yearMatch  = season.match(/(\d{4})[–\-](\d{2,4})/);
    const yearMatch2 = season.match(/(\d{4})/);
    const baseYear   = yearMatch ? parseInt(yearMatch[1]) : (yearMatch2 ? parseInt(yearMatch2[1]) : 0);
    const endPart    = yearMatch ? parseInt(yearMatch[2].length === 2 ? yearMatch[1].slice(0,2) + yearMatch[2] : yearMatch[2]) : 0;
    const seasonSort = baseYear * 100 + (endPart ? endPart % 100 : 0);

    // Track current (most recent) season
    if (seasonSort >= latestSeasonSort) {
      latestSeasonSort = seasonSort;
      currentSeason = {
        season:      season.replace(/–/g, '-'),
        seasonSort,
        club:        currentClub,
        league:      cells[1] || '',
        apps,
        goals,
      };
    }

    // Track per-club individual rows (for single-season clubs)
    if (!clubIndividual.has(currentClub)) clubIndividual.set(currentClub, []);
    clubIndividual.get(currentClub)!.push({ apps, goals });
  }

  // Add single-season clubs (no Total row found)
  const clubCareer: ClubRow[] = [...clubTotals];
  clubIndividual.forEach((rows, club) => {
    if (clubTotalsSet.has(club)) return;
    const apps  = rows.reduce((s: number, r: { apps: number; goals: number }) => s + r.apps,  0);
    const goals = rows.reduce((s: number, r: { apps: number; goals: number }) => s + r.goals, 0);
    if (apps > 0 || goals > 0) clubCareer.push({ club, apps, goals });
  });

  clubCareer.sort((a, b) => b.apps - a.apps);

  // Remove current season club from career list (already shown separately)
  const filtered = currentSeason
    ? clubCareer.filter(c => c.club !== currentSeason.club)
    : clubCareer;

  return { clubCareer: filtered, currentSeason, careerTotal };
}

// ── International career parser ──
function parseIntlTable(wikitext: string): { nation: string; apps: number; goals: number }[] {
  const tStart = wikitext.indexOf('{|');
  if (tStart === -1) return [];
  const tEnd = wikitext.indexOf('|}', tStart);
  const tableText = wikitext.slice(tStart, tEnd);
  const rowBlocks = tableText.split(/^\s*\|-/m).slice(1);

  let nation = '';
  let nationRowspan = 0;
  const totals: { nation: string; apps: number; goals: number }[] = [];
  const rows = new Map<string, { apps: number; goals: number }[]>();

  for (const block of rowBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const headerLines = lines.filter(l => l.startsWith('!'));
    const dataLines   = lines.filter(l => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'));

    // Total row (may be inline: !colspan="2"|Total!!137!!57)
    if (headerLines.length > 0 && /\bTotal\b/i.test(headerLines[0])) {
      const nums = headerNums(headerLines[0]);
      if (nums.length >= 2 && nation) {
        totals.push({ nation, apps: nums[nums.length - 2], goals: nums[nums.length - 1] });
      }
      continue;
    }

    // Data row
    const cells: string[] = [];
    let hasNewNation = false;

    for (const line of dataLines) {
      const content = line.slice(1);
      const rsMatch = content.match(/^rowspan="(\d+)"\|(.+)/);
      if (rsMatch) {
        nationRowspan = parseInt(rsMatch[1]);
        nation = cleanWiki(rsMatch[2].split('||')[0]);
        hasNewNation = true;
        rsMatch[2].split('||').slice(1).forEach(p => cells.push(cleanWiki(p)));
        continue;
      }
      content.split('||').forEach(p => cells.push(cleanWiki(p)));
    }

    if (!hasNewNation && nationRowspan > 0) nationRowspan--;

    if (!nation || !cells[0]?.match(/^\d{4}/)) continue;

    const statsLine = dataLines[dataLines.length - 1] || '';
    const nums = dataNums(statsLine);
    if (nums.length < 2) continue;

    if (!rows.has(nation)) rows.set(nation, []);
    rows.get(nation)!.push({ apps: nums[nums.length - 2], goals: nums[nums.length - 1] });
  }

  // Prefer Total rows; fallback to summed individual rows
  const result: { nation: string; apps: number; goals: number }[] = [];
  const seen = new Set<string>();
  for (const t of totals) {
    result.push(t);
    seen.add(t.nation);
  }
  rows.forEach((arr, nation) => {
    if (seen.has(nation)) return;
    result.push({ nation, apps: arr.reduce((s: number, r: { apps: number; goals: number }) => s + r.apps, 0), goals: arr.reduce((s: number, r: { apps: number; goals: number }) => s + r.goals, 0) });
  });
  return result.filter(r => r.apps > 0 || r.goals > 0).sort((a, b) => b.apps - a.apps);
}

// ── Trophies ──
const LEAGUE_KW = ['ligue 1', 'premier league', 'serie a', 'la liga', 'bundesliga', 'primeira liga', 'eredivisie', 'super lig', 'mls cup'];
const CUP_KW    = ['fa cup', 'coupe de france', 'coppa italia', 'copa del rey', 'dfb-pokal', 'carabao cup', 'league cup', 'efl cup', 'community shield', 'coupe de la ligue', 'copa do brasil', 'supercoppa', 'europa league', 'champions league', 'conference league'];
const INTL_KW   = ['fifa world cup', 'uefa european championship', 'european championship', 'uefa nations league', 'nations league', 'copa america', 'africa cup', 'afcon', 'gold cup'];

function parseTrophies(wikitext: string): { leagues: number; cups: number; international: string[] } {
  const lines = wikitext.split('\n');
  let leagues = 0, cups = 0;
  const international: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('*')) continue;

    // Strip ref tags to avoid picking up citation years
    const clean = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<ref[^>]*\/>/g, '').replace(/\{\{[^}]*\}\}/g, '');

    // Extract trophy name from the first [[...]] link or bold text
    const linkMatch  = clean.match(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/);
    const boldMatch  = clean.match(/^\*\s*'''([^']+)'''/);
    const trophyRaw  = (linkMatch?.[1] || boldMatch?.[1] || '').toLowerCase().trim();
    if (!trophyRaw) continue;

    // Extract season strings ONLY from [[...]] links (not from refs or surrounding text)
    const seasonLinkMatches = Array.from(clean.matchAll(/\[\[([^\]]*\d{4}[^\]]*)\]\]/g));
    const seasonLinks = seasonLinkMatches.map(m => {
      const parts = m[1].split('|');
      return parts[parts.length - 1].replace(/\[\[|\]\]/g, '').trim();
    }).filter((s: string) => /\d{4}/.test(s));

    const numWins = Math.max(seasonLinks.length, 1);

    if (LEAGUE_KW.some(k => trophyRaw.includes(k))) {
      leagues += numWins;
    } else if (CUP_KW.some(k => trophyRaw.includes(k))) {
      cups += numWins;
    } else if (INTL_KW.some(k => trophyRaw.includes(k))) {
      const label = trophyRaw.replace(/\b\w/g, (l: string) => l.toUpperCase());
      const uniqueSeasons = seasonLinks.filter((s: string, i: number) => seasonLinks.indexOf(s) === i);
      for (const s of uniqueSeasons) {
        const entry = `${label} (${s})`;
        if (!international.includes(entry)) international.push(entry);
      }
    }
  }
  return { leagues, cups, international };
}

// ── Wikipedia ──
async function fetchFromWikipedia(name: string) {
  const search = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' footballer')}&srlimit=5&format=json`,
    { signal: AbortSignal.timeout(8000) }
  ).then(r => r.json());

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const q = norm(name);
  const results = search.query?.search || [];
  const page = results.find((r: any) => norm(r.title).includes(q) || q.includes(norm(r.title))) || results[0];
  if (!page) return null;

  console.log(`[player-stats] Wikipedia: "${page.title}"`);

  const sectionsData = await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=sections&format=json`
  ).then(r => r.json());

  const sections: any[] = sectionsData.parse?.sections || [];

  // Find "Career statistics" parent section, then look for its children only
  const careerStatsIdx = sections.findIndex((s: any) => /career statistics/i.test(s.line));
  const statsChildren  = careerStatsIdx >= 0 ? sections.slice(careerStatsIdx + 1) : sections;

  const clubSection = statsChildren.find((s: any) => /^club$/i.test(s.line.trim()));
  const intlSection = statsChildren.find((s: any) => /^international$/i.test(s.line.trim()));
  const honSection  = sections.find((s: any) => /^honours?$|^honors?$/i.test(s.line.trim()));

  const fetchSec = (idx: number) =>
    fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=wikitext&section=${idx}&format=json`)
      .then(r => r.json()).then(d => (d.parse?.wikitext?.['*'] as string) || '');

  const [clubText, intlText, honText, introData] = await Promise.all([
    clubSection ? fetchSec(clubSection.index) : Promise.resolve(''),
    intlSection ? fetchSec(intlSection.index) : Promise.resolve(''),
    honSection  ? fetchSec(honSection.index)  : Promise.resolve(''),
    fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page.title)}&prop=extracts&exintro=true&explaintext=true&format=json`).then(r => r.json()),
  ]);

  const { clubCareer, currentSeason, careerTotal } = parseClubTable(clubText);
  const intlCareer = parseIntlTable(intlText);
  const trophies   = parseTrophies(honText);

  const intro: string = (Object.values((introData.query?.pages || {}) as Record<string, any>)[0]?.extract as string) || '';
  const teamMatch   = intro.match(/plays(?:ed)? (?:as [\w\s-]+ )?for (?:[\w\s]+club )?([A-Z][^,.\n]+?)(?:\s+and\s|\s*[,.]|$)/);
  const currentTeam = teamMatch?.[1]?.trim() || currentSeason?.club || clubCareer[0]?.club || null;

  return { clubCareer, currentSeason, intlCareer, careerTotal, trophies, currentTeam };
}

// ── TheSportsDB ──
async function fetchTSDB(name: string) {
  try {
    const d = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(6000) }
    ).then(r => r.json());
    const players: any[] = d.player || [];
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const q = norm(name);
    return players.find(p => norm(p.strPlayer) === q)
      || players.find(p => { const n = norm(p.strPlayer); return n.length > 3 && (q.includes(n) || n.includes(q)); })
      || players[0] || null;
  } catch { return null; }
}

// ── Cache ──
function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

async function readCache(slug: string) {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.from('player_stats_cache').select('data, updated_at').eq('slug', slug).single();
    if (!data) return null;
    const age = (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return age < CACHE_TTL_DAYS ? data.data : null;
  } catch { return null; }
}

async function writeCache(slug: string, data: any) {
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('player_stats_cache').upsert({ slug, data, updated_at: new Date().toISOString() });
  } catch {}
}

// ── Handler ──
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const slug = slugify(name);
  const cached = await readCache(slug);
  if (cached) {
    console.log(`[player-stats] cache hit: ${slug}`);
    return NextResponse.json(cached);
  }

  try {
    const [tsdb, wiki] = await Promise.all([fetchTSDB(name), fetchFromWikipedia(name)]);

    const birth = tsdb?.dateBorn;
    const age   = birth ? Math.floor((Date.now() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
    const n     = tsdb?.strPlayer || name;

    const result = {
      player: {
        firstname:       n.split(' ').slice(0, -1).join(' '),
        lastname:        n.split(' ').slice(-1)[0] || n,
        photo:           tsdb?.strThumb || tsdb?.strCutout || null,
        nationality:     tsdb?.strNationality || null,
        age,
        position:        tsdb?.strPosition || null,
        currentTeam:     wiki?.currentTeam || tsdb?.strTeam || null,
        currentTeamLogo: null,
      },
      currentSeason: wiki?.currentSeason ?? null,
      clubCareer:    wiki?.clubCareer    ?? [],
      intlCareer:    wiki?.intlCareer    ?? [],
      careerTotal:   wiki?.careerTotal   ?? null,
      trophies:      wiki?.trophies      ?? { leagues: 0, cups: 0, international: [] },
    };

    await writeCache(slug, result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
