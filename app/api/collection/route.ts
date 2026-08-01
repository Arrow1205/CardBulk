import { NextResponse } from 'next/server';
import { supabaseFromRequest } from '@/lib/supabaseServer';

// Toutes les collections (scrapées + importées manuellement) vivent désormais dans Supabase.
// On ne touche plus au disque ici : data/collections/ contient ~1.3 Go d'images/HTML de
// scraping que Vercel embarquait dans le bundle serverless à cause des lectures fs dynamiques.

// Empêche Next.js/Vercel de mettre cette route en cache — sinon une collection supprimée
// puis réimportée pouvait continuer à renvoyer l'ancienne réponse mise en cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');
  const light = searchParams.get('light') === '1';

  if (!folder || folder.includes('..') || folder.includes('/')) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  try {
    const supabase = supabaseFromRequest(req);

    // 1. Collections scrapées (globales, table `collections`)
    const { data: shared } = await supabase
      .from('collections')
      .select('data')
      .eq('folder', folder)
      .single();

    // 2. Sinon, collection importée manuellement par l'utilisateur (`manual_collections`)
    const raw = shared?.data || (await supabase
      .from('manual_collections')
      .select('data')
      .eq('folder', folder)
      .single()
    ).data?.data;

    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const headers = { 'Cache-Control': 'no-store, max-age=0' };
    if (light) return NextResponse.json({ fiche: raw.fiche || null, checklist: raw.checklist || [] }, { headers });
    return NextResponse.json(raw, { headers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
