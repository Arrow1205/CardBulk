import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Wikipedia API — stats de carrière à jour ──
async function findWikipediaPage(name: string): Promise<string | null> {
  const search = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' footballer')}&srlimit=5&format=json`,
    { signal: AbortSignal.timeout(8000) }
  ).then(r => r.json());

  const results = search.query?.search || [];
  if (!results.length) return null;

  // Prendre le premier résultat dont le titre contient le nom
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const q = norm(name);
  const match = results.find((r: any) => norm(r.title).includes(q) || q.includes(norm(r.title)))
    || results[0];
  return match.title;
}

async function fetchWikiStats(pageTitle: string): Promise<{ sections: Record<string, string>; intro: string }> {
  // Récupérer les sections de la page
  const [sectionsData, introData] = await Promise.all([
    fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=sections&format=json`).then(r => r.json()),
    fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&exintro=true&explaintext=true&format=json`).then(r => r.json()),
  ]);

  const allSections: any[] = sectionsData.parse?.sections || [];
  const intro = Object.values((introData.query?.pages || {}) as Record<string, any>)[0]?.extract || '';

  // Trouver les sections utiles
  const USEFUL = ['career statistics', 'club career', 'international career', 'honours', 'personal life'];
  const usefulSections = allSections.filter((s: any) =>
    USEFUL.some(k => s.line.toLowerCase().includes(k))
  );

  const sections: Record<string, string> = {};
  for (const section of usefulSections.slice(0, 6)) {
    try {
      const d = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&section=${section.index}&format=json`
      ).then(r => r.json());
      sections[section.line] = d.parse?.wikitext?.['*'] || '';
    } catch {}
  }

  return { sections, intro };
}

// ── TheSportsDB — photo ──
async function fetchTSDB(name: string) {
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    const players: any[] = d.player || [];
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const q = norm(name);
    return players.find(p => norm(p.strPlayer) === q)
      || players.find(p => { const n = norm(p.strPlayer); return n.length > 3 && (q.includes(n) || n.includes(q)); })
      || players[0] || null;
  } catch { return null; }
}

// ── Gemini — structurer le wikitext en JSON ──
async function geminiStructure(name: string, wikiContent: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Tu es un expert football. Voici le contenu Wikipedia de ${name} :

${wikiContent.slice(0, 15000)}

Extrait et retourne UNIQUEMENT un JSON valide (sans markdown, sans \`\`\`) :
{
  "currentTeam": "club actuel",
  "nationality": "nationalité",
  "age": 30,
  "position": "poste",
  "stats": [
    {
      "season": "2024-25",
      "seasonSort": 2024,
      "team": "club",
      "league": "compétition",
      "country": "pays",
      "appearances": 10,
      "goals": 5,
      "assists": 0,
      "minutes": null,
      "yellowCards": null,
      "redCards": null
    }
  ],
  "trophies": [
    { "league": "nom trophée", "country": "pays", "season": "saison" }
  ]
}
Inclure toutes les saisons du tableau Career statistics (club ET sélection nationale séparément).
Pour la sélection, utilise le nom du pays comme "team". Ne pas inclure les lignes "Total".`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Gemini response');
  return JSON.parse(jsonMatch[0]);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

  try {
    // Parallèle : photo + recherche Wikipedia
    const [tsdb, wikiTitle] = await Promise.all([
      fetchTSDB(name),
      findWikipediaPage(name),
    ]);

    if (!wikiTitle) {
      return NextResponse.json({ player: buildPlayer(tsdb, null, []), stats: [], trophies: [] });
    }

    console.log(`[player-stats] Wikipedia page: "${wikiTitle}"`);

    const { sections, intro } = await fetchWikiStats(wikiTitle);
    const wikiContent = intro + '\n\n' + Object.entries(sections).map(([k, v]) => `==${k}==\n${v}`).join('\n\n');

    const gemini = await geminiStructure(name, wikiContent, GEMINI_KEY);

    const stats: any[] = (gemini.stats || []).map((s: any) => ({
      season:      s.season,
      seasonSort:  s.seasonSort ?? parseInt((s.season || '').split(/[-\/]/)[0]),
      seasonLabel: s.season,
      team:        s.team,
      teamLogo:    null,
      league:      s.league,
      leagueLogo:  null,
      country:     s.country || '',
      appearances: s.appearances ?? null,
      minutes:     s.minutes ?? null,
      rating:      null,
      goals:       s.goals ?? null,
      assists:     s.assists ?? null,
      yellowCards: s.yellowCards ?? null,
      redCards:    s.redCards ?? null,
    }));

    stats.sort((a, b) => b.seasonSort - a.seasonSort);

    return NextResponse.json({
      player:     buildPlayer(tsdb, gemini, stats),
      stats,
      trophies:   gemini.trophies || [],
      recentNews: [],
    });
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function buildPlayer(tsdb: any, gemini: any, stats: any[]) {
  const name = tsdb?.strPlayer || '';
  const birthDate = tsdb?.dateBorn;
  const age = birthDate
    ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : gemini?.age ?? null;

  return {
    firstname:   name.split(' ').slice(0, -1).join(' '),
    lastname:    name.split(' ').slice(-1)[0] || name,
    photo:       tsdb?.strThumb || tsdb?.strCutout || null,
    nationality: tsdb?.strNationality || gemini?.nationality || null,
    age,
    position:    gemini?.position || tsdb?.strPosition || null,
    currentTeam: gemini?.currentTeam || tsdb?.strTeam || stats[0]?.team || null,
    currentTeamLogo: null,
  };
}
