import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CACHE_TTL_DAYS = 7;

// ── Wikitext utilities ──

function cleanWiki(s: string): string {
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/colspan="\d+"\s*\|[^|]*/gi, '')
    .replace(/rowspan="\d+"\s*\|/gi, '')
    .replace(/style="[^"]*"\s*\|?/gi, '')
    .replace(/class="[^"]*"\s*\|?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'''+/g, '')
    .trim();
}

// Extract numeric values from a row block (split by || then |)
function rowNums(rowBlock: string): number[] {
  const cleaned = rowBlock
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/colspan="\d+"\s*\|[^|]*/gi, '')
    .replace(/rowspan="\d+"\s*\|/gi, '')
    .replace(/style="[^"]*"\s*\|?/gi, '')
    .replace(/class="[^"]*"\s*\|?/gi, '');
  return cleaned.split(/\|+/)
    .map(c => c.trim())
    .filter(c => /^\d+$/.test(c))
    .map(Number);
}

// ── Club career table parser ──
// Returns sous-total rows (one per club) + most recent individual season row

interface ClubRow  { club: string; apps: number; goals: number; assists: number }
interface IntlRow  { nation: string; apps: number; goals: number; assists: number }
interface SeasonRow { season: string; seasonSort: number; club: string; league: string; apps: number; goals: number; assists: number }
interface CareerTotal { apps: number; goals: number; assists: number }

function parseClubTable(wikitext: string): {
  clubCareer: ClubRow[];
  currentSeason: SeasonRow | null;
  careerTotal: CareerTotal | null;
} {
  const clubCareer: ClubRow[] = [];
  let careerTotal: CareerTotal | null = null;
  let currentSeason: SeasonRow | null = null;

  // Find the first table
  const tStart = wikitext.indexOf('{|');
  if (tStart === -1) return { clubCareer, currentSeason, careerTotal };
  const tEnd = wikitext.indexOf('|}', tStart);
  const table = wikitext.slice(tStart, tEnd);

  const rows = table.split(/^\s*\|-/m).slice(1);
  let currentClub = '';
  let clubRowspan = 0;
  let latestSeasonSort = -1;

  for (const row of rows) {
    const lowerRow = row.toLowerCase();
    const nums = rowNums(row);

    // ── Career total row ──
    if (lowerRow.includes('total sur la carri') || lowerRow.includes('career total') || lowerRow.includes('total de carri')) {
      if (nums.length >= 3) {
        careerTotal = { apps: nums[nums.length - 3], goals: nums[nums.length - 2], assists: nums[nums.length - 1] };
      }
      continue;
    }

    // ── Sous-total row ──
    if (lowerRow.includes('sous-total') || lowerRow.includes('sub-total') || lowerRow.includes('subtotal')) {
      if (currentClub && nums.length >= 3) {
        // Remove if we already have this club (keep first occurrence = all seasons)
        if (!clubCareer.find(c => c.club === currentClub)) {
          clubCareer.push({ club: currentClub, apps: nums[nums.length - 3], goals: nums[nums.length - 2], assists: nums[nums.length - 1] });
        }
      }
      continue;
    }

    // ── Regular season row: extract club + season info ──
    const lines = row.split('\n');
    const cells: string[] = [];
    let hasNewClub = false;

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('|') || t.startsWith('|}') || t.startsWith('|+')) continue;
      const content = t.slice(1);
      const rsMatch = content.match(/^rowspan="(\d+)"\|(.+)/);
      if (rsMatch) {
        clubRowspan = parseInt(rsMatch[1]);
        currentClub = cleanWiki(rsMatch[2].split('||')[0]);
        hasNewClub = true;
        rsMatch[2].split('||').slice(1).forEach(p => cells.push(cleanWiki(p)));
        continue;
      }
      content.split('||').forEach(p => cells.push(cleanWiki(p)));
    }

    if (!hasNewClub) {
      if (clubRowspan > 0) clubRowspan--;
      else if (cells.length > 0 && !cells[0].match(/^\d{4}/) && cells[0] !== '') {
        currentClub = cells.shift()!;
      }
    }

    if (cells.length < 3) continue;
    const season = cells[0];
    const league = cells[1];
    if (!season.match(/\d{4}/)) continue;

    const yearMatch = season.match(/(\d{4})/);
    const seasonSort = yearMatch ? parseInt(yearMatch[1]) : 0;

    if (nums.length >= 3 && seasonSort >= latestSeasonSort) {
      latestSeasonSort = seasonSort;
      currentSeason = {
        season: season.replace(/–/g, '-'),
        seasonSort,
        club: currentClub,
        league,
        apps:    nums[nums.length - 3],
        goals:   nums[nums.length - 2],
        assists: nums[nums.length - 1],
      };
    }
  }

  // Sort club career by appearances desc
  clubCareer.sort((a, b) => b.apps - a.apps);

  return { clubCareer, currentSeason, careerTotal };
}

// ── International table parser ──
function parseIntlTable(wikitext: string): IntlRow[] {
  // Find the table
  const tStart = wikitext.indexOf('{|');
  if (tStart === -1) return [];
  const tEnd = wikitext.indexOf('|}', tStart);
  const table = wikitext.slice(tStart, tEnd);
  const rows = table.split(/^\s*\|-/m).slice(1);

  let nation = '';
  let nationRowspan = 0;
  const intlMap: Record<string, { apps: number; goals: number; assists: number }> = {};

  for (const row of rows) {
    const lowerRow = row.toLowerCase();
    const nums = rowNums(row);

    // Total row → skip or capture as single entry
    if (lowerRow.includes('total') && nation) {
      if (nums.length >= 2) {
        if (!intlMap[nation]) intlMap[nation] = { apps: 0, goals: 0, assists: 0 };
        intlMap[nation] = { apps: nums[nums.length - 2], goals: nums[nums.length - 1], assists: nums.length >= 3 ? nums[nums.length - 3] : 0 };
      }
      continue;
    }

    const lines = row.split('\n');
    const cells: string[] = [];
    let hasNewNation = false;

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('|') || t.startsWith('|}') || t.startsWith('|+')) continue;
      const content = t.slice(1);
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

    if (!hasNewNation) {
      if (nationRowspan > 0) nationRowspan--;
      else if (cells.length > 0 && !cells[0].match(/^\d{4}/) && cells[0] !== '') {
        nation = cells.shift()!;
      }
    }

    if (!nation || nums.length < 2) continue;
    const year = cells[0];
    if (!year?.match(/\d{4}/) && !year?.match(/\d{4}–/)) continue;

    if (!intlMap[nation]) intlMap[nation] = { apps: 0, goals: 0, assists: 0 };
    intlMap[nation].apps    += nums[nums.length - 2] ?? 0;
    intlMap[nation].goals   += nums[nums.length - 1] ?? 0;
  }

  return Object.entries(intlMap)
    .map(([nation, s]) => ({ nation, ...s }))
    .filter(r => r.apps > 0 || r.goals > 0)
    .sort((a, b) => b.apps - a.apps);
}

// ── Trophies parser ──
const LEAGUE_KW = ['ligue 1', 'premier league', 'serie a', 'la liga', 'bundesliga', 'primeira liga', 'eredivisie', 'super lig', 'championship title', 'league champion', 'mls cup'];
const CUP_KW    = ['fa cup', 'coupe de france', 'coppa italia', 'copa del rey', 'dfb-pokal', 'carabao', 'league cup', 'efl cup', 'trophée des champions', 'supercoppa', 'community shield', 'coupe de la ligue', 'copa do brasil'];
const INTL_KW   = ['world cup', 'euro', 'uefa nations', 'copa america', 'africa cup', 'afcon', 'gold cup', 'olympic'];

function parseTrophies(wikitext: string): { leagues: number; cups: number; international: string[] } {
  const lines = wikitext.split('\n');
  let currentTrophy = '';
  let leagues = 0, cups = 0;
  const international: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("'''") || (t.startsWith('==') && !t.startsWith('==='))) {
      currentTrophy = t.replace(/'+|=+/g, '').replace(/\[\[.*?\|?(.*?)\]\]/g, '$1').trim().toLowerCase();
    } else if (t.startsWith('*') && currentTrophy) {
      if (LEAGUE_KW.some(k => currentTrophy.includes(k))) leagues++;
      else if (CUP_KW.some(k => currentTrophy.includes(k))) cups++;
      else if (INTL_KW.some(k => currentTrophy.includes(k))) {
        const year = t.match(/\d{4}(?:[–-]\d{2,4})?/)?.[0] || '';
        const label = currentTrophy.split(/\n/)[0].replace(/\b\w/g, l => l.toUpperCase());
        if (year && !international.find(s => s === `${label} (${year})`)) {
          international.push(`${label} (${year})`);
        }
      }
    }
  }

  return { leagues, cups, international };
}

// ── Wikipedia fetch ──
async function fetchFromWikipedia(name: string) {
  // 1. Search
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

  // 2. List sections
  const sectionsData = await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=sections&format=json`
  ).then(r => r.json());

  const sections: any[] = sectionsData.parse?.sections || [];
  const careerSection  = sections.find((s: any) => s.line.toLowerCase().includes('career statistic'));
  const honoursSection = sections.find((s: any) => s.line.toLowerCase().includes('honour') || s.line.toLowerCase().includes('honor'));
  const intlSection    = sections.find((s: any) => s.line.toLowerCase().includes('international') && s.line.toLowerCase().includes('career'));

  // 3. Fetch wikitext in parallel
  const fetchSection = (idx: number) =>
    fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=wikitext&section=${idx}&format=json`)
      .then(r => r.json()).then(d => d.parse?.wikitext?.['*'] || '');

  const [careerText, intlText, honoursText, introData] = await Promise.all([
    careerSection  ? fetchSection(careerSection.index)  : Promise.resolve(''),
    intlSection    ? fetchSection(intlSection.index)    : Promise.resolve(''),
    honoursSection ? fetchSection(honoursSection.index) : Promise.resolve(''),
    fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page.title)}&prop=extracts&exintro=true&explaintext=true&format=json`).then(r => r.json()),
  ]);

  const { clubCareer, currentSeason, careerTotal } = parseClubTable(careerText || '');
  // International: check intlSection first, fallback to second table in careerText
  const intlWikitext = intlText || careerText.slice(careerText.indexOf('|}') + 2); // after first table
  const intlCareer = parseIntlTable(intlWikitext);
  const trophies   = parseTrophies(honoursText);

  const intro: string = (Object.values((introData.query?.pages || {}) as Record<string, any>)[0]?.extract as string) || '';
  const currentTeamMatch = intro.match(/plays(?:ed)? (?:as [\w\s-]+ )?for (?:[\w\s]+club )?([A-Z][^\.,]+)/);
  const currentTeam = currentTeamMatch?.[1]?.trim() || currentSeason?.club || clubCareer[0]?.club || null;

  return { clubCareer, currentSeason, intlCareer, careerTotal, trophies, currentTeam };
}

// ── TheSportsDB (photo) ──
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

// ── Supabase cache ──
function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

async function readCache(slug: string) {
  try {
    const { data } = await supabase
      .from('player_stats_cache')
      .select('data, updated_at')
      .eq('slug', slug)
      .single();
    if (!data) return null;
    const age = (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return age < CACHE_TTL_DAYS ? data.data : null;
  } catch { return null; }
}

async function writeCache(slug: string, data: any) {
  try {
    await supabase.from('player_stats_cache').upsert({ slug, data, updated_at: new Date().toISOString() });
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
      currentSeason: wiki?.currentSeason || null,
      clubCareer:    wiki?.clubCareer    || [],
      intlCareer:    wiki?.intlCareer    || [],
      careerTotal:   wiki?.careerTotal   || null,
      trophies:      wiki?.trophies      || { leagues: 0, cups: 0, international: [] },
    };

    await writeCache(slug, result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
