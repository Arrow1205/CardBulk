import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── TheSportsDB — photo + club actuel (gratuit, fiable) ──
async function fetchTSDB(name: string) {
  try {
    const r = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const d = await r.json();
    const players: any[] = d.player || [];
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const q = norm(name);
    return players.find(p => norm(p.strPlayer) === q)
      || players.find(p => { const n = norm(p.strPlayer); return n.length > 3 && (q.includes(n) || n.includes(q)); })
      || players[0] || null;
  } catch { return null; }
}

// ── Gemini avec Google Search grounding — stats temps réel ──
async function fetchGeminiStats(name: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // @ts-ignore
    tools: [{ googleSearch: {} }],
  });

  const prompt = `Recherche les statistiques footballistiques complètes du joueur "${name}".
Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans \`\`\`), avec cette structure exacte :
{
  "currentTeam": "nom du club actuel",
  "nationality": "nationalité",
  "age": 30,
  "position": "Attaquant",
  "stats": [
    {
      "season": "25/26",
      "seasonSort": 2025,
      "team": "nom du club",
      "league": "nom de la compétition",
      "country": "pays",
      "appearances": 10,
      "goals": 5,
      "assists": 3,
      "minutes": 800,
      "yellowCards": 1,
      "redCards": 0
    }
  ],
  "trophies": [
    { "league": "Ligue 1", "country": "France", "season": "2024/25" }
  ],
  "recentNews": [
    { "title": "titre de l'actualité récente", "summary": "résumé en 1 phrase", "date": "2025-07-01" }
  ]
}
Inclure les 5 dernières saisons minimum. Inclure les matchs en club ET en sélection nationale séparément.
Pour recentNews, inclure les 3 dernières actualités importantes du joueur.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Extraire le JSON même si Gemini ajoute du texte autour
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
    // Requêtes parallèles : TheSportsDB (photo) + Gemini (stats)
    const [tsdb, gemini] = await Promise.allSettled([
      fetchTSDB(name),
      fetchGeminiStats(name, GEMINI_KEY),
    ]);

    const tsdbPlayer = tsdb.status === 'fulfilled' ? tsdb.value : null;
    const geminiData = gemini.status === 'fulfilled' ? gemini.value : null;

    if (gemini.status === 'rejected') {
      console.error('[player-stats] Gemini error:', (gemini as any).reason?.message);
    }

    const birthDate = tsdbPlayer?.dateBorn;
    const age = birthDate
      ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : geminiData?.age ?? null;

    const player = {
      firstname: (tsdbPlayer?.strPlayer || name).split(' ').slice(0, -1).join(' '),
      lastname:  (tsdbPlayer?.strPlayer || name).split(' ').slice(-1)[0] || name,
      photo:     tsdbPlayer?.strThumb || tsdbPlayer?.strCutout || null,
      nationality:    tsdbPlayer?.strNationality || geminiData?.nationality || null,
      age,
      position:       geminiData?.position || tsdbPlayer?.strPosition || null,
      currentTeam:    geminiData?.currentTeam || tsdbPlayer?.strTeam || null,
      currentTeamLogo: null,
    };

    const stats: any[] = (geminiData?.stats || []).map((s: any) => ({
      season:      s.season,
      seasonSort:  s.seasonSort ?? parseInt((s.season || '').split('/')[0]) + 2000,
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
      shots:       null,
      shotsOn:     null,
    }));

    stats.sort((a, b) => b.seasonSort - a.seasonSort);

    return NextResponse.json({
      player,
      stats,
      trophies: geminiData?.trophies || [],
      recentNews: geminiData?.recentNews || [],
    });
  } catch (e: any) {
    console.error('[player-stats] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
