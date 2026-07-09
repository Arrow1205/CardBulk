import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get('brand') || '';
  const year = searchParams.get('year') || '';
  const series = searchParams.get('series') || '';
  const player = searchParams.get('player') || '';

  try {
    const indexPath = path.join(process.cwd(), 'data', 'subsets-index.json');
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const index: Record<string, any> = JSON.parse(raw);

    const subsetMap = new Map<string, { value: string, label: string }>();
    const seriesKey = series.split('/')[0].trim().toLowerCase();

    for (const col of Object.values(index)) {
      const yearMatch = !year || (col.annee || '') === year;
      const brandMatch = !brand || (col.editeur || '').toLowerCase() === brand.toLowerCase();
      const seriesMatch = !series || (col.serie || '').toLowerCase().includes(seriesKey);
      if (!yearMatch || !brandMatch || !seriesMatch) continue;

      let subsetsToUse: any[] = col.subsets || [];

      // Filter by player if provided
      if (player && col.players) {
        const playerLower = player.toLowerCase();
        const matchedKey = Object.keys(col.players).find(k => k.includes(playerLower) || playerLower.includes(k));
        if (matchedKey) {
          const playerSubsetValues = new Set(col.players[matchedKey]);
          subsetsToUse = subsetsToUse.filter((s: any) => playerSubsetValues.has(s.value));
        }
      }

      for (const s of subsetsToUse) {
        if (!s.value || subsetMap.has(s.value)) continue;
        const label = s.value.split('/').map((p: string) =>
          p.trim().charAt(0).toUpperCase() + p.trim().slice(1).toLowerCase()
        ).join(' / ');
        subsetMap.set(s.value, { value: s.value, label });
      }
    }

    const ORDER = ['BASE', 'INSERT', 'AUTOGRAPH', 'AUTOGRAPHED MEMORABILIA', 'MEMORABILIA'];
    const result = Array.from(subsetMap.values()).sort((a, b) => {
      const ai = ORDER.findIndex(o => a.value.startsWith(o));
      const bi = ORDER.findIndex(o => b.value.startsWith(o));
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.value.localeCompare(b.value);
    });

    return NextResponse.json({ subsets: result });
  } catch (e: any) {
    return NextResponse.json({ subsets: [], error: e.message });
  }
}
