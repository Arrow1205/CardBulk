#!/usr/bin/env node
/**
 * sync-collections.js
 * Scrape collectosk.com/soccer-cards-and-stickers/ chaque semaine,
 * détecte les nouvelles collections et les ajoute aux fichiers JSON.
 *
 * Utilisation : node scripts/sync-collections.js
 * Variables d'env : GEMINI_API_KEY, SCRAPER_API_KEY (optionnel)
 */

const fs   = require('fs');
const path = require('path');

// ─── Chemins ─────────────────────────────────────────────────────────────────
const ROOT         = path.join(__dirname, '..');
const COL_DIR      = path.join(ROOT, 'data', 'collections');
const INDEX_PATH   = path.join(COL_DIR, 'index.json');
const CAT_PATH     = path.join(COL_DIR, 'collections_catalog.json');
const SETS_PATH    = path.join(ROOT, 'data', 'sets.json');
const TRACKED_PATH = path.join(COL_DIR, '_tracked_slugs.json');

// ─── Config ──────────────────────────────────────────────────────────────────
const LIST_URL    = 'https://www.collectosk.com/soccer-cards-and-stickers/';
const BASE_URL    = 'https://www.collectosk.com';
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const SCRAPER_KEY = process.env.SCRAPER_API_KEY;

// Rate-limit : pause entre chaque collection (ms)
const DELAY_MS = 2500;

// ─── Utils ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── HTTP fetch (direct + ScraperAPI fallback) ────────────────────────────────
async function fetchPage(url) {
  const candidates = [];

  // On essaie d'abord directement
  candidates.push(url);

  // Puis via ScraperAPI si disponible
  if (SCRAPER_KEY) {
    candidates.push(
      `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}`
    );
  }

  let lastErr;
  for (const u of candidates) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 3000) return text; // page valide
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Impossible de récupérer ${url} : ${lastErr?.message}`);
}

// ─── Parse la page liste de collectosk ───────────────────────────────────────
function parseListPage(html) {
  const results = [];
  const seen    = new Set();

  // Collectosk : URLs du type /2025-26-topps-chrome-premier-league-soccer-cards/
  // Elles commencent par un pattern d'année (4 chiffres ou "dddd-dd")
  const re = /href="(\/(20\d\d[^"]*?(?:soccer|football|baseball|basketball|hockey|tennis|nfl|rugby)[^"]*?-cards?)[^"]*)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const slug = href.replace(/^\/|\/$/g, '').split('/')[0]; // premier segment
    if (slug.length > 10 && !seen.has(slug) && !slug.includes('?') && !slug.includes('#')) {
      seen.add(slug);
      results.push({ slug, url: `${BASE_URL}/${slug}/` });
    }
  }

  return results;
}

// ─── Appel Gemini pour analyser une page collection ──────────────────────────
async function parseWithGemini(html, pageUrl) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY manquant');

  // On tronque à 50 Ko pour ne pas dépasser les limites Gemini
  const htmlSample = html.slice(0, 50000);

  const prompt = `Tu es un expert en cartes de sport (trading cards). Analyse cette page HTML de collectosk.com et extrais les informations de la collection.

URL analysée : ${pageUrl}

RÈGLES D'EXTRACTION :
- "publisher"       : éditeur en MAJUSCULES (ex: "TOPPS", "PANINI", "FUTERA", "UPPER DECK")
- "serie"           : nom court de la série EN MAJUSCULES, sans répéter le publisher ni la ligue
                      (ex: "CHROME", "FINEST", "SIMPLICIDAD", "FLAGSHIP", "DECO", "BOWMAN")
- "full_serie_name" : nom complet incluant compétition/ligue si présent, en MAJUSCULES
                      (ex: "CHROME / UEFA CHAMPIONS LEAGUE / UEFA EUROPA LEAGUE",
                           "FINEST / PREMIER LEAGUE",
                           "FLAGSHIP / PREMIER LEAGUE")
- "year"            : année de sortie (entier). Pour "2025-26" → 2026. Pour "2026-27" → 2027.
- "sport"           : "SOCCER" pour football, "BASKETBALL", "BASEBALL", "NHL", "NFL", "TENNIS"
- "folder_id"       : slug kebab-case unique pour le dossier local
                      Format : {publisher}-{serie}-{ligue?}-{year}-{sport}-cards
                      Ex: "topps-chrome-premier-league-2026-soccer-cards"
                          "topps-simplicidad-uefa-club-competitions-2026-soccer-cards"
- "visual_hints"    : courte description visuelle des cartes pour reconnaître la collection (2-3 phrases max)
- "card_types"      : liste COMPLÈTE de TOUS les types de cartes de la page
                      Format obligatoire : "CATÉGORIE / NOM EXACT" en MAJUSCULES
                      Catégories : BASE, PARALLEL, INSERT, AUTOGRAPH, AUTOGRAPH PARALLEL,
                                   RELIC, RELIC AUTOGRAPH, MEMORABILIA
                      Exemples :
                        "BASE"
                        "PARALLEL / BLUE /99"
                        "PARALLEL / GOLD 1/1"
                        "INSERT / CHROME CLASSICS"
                        "AUTOGRAPH / BASE"
                        "AUTOGRAPH / DUAL"
                        "RELIC / JERSEY"
                        "RELIC AUTOGRAPH / PATCH AUTO /25"
                      ⚠ Inclure TOUS les éléments des sections "Base Set", "Inserts",
                        "Autographs", "Relics", "Parallels" trouvés sur la page.

HTML À ANALYSER :
${htmlSample}

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{
  "publisher": "TOPPS",
  "serie": "CHROME",
  "full_serie_name": "CHROME / PREMIER LEAGUE",
  "year": 2026,
  "sport": "SOCCER",
  "folder_id": "topps-chrome-premier-league-2026-soccer-cards",
  "visual_hints": "Finition chromée brillante, refractors arc-en-ciel, logo Premier League...",
  "card_types": ["BASE", "PARALLEL / BLUE /99", "INSERT / CHROME CLASSICS"]
}`;

  const apiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(40000),
    }
  );

  const apiData = await apiRes.json();
  if (apiData.error) throw new Error(`Gemini: ${apiData.error.message}`);

  const raw = apiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini n\'a pas retourné de JSON valide');

  return JSON.parse(jsonMatch[0]);
}

// ─── Vérifie si le folder_id existe déjà ─────────────────────────────────────
function alreadyExists(folderId, index, catalog) {
  return (
    index.collections.some(c => c.id === folderId) ||
    catalog.some(c => c.folder === folderId)
  );
}

// ─── Ajoute la collection dans les 4 fichiers JSON ───────────────────────────
function addToAllFiles(parsed, collectoskSlug, collectoskUrl, index, catalog, sets) {
  const { folder_id, publisher, serie, full_serie_name, year, sport, visual_hints, card_types } = parsed;

  // 1. Créer le dossier + collection.json
  const folderPath = path.join(COL_DIR, folder_id);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const subsets = card_types.map(ct => {
    const sep   = ct.indexOf(' / ');
    const cat   = sep >= 0 ? ct.slice(0, sep) : ct;
    const sec   = sep >= 0 ? ct.slice(sep + 3) : null;
    return { subset: cat, section: sec, description: null };
  });

  const collectionJson = {
    collection_id: folder_id,
    source_url:    collectoskUrl,
    fiche: {
      annee:    String(year),
      editeur:  publisher,
      serie:    full_serie_name || serie,
      sport,
    },
    subsets,
  };
  saveJson(path.join(folderPath, 'collection.json'), collectionJson);

  // 2. Ajouter à index.json
  if (!index.collections.find(c => c.id === folder_id)) {
    index.collections.push({
      id:            folder_id,
      editeur:       publisher,
      serie:         full_serie_name || serie,
      annee:         String(year),
      total_cartes:  0,
      total_images:  0,
      path:          `${folder_id}/collection.json`,
      collectosk_url: collectoskUrl,
    });
  }

  // 3. Ajouter à collections_catalog.json
  if (!catalog.find(c => c.folder === folder_id)) {
    catalog.push({
      folder:         folder_id,
      year,
      publisher,
      serie,
      card_types,
      collectosk_url: collectoskUrl,
    });
  }

  // 4. Ajouter à sets.json si la série est nouvelle pour ce publisher + sport
  const sportKey = {
    SOCCER:     'football_soccer',
    BASKETBALL: 'basketball',
    BASEBALL:   'baseball',
    NFL:        'nfl',
    NHL:        'nhl',
    TENNIS:     'tennis',
    F1:         'f1',
  }[sport] || 'football_soccer';

  const brand = sets.brands.find(b => b.name.toUpperCase() === publisher);
  if (brand) {
    if (!brand.sports) brand.sports = {};
    if (!brand.sports[sportKey]) brand.sports[sportKey] = [];
    const existing = brand.sports[sportKey].find(
      s => s.name.toUpperCase() === serie.toUpperCase()
    );
    if (!existing) {
      const serieKw = serie.charAt(0).toUpperCase() + serie.slice(1).toLowerCase();
      brand.sports[sportKey].push({
        name:           serieKw,
        full_name:      `${publisher.charAt(0) + publisher.slice(1).toLowerCase()} ${serieKw}`,
        visual_hints:   visual_hints || '',
        common_subsets: card_types.filter(ct => !ct.startsWith('PARALLEL') && !ct.startsWith('AUTOGRAPH PARALLEL')),
        ebay_keywords:  [`Topps ${serieKw}`],
        ebay_template:  `{joueur} ${publisher.charAt(0) + publisher.slice(1).toLowerCase()} ${serieKw} {saison} {numero}`,
        notes:          `Ajouté automatiquement depuis ${collectoskUrl}`,
      });
    }
  }

  console.log(`  ✓ ${folder_id} — ${card_types.length} card_types`);
}

// ─── Mode --init : marquer toutes les collections collectosk actuelles comme vues ─
async function initTracked() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  INIT — Marquage de toutes les collections actuelles  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`📋 Récupération de ${LIST_URL}...`);

  const listHtml = await fetchPage(LIST_URL);
  const allItems = parseListPage(listHtml);
  const slugs    = allItems.map(i => i.slug);

  saveJson(TRACKED_PATH, slugs);
  console.log(`\n✅ ${slugs.length} slugs marqués comme "déjà vus" dans _tracked_slugs.json`);
  console.log('   La prochaine exécution normale ne traitera que les nouvelles collections.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Mode initialisation : node scripts/sync-collections.js --init
  if (process.argv.includes('--init')) {
    await initTracked();
    return;
  }

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Sync collections depuis collectosk.com     ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Charger les données existantes
  const index   = loadJson(INDEX_PATH);
  const catalog = loadJson(CAT_PATH);
  const sets    = loadJson(SETS_PATH);

  // Charger les slugs déjà traités
  let tracked = fs.existsSync(TRACKED_PATH) ? loadJson(TRACKED_PATH) : [];
  const trackedSet = new Set(tracked);

  // ── Étape 1 : Récupérer la liste collectosk ───────────────────────────────
  console.log(`📋 Récupération de ${LIST_URL}...`);
  let listHtml;
  try {
    listHtml = await fetchPage(LIST_URL);
  } catch (e) {
    console.error(`✗ Impossible d'accéder à la liste collectosk : ${e.message}`);
    process.exit(1);
  }

  const allItems = parseListPage(listHtml);
  console.log(`   ${allItems.length} collections détectées sur la page`);

  // ── Étape 2 : Filtrer les nouvelles ──────────────────────────────────────
  const newItems = allItems.filter(i => !trackedSet.has(i.slug));
  console.log(`   ${newItems.length} nouvelles (non encore traitées)\n`);

  if (newItems.length === 0) {
    console.log('✅ Aucune nouvelle collection. Base de données à jour.');
    return;
  }

  // ── Étape 3 : Traiter chaque nouvelle collection ──────────────────────────
  let added  = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of newItems) {
    console.log(`📦 ${item.slug}`);
    try {
      const html = await fetchPage(item.url);

      if (html.length < 4000) {
        console.log(`   ⚠ Page trop courte (${html.length} chars) — skip`);
        trackedSet.add(item.slug); // ne pas re-tenter
        skipped++;
        continue;
      }

      const parsed = await parseWithGemini(html, item.url);

      // Validation minimale
      const required = ['publisher', 'serie', 'year', 'folder_id', 'card_types'];
      const missing  = required.filter(k => !parsed[k]);
      if (missing.length) {
        console.log(`   ⚠ Champs manquants: ${missing.join(', ')} — skip`);
        skipped++;
        continue;
      }

      if (!Array.isArray(parsed.card_types) || parsed.card_types.length === 0) {
        console.log(`   ⚠ Aucun card_type extrait — skip`);
        skipped++;
        continue;
      }

      // Vérifier si le folder_id est déjà dans nos fichiers
      if (alreadyExists(parsed.folder_id, index, catalog)) {
        console.log(`   ℹ Déjà présent sous ${parsed.folder_id} — marque comme traité`);
        trackedSet.add(item.slug);
        continue;
      }

      addToAllFiles(parsed, item.slug, item.url, index, catalog, sets);
      trackedSet.add(item.slug);
      added++;

    } catch (e) {
      console.error(`   ✗ Erreur : ${e.message}`);
      errors++;
    }

    await sleep(DELAY_MS);
  }

  // ── Étape 4 : Sauvegarder tous les fichiers ───────────────────────────────
  if (added > 0) {
    console.log('\n💾 Sauvegarde des fichiers JSON...');
    saveJson(INDEX_PATH, index);
    saveJson(CAT_PATH,   catalog);
    saveJson(SETS_PATH,  sets);
    saveJson(TRACKED_PATH, [...trackedSet]);
    console.log('   ✓ index.json, collections_catalog.json, sets.json mis à jour');
  } else {
    // Sauvegarder quand même les slugs trackés
    saveJson(TRACKED_PATH, [...trackedSet]);
  }

  console.log(`\n╔═══════════════════════════════╗`);
  console.log(`║ Résultat                      ║`);
  console.log(`║  Ajoutées   : ${String(added).padEnd(15)}║`);
  console.log(`║  Ignorées   : ${String(skipped).padEnd(15)}║`);
  console.log(`║  Erreurs    : ${String(errors).padEnd(15)}║`);
  console.log(`╚═══════════════════════════════╝`);

  if (errors > 0) process.exit(1);
}

main().catch(e => {
  console.error('\n💥 Erreur fatale :', e.message);
  process.exit(1);
});
