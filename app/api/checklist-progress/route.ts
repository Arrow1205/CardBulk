import { NextResponse } from 'next/server';
import { findMatchingCard, cardsSignature, normText } from '@/lib/checklistMatching';
import { supabaseFromRequest } from '@/lib/supabaseServer';

// Empêche Next.js/Vercel de mettre cette route en cache — sinon une collection supprimée
// puis réimportée pouvait continuer à renvoyer d'anciens compteurs mis en cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = supabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1';

    // Toutes les collections (scrapées globales + importées par l'utilisateur) vivent dans Supabase.
    const [{ data: cards }, { data: sharedRows }, { data: manualRows }] = await Promise.all([
      supabase
        .from('cards')
        .select('id, updated_at, firstname, lastname, brand, series, variation, year, is_auto, is_patch, sport')
        .eq('user_id', user.id)
        .eq('is_wishlist', false),
      supabase.from('collections').select('folder, catalog, data'),
      supabase.from('manual_collections').select('folder, catalog, data').eq('user_id', user.id),
    ]);

    // La signature inclut aussi l'ensemble des collections (pas seulement les cartes) : sinon,
    // importer une nouvelle collection sans changer ses cartes gardait l'ancien cache et son
    // compteur restait à 0 (donc masquée par la règle "ne pas afficher si vide").
    const folderIds = [...(sharedRows || []), ...(manualRows || [])].map(r => r.folder).sort().join('|');
    const signature = `${cardsSignature(cards || [])}::${folderIds}`;

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('checklist_progress_cache')
        .select('counts, cards_signature')
        .eq('user_id', user.id)
        .single();
      if (cached && cached.cards_signature === signature) {
        return NextResponse.json({ counts: cached.counts, cached: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
      }
    }

    const counts: Record<string, number> = {};

    for (const row of [...(sharedRows || []), ...(manualRows || [])]) {
      const col = { folder: row.folder, ...row.catalog };
      counts[row.folder] = countOwned(col, row.data?.checklist || [], cards || [], row.folder);
    }

    await supabase.from('checklist_progress_cache').upsert({
      user_id: user.id,
      counts,
      cards_signature: signature,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ counts, cached: false }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

const SPORT_FROM_FOLDER: [string, string][] = [
  ['soccer', 'SOCCER'], ['football', 'SOCCER'],
  ['tennis', 'TENNIS'],
  ['basketball', 'BASKETBALL'],
  ['baseball', 'BASEBALL'],
  ['hockey', 'HOCKEY'],
];

function colSportFromFolder(folder: string): string {
  const f = folder.toLowerCase();
  for (const [kw, sport] of SPORT_FROM_FOLDER) {
    if (f.includes(kw)) return sport;
  }
  return '';
}

function countOwned(col: any, checklist: any[], cards: any[], folder: string): number {
  const colYear  = String(col.annee || col.year || '').match(/\d{4}/)?.[0] || '';
  const colPub   = normText(col.editeur || col.publisher || '');
  const colSerie = normText(col.serie || '');
  const colSport = colSportFromFolder(folder);
  let count = 0;
  for (const item of checklist) {
    if (findMatchingCard(item.joueur, item.subset, item.section, colYear, colPub, colSerie, cards, colSport)) count++;
  }
  return count;
}
