import { NextResponse } from 'next/server';
import { findMatchingCard, cardsSignature, normText } from '@/lib/checklistMatching';
import { supabaseFromRequest } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const supabase = supabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1';

    const { data: cards } = await supabase
      .from('cards')
      .select('id, updated_at, firstname, lastname, brand, series, variation, year, is_auto, is_patch')
      .eq('user_id', user.id)
      .eq('is_wishlist', false);

    const signature = cardsSignature(cards || []);

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('checklist_progress_cache')
        .select('counts, cards_signature')
        .eq('user_id', user.id)
        .single();
      if (cached && cached.cards_signature === signature) {
        return NextResponse.json({ counts: cached.counts, cached: true });
      }
    }

    // Toutes les collections (scrapées globales + importées par l'utilisateur) vivent dans Supabase.
    const [{ data: sharedRows }, { data: manualRows }] = await Promise.all([
      supabase.from('collections').select('folder, catalog, data'),
      supabase.from('manual_collections').select('folder, catalog, data').eq('user_id', user.id),
    ]);

    const counts: Record<string, number> = {};

    for (const row of [...(sharedRows || []), ...(manualRows || [])]) {
      const col = { folder: row.folder, ...row.catalog };
      counts[row.folder] = countOwned(col, row.data?.checklist || [], cards || []);
    }

    await supabase.from('checklist_progress_cache').upsert({
      user_id: user.id,
      counts,
      cards_signature: signature,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ counts, cached: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function countOwned(col: any, checklist: any[], cards: any[]): number {
  const colYear  = String(col.annee || col.year || '').match(/\d{4}/)?.[0] || '';
  const colPub   = normText(col.editeur || col.publisher || '');
  const colSerie = normText(col.serie || '');
  let count = 0;
  for (const item of checklist) {
    if (findMatchingCard(item.joueur, item.subset, item.section, colYear, colPub, colSerie, cards)) count++;
  }
  return count;
}
