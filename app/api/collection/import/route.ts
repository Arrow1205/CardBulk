import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { folder, data, catalogEntry } = await req.json();

    if (!folder || typeof folder !== 'string' || folder.includes('..') || folder.includes('/')) {
      return NextResponse.json({ error: 'Nom de dossier invalide' }, { status: 400 });
    }
    if (!data || !data.fiche || !data.fiche.serie || !data.fiche.editeur) {
      return NextResponse.json({ error: 'JSON invalide : fiche.serie et fiche.editeur sont requis' }, { status: 400 });
    }
    if (!Array.isArray(data.checklist)) {
      return NextResponse.json({ error: 'JSON invalide : checklist doit être un tableau' }, { status: 400 });
    }

    const colDir = path.join(process.cwd(), 'data', 'collections');
    const folderPath = path.join(colDir, folder);
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, 'collection.json'), JSON.stringify(data, null, 2), 'utf-8');

    const catalogPath = path.join(colDir, 'collections_catalog.json');
    const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) : [];
    const idx = catalog.findIndex((c: any) => c.folder === folder);
    const entry = { folder, ...catalogEntry };
    if (idx >= 0) catalog[idx] = entry; else catalog.push(entry);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

    return NextResponse.json({ ok: true, folder });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
