import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normText } from '@/lib/checklistMatching';

export const dynamic = 'force-dynamic';

// Appelé par le cron Vercel (vercel.json) une fois par semaine.
// Protégé par CRON_SECRET pour éviter les appels non autorisés.
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const report = { intraDedup: 0, interDedup: 0, errors: [] as string[] };

  // ── 1. Déduplication INTRA-checklist ─────────────────────────────────────
  // Supprime les lignes en doublon à l'intérieur d'une même checklist
  // (même joueur + même subset + même section).
  for (const table of ['collections', 'manual_collections'] as const) {
    const { data: rows, error } = await sb.from(table).select('folder, data');
    if (error) { report.errors.push(`${table} read: ${error.message}`); continue; }

    for (const row of rows || []) {
      const checklist: any[] = row.data?.checklist || [];
      if (checklist.length === 0) continue;

      const seen = new Set<string>();
      const cleaned = checklist.filter(item => {
        const key = `${normText(item.joueur || '')}|${normText(item.subset || '')}|${normText(item.section || '')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (cleaned.length < checklist.length) {
        const removed = checklist.length - cleaned.length;
        const { error: upErr } = await sb
          .from(table)
          .update({ data: { ...row.data, checklist: cleaned } })
          .eq('folder', row.folder);
        if (upErr) report.errors.push(`${table}/${row.folder}: ${upErr.message}`);
        else report.intraDedup += removed;
      }
    }
  }

  // ── 2. Déduplication INTER-collections ───────────────────────────────────
  // Détecte des collections identiques importées plusieurs fois :
  // même éditeur normalisé + même année + ≥80% des 20 premiers joueurs en commun.
  // Garde la collection avec le plus d'entrées, supprime les autres.
  const { data: allRows } = await sb.from('collections').select('folder, catalog, data');

  type ColRow = { folder: string; catalog: any; data: any };
  const groups = new Map<string, ColRow[]>();

  for (const row of (allRows || []) as ColRow[]) {
    const pub  = normText(row.catalog?.editeur || row.catalog?.publisher || '');
    const year = String(row.catalog?.annee || row.catalog?.year || '').match(/\d{4}/)?.[0] || '';
    const groupKey = `${pub}|${year}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(row);
  }

  const fingerprint = (row: ColRow) =>
    (row.data?.checklist || [])
      .slice(0, 20)
      .map((i: any) => normText(i.joueur || ''))
      .filter(Boolean)
      .sort()
      .join('|');

  for (const members of Array.from(groups.values())) {
    if (members.length < 2) continue;
    const fps = members.map((r: ColRow) => ({ row: r, fp: fingerprint(r) }));

    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const arrA = fps[i].fp.split('|').filter(Boolean);
        const arrB = fps[j].fp.split('|').filter(Boolean);
        const setB = new Set(arrB);
        if (arrA.length === 0 || arrB.length === 0) continue;
        const common = arrA.filter((n: string) => setB.has(n)).length;
        const ratio = common / Math.max(arrA.length, arrB.length);
        if (ratio < 0.8) continue;

        // Doublon confirmé : on garde celui qui a le plus d'entrées
        const sizeA = (fps[i].row.data?.checklist || []).length;
        const sizeB = (fps[j].row.data?.checklist || []).length;
        const toDelete = sizeA >= sizeB ? fps[j].row.folder : fps[i].row.folder;

        const { error: delErr } = await sb.from('collections').delete().eq('folder', toDelete);
        if (delErr) report.errors.push(`delete ${toDelete}: ${delErr.message}`);
        else report.interDedup++;
      }
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
