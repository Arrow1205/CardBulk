import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');

  if (!folder || folder.includes('..') || folder.includes('/')) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'collections', folder, 'collection.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Mode léger : ne renvoie que fiche + checklist (pour calculer une progression
    // sur beaucoup de collections sans télécharger images/stats/gemini_context).
    if (searchParams.get('light') === '1') {
      return NextResponse.json({ fiche: data.fiche || null, checklist: data.checklist || [] });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
