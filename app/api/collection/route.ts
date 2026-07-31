import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');
  const light = searchParams.get('light') === '1';

  if (!folder || folder.includes('..') || folder.includes('/')) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  try {
    // 1. Collections scrapées (Beckett) — fichiers statiques versionnés dans le repo
    const filePath = path.join(process.cwd(), 'data', 'collections', folder, 'collection.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Mode léger : ne renvoie que fiche + checklist (pour calculer une progression
      // sur beaucoup de collections sans télécharger images/stats/gemini_context).
      if (light) return NextResponse.json({ fiche: data.fiche || null, checklist: data.checklist || [] });
      return NextResponse.json(data);
    }

    // 2. Collections importées manuellement par l'utilisateur — stockées dans Supabase
    // (le filesystem Vercel est éphémère, on ne peut pas y écrire de façon permanente).
    const supabase = createRouteHandlerClient({ cookies });
    const { data: row } = await supabase
      .from('manual_collections')
      .select('data')
      .eq('folder', folder)
      .single();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (light) return NextResponse.json({ fiche: row.data.fiche || null, checklist: row.data.checklist || [] });
    return NextResponse.json(row.data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
