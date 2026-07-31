import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Toutes les collections (scrapées + importées manuellement) vivent désormais dans Supabase.
// On ne touche plus au disque ici : data/collections/ contient ~1.3 Go d'images/HTML de
// scraping que Vercel embarquait dans le bundle serverless à cause des lectures fs dynamiques.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');
  const light = searchParams.get('light') === '1';

  if (!folder || folder.includes('..') || folder.includes('/')) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

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

    if (light) return NextResponse.json({ fiche: raw.fiche || null, checklist: raw.checklist || [] });
    return NextResponse.json(raw);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
