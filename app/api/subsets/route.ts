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
    const dataDir = path.join(process.cwd(), 'data', 'collections');
    const indexRaw = fs.readFileSync(path.join(dataDir, 'index.json'), 'utf-8');
    const index = JSON.parse(indexRaw);

    // Filter collections by year and brand
    let filtered = index.collections.filter((c: any) => {
      const yearMatch = !year || (c.annee || '').startsWith(year);
      const brandMatch = !brand || (c.editeur || '').toLowerCase() === brand.toLowerCase();
      const seriesMatch = !series || (c.serie || '').toLowerCase().includes(series.split('/')[0].trim().toLowerCase());
      return yearMatch && brandMatch && seriesMatch;
    });

    // Load subsets from each collection
    const subsetMap = new Map<string, {value: string, label: string}>();

    for (const col of filtered.slice(0, 10)) { // limit to 10 collections max
      const colPath = path.join(dataDir, col.path);
      try {
        const colRaw = fs.readFileSync(colPath, 'utf-8');
        const colData = JSON.parse(colRaw);

        let subsetsToUse = colData.subsets || [];

        // If player provided, filter by player presence in checklist
        if (player && colData.checklist?.length > 0) {
          const playerLower = player.toLowerCase();
          const playerSubsets = new Set(
            (colData.checklist || [])
              .filter((c: any) => (c.joueur || '').toLowerCase().includes(playerLower))
              .map((c: any) => `${c.subset} / ${c.section}`)
          );
          if (playerSubsets.size > 0) {
            subsetsToUse = subsetsToUse.filter((s: any) => playerSubsets.has(`${s.subset} / ${s.section}`));
          }
        }

        for (const s of subsetsToUse) {
          const subset = (s.subset || '').trim();
          const section = (s.section || '').trim();
          if (!subset) continue;

          let value: string;
          if (section && section !== subset) {
            value = `${subset} / ${section}`;
          } else {
            value = subset;
          }

          if (!subsetMap.has(value)) {
            // Title case for label
            const label = value.split('/').map((p: string) =>
              p.trim().charAt(0).toUpperCase() + p.trim().slice(1).toLowerCase()
            ).join(' / ');
            subsetMap.set(value, { value, label });
          }
        }
      } catch { continue; }
    }

    // Sort: BASE first, then INSERT, then AUTOGRAPH, then rest
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
