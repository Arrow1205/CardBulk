import { NextResponse } from 'next/server';
import { normText } from '@/lib/checklistMatching';
import { supabaseFromRequest } from '@/lib/supabaseServer';

// Empêche Next.js/Vercel de mettre cette route en cache — les checklists sont ajoutées
// au fur et à mesure, il ne faut jamais servir une réponse figée.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Source des variations/subsets proposées au scan : les checklists réelles (Supabase),
// mises à jour dès qu'une nouvelle collection est importée — plus de fichier statique
// à régénérer manuellement (data/subsets-index.json est obsolète).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand  = searchParams.get('brand') || '';
  const year   = searchParams.get('year') || '';
  const series = searchParams.get('series') || '';
  const player = searchParams.get('player') || '';

  try {
    const supabase = supabaseFromRequest(req);
    const [{ data: shared }, { data: manual }] = await Promise.all([
      supabase.from('collections').select('folder, catalog, data'),
      supabase.from('manual_collections').select('folder, catalog, data'),
    ]);
    const allCollections = [...(shared || []), ...(manual || [])];

    const normBrand  = normText(brand);
    const seriesKey  = normText(series.split('/')[0] || '');
    const normPlayer = normText(player);

    const matchesRow = (row: any, requireYear: boolean) => {
      const col = row.catalog || {};
      const colYear  = String(col.annee || col.year || '');
      const colPub   = normText(col.editeur || col.publisher || '');
      const colSerie = normText(col.serie || '');

      const yearMatch   = !requireYear || !year || colYear.includes(year);
      const brandMatch  = !brand || colPub === normBrand || colPub.includes(normBrand) || normBrand.includes(colPub);
      const seriesMatch = !series || colSerie.includes(seriesKey);
      return yearMatch && brandMatch && seriesMatch;
    };

    // Le champ Année du formulaire ne correspond pas forcément exactement à l'année de la
    // collection choisie (le menu Collection/Set n'est pas filtré par année) — si le filtre
    // strict ne renvoie rien, on retente sans le critère année plutôt que de renvoyer une
    // liste de subsets vide.
    let matchingRows = allCollections.filter(row => matchesRow(row, true));
    if (matchingRows.length === 0) {
      matchingRows = allCollections.filter(row => matchesRow(row, false));
    }

    const subsetMap = new Map<string, { value: string; label: string; numero?: string }>();

    for (const row of matchingRows) {
      let checklist: any[] = row.data?.checklist || [];

      if (player) {
        checklist = checklist.filter(item => {
          const j = normText(item.joueur || '');
          return j.length >= 2 && (j.includes(normPlayer) || normPlayer.includes(j));
        });
      }

      for (const item of checklist) {
        const subset  = item.subset || '';
        const section = item.section || '';
        const value = section && section !== subset ? `${subset} / ${section}` : subset;
        if (!value || subsetMap.has(value)) continue;
        const label = value.split('/').map((p: string) =>
          p.trim().charAt(0).toUpperCase() + p.trim().slice(1).toLowerCase()
        ).join(' / ');
        const numero = item.numero ? String(item.numero) : undefined;
        subsetMap.set(value, { value, label, numero });
      }
    }

    const ORDER = ['BASE', 'INSERT', 'AUTOGRAPH', 'AUTOGRAPHED MEMORABILIA', 'MEMORABILIA', 'RELIC'];
    const result = Array.from(subsetMap.values()).sort((a, b) => {
      const ai = ORDER.findIndex(o => a.value.toUpperCase().startsWith(o));
      const bi = ORDER.findIndex(o => b.value.toUpperCase().startsWith(o));
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.value.localeCompare(b.value);
    });

    return NextResponse.json({ subsets: result }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e: any) {
    return NextResponse.json({ subsets: [], error: e.message });
  }
}
