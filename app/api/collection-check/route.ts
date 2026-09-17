import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface CardCandidate {
  id: string;
  firstname: string;
  lastname: string;
  brand: string;
  series: string;
  year: string;
  variation: string | null;
  is_auto: boolean;
  is_patch: boolean;
  is_rookie: boolean;
  is_numbered: boolean;
  numbering_max: string | null;
  image_url: string | null;
}

interface CheckResult {
  score: number;
  card: CardCandidate;
  reason: string;
}

function normStr(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function textScore(extracted: Record<string, string>, card: CardCandidate): number {
  let score = 0;
  let total = 0;

  const fields: [string, string | null | undefined, number][] = [
    [extracted.lastname,  card.lastname,  30],
    [extracted.firstname, card.firstname, 20],
    [extracted.brand,     card.brand,     15],
    [extracted.year,      card.year,      15],
    [extracted.series,    card.series,    10],
    [extracted.variation, card.variation, 10],
  ];

  for (const [ext, col, weight] of fields) {
    if (!ext) continue;
    total += weight;
    const ne = normStr(ext);
    const nc = normStr(col);
    if (ne && nc) {
      if (ne === nc) score += weight;
      else if (ne.includes(nc) || nc.includes(ne)) score += weight * 0.7;
    }
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}

async function callGemini(apiKey: string, parts: any[]): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: AbortSignal.timeout(30000),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, userId } = body; // image = base64 data URL

    if (!image || !userId) {
      return NextResponse.json({ error: 'Missing image or userId' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY!;
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── ÉTAPE 1 : Extraction métadonnées depuis l'image ───────────────────────
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    let extracted: Record<string, string> = {};
    try {
      const metaText = await callGemini(apiKey, [
        {
          text: `Analyse cette carte de sport et retourne UNIQUEMENT un objet JSON avec ces champs (vide "" si inconnu) :
{"firstname":"","lastname":"","brand":"","series":"","year":"","variation":"","sport":""}

- firstname / lastname : nom du joueur sur la carte
- brand : éditeur (Panini, Topps, Upper Deck, Prizm, Select, Optic, Donruss...)
- series : nom de la série/collection (Prizm, Chrome, National Treasures...)
- year : année (4 chiffres si visible)
- variation : nom de la parallèle/variation (Base, Prizm Silver, Gold, Refractor, Holo...)
- sport : SOCCER, BASKETBALL, BASEBALL, FOOTBALL, TENNIS ou autre

Réponds UNIQUEMENT avec le JSON, sans markdown.`,
        },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ]);

      const match = metaText.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: 'Impossible d\'analyser l\'image' }, { status: 422 });
    }

    if (!extracted.lastname) {
      return NextResponse.json({ extracted, candidates: [], message: 'Aucun joueur détecté sur la carte' });
    }

    // ── ÉTAPE 2 : Recherche textuelle dans la collection ─────────────────────
    const { data: dbCards } = await sb
      .from('cards')
      .select('id, firstname, lastname, brand, series, year, variation, is_auto, is_patch, is_rookie, is_numbered, numbering_max, image_url')
      .eq('user_id', userId)
      .eq('is_wishlist', false)
      .ilike('lastname', `%${extracted.lastname}%`)
      .limit(20);

    const candidates: CardCandidate[] = dbCards || [];

    if (candidates.length === 0) {
      return NextResponse.json({ extracted, candidates: [], results: [] });
    }

    // ── ÉTAPE 3 : Score textuel ───────────────────────────────────────────────
    const scored: CheckResult[] = candidates
      .map(card => ({ card, score: textScore(extracted, card), reason: 'metadata' }))
      .sort((a, b) => b.score - a.score);

    // ── ÉTAPE 4 : Comparaison visuelle Gemini sur le top 3 avec image ────────
    const topWithImage = scored
      .filter(r => r.score >= 40 && r.card.image_url)
      .slice(0, 3);

    for (const result of topWithImage) {
      try {
        const imgRes = await fetch(result.card.image_url!, { signal: AbortSignal.timeout(5000) });
        const imgBuf = await imgRes.arrayBuffer();
        const refBase64 = Buffer.from(imgBuf).toString('base64');
        const refMime = result.card.image_url!.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

        const compText = await callGemini(apiKey, [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { inline_data: { mime_type: refMime, data: refBase64 } },
          {
            text: `Compare ces deux cartes de sport (image 1 = carte scannée, image 2 = carte de référence).
Retourne UNIQUEMENT un JSON : {"score": <0-100>, "reason": "<1 phrase courte>"}
- score 95-100 = exactement la même carte (même variation, même numéro si applicable)
- score 75-94 = même joueur, même série mais variation différente
- score 50-74 = même joueur mais série/année différente
- score 0-49 = joueur différent ou carte sans rapport

Réponds UNIQUEMENT avec le JSON, sans markdown.`,
          },
        ]);

        const compMatch = compText.match(/\{[\s\S]*\}/);
        if (compMatch) {
          const comp = JSON.parse(compMatch[0]);
          // Moyenne pondérée : 40% texte + 60% visuel
          result.score = Math.round(result.score * 0.4 + (comp.score ?? 0) * 0.6);
          result.reason = comp.reason || result.reason;
        }
      } catch { /* garde le score textuel */ }
    }

    // Fusionne et filtre les résultats
    const topIds = new Set(topWithImage.map(r => r.card.id));
    const finalResults = [
      ...topWithImage,
      ...scored.filter(r => !topIds.has(r.card.id) && r.score >= 40),
    ].sort((a, b) => b.score - a.score).slice(0, 5);

    return NextResponse.json({ extracted, results: finalResults });
  } catch (e: any) {
    console.error('collection-check error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
