#!/usr/bin/env node
/**
 * migrate-collections-to-supabase.js
 *
 * Migre les ~200 collections scrapées (data/collections/<folder>/collection.json)
 * vers la table Supabase `collections`. Ne garde que fiche + checklist (les seuls
 * champs lus par l'app) — pas les images/stats/gemini_context/page.html qui font
 * gonfler le dossier local à 1.3 Go pour rien.
 *
 * Objectif : que les routes API (app/api/collection, app/api/checklist-progress)
 * n'aient plus besoin de lire data/collections/ sur disque à l'exécution — ce dossier
 * dynamique fait bundler tout le répertoire (images comprises) dans les fonctions
 * serverless Vercel et dépasse la limite de taille.
 *
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-collections-to-supabase.js
 */

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  console.error('   (récupérables dans Vercel > Settings > Environment Variables, ou Supabase > Settings > API)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const COL_DIR      = path.join(__dirname, '..', 'data', 'collections');
const CATALOG_PATH = path.join(COL_DIR, 'collections_catalog.json');

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`📦 ${catalog.length} collections à migrer...`);

  let ok = 0, skipped = 0, failed = 0;

  for (const entry of catalog) {
    const filePath = path.join(COL_DIR, entry.folder, 'collection.json');
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  ${entry.folder} : collection.json introuvable, ignoré`);
      skipped++;
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const { folder, ...catalogEntry } = entry;

    const { error } = await supabase.from('collections').upsert({
      folder: entry.folder,
      catalog: catalogEntry,
      data: { fiche: raw.fiche || null, checklist: raw.checklist || [] },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`❌ ${entry.folder} : ${error.message}`);
      failed++;
    } else {
      ok++;
      process.stdout.write(`\r✓ ${ok}/${catalog.length}`);
    }
  }

  console.log(`\n\nTerminé : ${ok} migrées, ${skipped} ignorées (fichier manquant), ${failed} erreurs.`);
}

main();
