#!/usr/bin/env node
/**
 * sync-collections.js
 * Source : beckett.com/news/category/beckett-soccer/
 *
 * Chaque semaine (vendredi 9h UTC via GitHub Actions) :
 *   1. Lit la page catégorie Beckett → récupère les articles < 8 jours
 *   2. Filtre les articles "collection" (titre commençant par une année)
 *   3. Fetche chaque article → parse les tabs HTML (Base/Inserts/Autos/Memorabilia)
 *   4. Appelle Gemini une seule fois par article pour extraire publisher/serie/year/folder_id
 *   5. Met à jour index.json, collections_catalog.json, sets.json et crée collection.json
 *
 * Usage : node scripts/sync-collections.js [--init] [--all]
 *   --init  : marquer tous les articles actuels comme vus (1re utilisation)
 *   --all   : traiter sans limite de date (re-traitement complet)
 */

const fs   = require('fs');
const path = require('path');
let XLSX = null;
try { XLSX = require('xlsx'); } catch { /* xlsx optionnel */ }

// ─── Chemins ─────────────────────────────────────────────────────────────────
const ROOT         = path.join(__dirname, '..');
const COL_DIR      = path.join(ROOT, 'data', 'collections');
const INDEX_PATH   = path.join(COL_DIR, 'index.json');
const CAT_PATH     = path.join(COL_DIR, 'collections_catalog.json');
const SETS_PATH    = path.join(ROOT, 'data', 'sets.json');
const TRACKED_PATH = path.join(COL_DIR, '_tracked_slugs.json');

// ─── Config ──────────────────────────────────────────────────────────────────
const BECKETT_LIST  = 'https://www.beckett.com/news/category/beckett-soccer/';
const BECKETT_BASE  = 'https://www.beckett.com';
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const SCRAPER_KEY   = process.env.SCRAPER_API_KEY;
const DAYS_LOOKBACK = 8;  // articles des X derniers jours
const DELAY_MS      = 3000;

// ─── Utils ───────────────────────────────────────────────────────────────────
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const loadJson = p  => JSON.parse(fs.readFileSync(p, 'utf8'));
const saveJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');

// ─── HTTP fetch (direct puis ScraperAPI) ─────────────────────────────────────
async function fetchPage(url, { retry = true } = {}) {
  const candidates = [url];
  if (SCRAPER_KEY) {
    candidates.push(`http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}`);
  }

  for (const u of candidates) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.beckett.com/',
        },
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 3000) return text;
      }
    } catch (e) {
      // essaie le suivant
    }
  }
  throw new Error(`Impossible de récupérer : ${url}`);
}

// ─── Parse la page catégorie Beckett ─────────────────────────────────────────
// Retourne : [{ slug, url, title, date }]
function parseCategoryPage(html) {
  const results = [];
  const seen    = new Set();

  // Chaque article : <h4 class="title ..."><a href="...">{title}</a></h4>
  // Date : "By Author - July 27, 2026"  ou  div.day + div.month
  const itemRe = /<h4[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  // Date depuis post-author : "- Month DD, YYYY"
  const dateRe = /-\s+([A-Za-z]+ \d{1,2},\s*\d{4})/;

  // On cherche par bloc d'article
  const blocks = html.split('<div class="post-wrapper-inner">');

  for (const block of blocks.slice(1)) {
    const linkMatch = /<a\s+href="(https:\/\/www\.beckett\.com\/news\/([^"/]+)\/)"[^>]*>([^<]{5,120})<\/a>/.exec(block);
    if (!linkMatch) continue;

    const url   = linkMatch[1];
    const slug  = linkMatch[2];
    const title = linkMatch[3].trim();

    if (seen.has(slug)) continue;
    seen.add(slug);

    // Date
    const dateBlock = block.slice(0, 600);
    const dayM   = /<div class="day">(\w+ \d+)<\/div>/.exec(dateBlock);
    const monthM = /<div class="month">(\d{4})<\/div>/.exec(dateBlock);
    const altM   = dateRe.exec(dateBlock);

    let date = null;
    if (dayM && monthM) {
      date = new Date(`${dayM[1]}, ${monthM[1]}`);
    } else if (altM) {
      date = new Date(altM[1]);
    }

    results.push({ slug, url, title, date });
  }

  return results;
}

// ─── Filtre les articles "collection" récents ─────────────────────────────────
function isCollectionArticle(title) {
  // Doit commencer par une année ex. "2025-26 Topps..." ou "2026 Panini..."
  return /^20\d{2}(-\d{2})?\s+\w/.test(title.trim());
}

function isRecentEnough(date, daysBack) {
  if (!date || isNaN(date.getTime())) return true; // date inconnue → inclure par sécurité
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  return date >= cutoff;
}

// ─── Parse le HTML d'un article Beckett → card_types ─────────────────────────
// Structure Beckett : tabs advgb avec boutons Base / Autographs / Inserts / Memorabilia
// Le contenu de chaque tab est dans une div avec class "advgb-tab-{uid}-{index} advgb-tab-body"
// Les sections à l'intérieur sont en <strong> gras (titres) puis listes de joueurs
function parseChecklistHtml(html) {
  const cardTypes = [];

  // ─ 1. Extraire les noms de tabs dans l'ordre
  const tabButtonRe = /<button[^>]+class="advgb-tab-button"[^>]*>[\s\S]*?<strong>(.*?)<\/strong>/gi;
  const tabNames    = [];
  let m;
  while ((m = tabButtonRe.exec(html)) !== null) {
    tabNames.push(m[1].trim().toUpperCase());
  }

  if (tabNames.length === 0) {
    // Pas de tabs → essayer de parser sections <strong> directement
    return parseSimpleChecklist(html);
  }

  // ─ 2. Extraire les corps de tabs dans l'ordre
  // Chaque tab body : class="advgb-tab-{uid}-{idx} advgb-tab-body"
  const tabBodyRe = /class="[^"]*advgb-tab-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*advgb-tab-body|<\/div>)/gi;
  const tabBodies = [];
  while ((m = tabBodyRe.exec(html)) !== null) {
    tabBodies.push(m[1]);
  }

  // ─ 3. Pour chaque tab, extraire les noms de sections
  const tabMap = {
    'BASE':        'BASE',
    'AUTOGRAPHS':  'AUTOGRAPH',
    'AUTOGRAPH':   'AUTOGRAPH',
    'MEMORABILIA': 'RELIC',
    'RELICS':      'RELIC',
    'RELIC':       'RELIC',
    'INSERTS':     'INSERT',
    'INSERT':      'INSERT',
  };

  tabNames.forEach((tabName, idx) => {
    const category = tabMap[tabName];
    if (!category || !tabBodies[idx]) return;

    const body = tabBodies[idx];

    // Sections = textes en <strong> qui ne ressemblent pas à un nom de joueur
    // (longueur 3-60 chars, pas de virgule au milieu, pas de numéro de carte type "BS-1")
    const strongRe = /<strong>(.*?)<\/strong>/gi;
    const sections = [];

    while ((m = strongRe.exec(body)) !== null) {
      const txt = m[1].replace(/<[^>]+>/g, '').trim();
      // Filtrer : nom de section plausible
      if (
        txt.length >= 3 &&
        txt.length <= 80 &&
        !/^\d+$/.test(txt) &&               // pas uniquement un chiffre
        !/^[A-Z]{2}-\d/.test(txt) &&         // pas un code de carte comme "BS-1"
        !txt.includes('Checklist') &&         // pas "Base Set Checklist"
        !txt.includes('checklist') &&
        !txt.includes('download') &&
        !txt.includes('Download')
      ) {
        sections.push(txt.toUpperCase().replace(/\s+/g, ' '));
      }
    }

    // Si aucune section strong trouvée, le tab lui-même est une carte de base
    if (sections.length === 0) {
      cardTypes.push(category);
    } else {
      for (const sec of sections) {
        // Éviter les duplications
        const ct = sec === category ? category : `${category} / ${sec}`;
        if (!cardTypes.includes(ct)) cardTypes.push(ct);
      }
    }

    // Ajouter aussi BASE si le tab est BASE et qu'on a des sections
    if (category === 'BASE' && sections.length > 0 && !cardTypes.includes('BASE')) {
      cardTypes.unshift('BASE');
    }
  });

  // ─ 4. Détecter les parallèles depuis le HTML (patterns courants)
  extractParallels(html, cardTypes);

  return cardTypes;
}

// ─── Parser de secours si pas de tabs advgb ───────────────────────────────────
function parseSimpleChecklist(html) {
  const cardTypes = [];
  const CAT_KEYWORDS = {
    'BASE': /\bbase\s+set\b|\bbase\s+cards?\b/i,
    'INSERT': /\binserts?\b|\bshort\s+prints?\b|\bsp\b/i,
    'AUTOGRAPH': /\bautographs?\b|\bautos?\b/i,
    'RELIC': /\brelics?\b|\bmemorabilia\b|\bpatch\b/i,
  };

  for (const [cat, re] of Object.entries(CAT_KEYWORDS)) {
    if (re.test(html)) cardTypes.push(cat);
  }

  return cardTypes.length > 0 ? cardTypes : ['BASE'];
}

// ─── Extrait les parallèles typiques depuis le HTML ───────────────────────────
function extractParallels(html, cardTypes) {
  // Parallèles courants dans le texte Beckett (numérotations, couleurs)
  const parallelRe = /(?:Parallel|parallel|PARALLEL)[^\n<]{0,200}/g;
  const numberRe   = /\/(\d{1,4})\b/g;
  const colorRe    = /\b(Gold|Silver|Red|Blue|Green|Orange|Purple|Black|White|Aqua|Pink|Bronze|Platinum|Rainbow|Holo|Refractor|Chrome|Prizm|Superfractor)\b/gi;

  const parallelMatches = html.match(parallelRe) || [];
  const colors = new Set();
  const numbers = new Set();

  for (const block of parallelMatches) {
    let cm;
    while ((cm = colorRe.exec(block)) !== null) colors.add(cm[1].toUpperCase());
    while ((cm = numberRe.exec(block)) !== null) numbers.add(cm[1]);
  }

  // Chercher aussi les numérotations dans tout le texte
  const allNumbered = html.match(/\/(\d{1,4})\b/g) || [];
  const uniqueNums = [...new Set(allNumbered.map(n => n.replace('/', '')))].filter(n => parseInt(n) <= 500);

  if (colors.size > 0 || uniqueNums.length > 0) {
    // Ajouter quelques parallèles représentatifs s'ils ne sont pas déjà là
    for (const color of [...colors].slice(0, 6)) {
      const ct = `PARALLEL / ${color}`;
      if (!cardTypes.includes(ct)) cardTypes.push(ct);
    }
    for (const num of uniqueNums.slice(0, 5)) {
      const ct = `PARALLEL / /${num}`;
      if (!cardTypes.includes(ct)) cardTypes.push(ct);
    }
  }
}

// ─── Extraire le lien XLSX depuis la page ────────────────────────────────────
function extractXlsxUrl(html) {
  const m = /href="(https:\/\/img\.beckett\.com\/[^"]+\.xlsx)"/.exec(html);
  return m ? m[1] : null;
}

// ─── Télécharger et parser un XLSX Beckett → subsets avec joueurs ─────────────
async function parseXlsxUrl(xlsxUrl) {
  if (!XLSX) return null;
  try {
    const res = await fetch(xlsxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.beckett.com/' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });

    const sheetCategoryMap = {
      'Base':'BASE', 'Autographs':'AUTOGRAPH', 'Autograph':'AUTOGRAPH',
      'Inserts':'INSERT', 'Insert':'INSERT',
      'Memorabilia':'RELIC', 'Relics':'RELIC', 'Relic':'RELIC',
    };

    const subsets = [];

    for (const sheetName of wb.SheetNames) {
      const category = sheetCategoryMap[sheetName] || sheetName.toUpperCase();
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

      let currentSection = null, currentParallels = [], currentPlayers = [], inParallels = false, cardCount = null;

      const flush = () => {
        if (currentSection && currentPlayers.length > 0) {
          subsets.push({ subset: category, section: currentSection, card_count: cardCount, parallels: [...currentParallels], players: [...currentPlayers] });
        }
        currentSection = null; currentParallels = []; currentPlayers = []; inParallels = false; cardCount = null;
      };

      for (const row of rows) {
        if (!row || row.length === 0) continue;
        const c0 = String(row[0] || '').trim();
        const c1 = String(row[1] || '').trim();

        if (row.length >= 2 && c1 && c0.endsWith(',')) {
          if (!inParallels) currentPlayers.push({ name: c0.slice(0, -1).trim(), club: c1 });
          continue;
        }
        if (/^\d+ cards?$/i.test(c0)) { cardCount = parseInt(c0); inParallels = false; continue; }
        if (c0.toLowerCase() === 'parallels') { inParallels = true; continue; }
        if (inParallels && /\/\d+/.test(c0)) { currentParallels.push(c0); continue; }
        if (c0 && row.length === 1 && !/^\d/.test(c0)) { flush(); currentSection = c0; inParallels = false; }
      }
      flush();
    }

    return subsets.length > 0 ? subsets : null;
  } catch (e) {
    return null;
  }
}

// ─── Appel Gemini pour parser le titre de l'article → métadonnées ─────────────
// Plus simple et moins coûteux que parser tout le HTML
async function parseTitleWithGemini(title, pageUrl) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY manquant');

  const prompt = `Tu es un expert en cartes de sport (trading cards).

Extrait les métadonnées de ce titre d'article Beckett :
"${title}"
URL : ${pageUrl}

Règles :
- "publisher"       : éditeur EN MAJUSCULES (TOPPS, PANINI, FUTERA, UPPER DECK, LEAF, SP, DONRUSS...)
- "serie"           : nom court de la série EN MAJUSCULES, sans le publisher ni la ligue
                      Ex : "CHROME", "FINEST", "FLAGSHIP", "PRIZM", "SELECT", "OBSIDIAN", "WINNERS COLLECTION"
- "full_serie_name" : avec ligue/compétition si présent en MAJUSCULES
                      Ex : "CHROME / PREMIER LEAGUE", "FINEST / UEFA CLUB COMPETITIONS"
- "year"            : entier — "2025-26" → 2026, "2026-27" → 2027, "2026" → 2026
- "sport"           : "SOCCER", "BASKETBALL", "BASEBALL", "NHL", "NFL", "TENNIS"
- "folder_id"       : kebab-case unique, format {publisher}-{serie}-{ligue?}-{year}-{sport}-cards
                      Ex : "topps-premier-league-2027-soccer-cards"
                           "panini-obsidian-2026-soccer-cards"
- "visual_hints"    : description visuelle courte (2 phrases) pour reconnaître les cartes

Réponds UNIQUEMENT avec un JSON valide :
{
  "publisher": "TOPPS",
  "serie": "PREMIER LEAGUE",
  "full_serie_name": "PREMIER LEAGUE",
  "year": 2027,
  "sport": "SOCCER",
  "folder_id": "topps-premier-league-2027-soccer-cards",
  "visual_hints": "Design classique Topps, logo Premier League..."
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse Gemini invalide');

  return JSON.parse(jsonMatch[0]);
}

// ─── Ajoute la collection dans les 4 fichiers JSON ───────────────────────────
function addToAllFiles(meta, cardTypes, beckettUrl, index, catalog, sets, xlsxSubsets) {
  const { folder_id, publisher, serie, full_serie_name, year, sport, visual_hints } = meta;

  // 1. Dossier + collection.json
  const folderPath = path.join(COL_DIR, folder_id);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  // Subsets : depuis XLSX si disponible, sinon depuis card_types HTML
  const subsets = xlsxSubsets || cardTypes.map(ct => {
    const sep = ct.indexOf(' / ');
    return {
      subset:      sep >= 0 ? ct.slice(0, sep) : ct,
      section:     sep >= 0 ? ct.slice(sep + 3) : null,
      description: null,
      players:     [],
      parallels:   [],
    };
  });

  saveJson(path.join(folderPath, 'collection.json'), {
    collection_id: folder_id,
    source_url:    beckettUrl,
    xlsx_parsed:   !!xlsxSubsets,
    fiche: { annee: String(year), editeur: publisher, serie: full_serie_name || serie, sport },
    subsets,
  });

  // 2. index.json
  if (!index.collections.find(c => c.id === folder_id)) {
    index.collections.push({
      id:           folder_id,
      editeur:      publisher,
      serie:        full_serie_name || serie,
      annee:        String(year),
      total_cartes: 0,
      total_images: 0,
      path:         `${folder_id}/collection.json`,
      beckett_url:  beckettUrl,
    });
  }

  // 3. collections_catalog.json — on garde le nom COMPLET (avec ligue/compétition)
  // pour que deux produits d'une même gamme (ex: SELECT / SERIE A vs SELECT / LA LIGA)
  // ne soient pas indiscernables dans la liste.
  if (!catalog.find(c => c.folder === folder_id)) {
    catalog.push({
      folder:       folder_id,
      year,
      annee:        String(year),
      editeur:      publisher,
      publisher,
      serie:        full_serie_name || serie,
      card_types:   cardTypes,
      beckett_url:  beckettUrl,
    });
  }

  // 4. sets.json — ajouter la série si nouvelle
  const sportKey = { SOCCER:'football_soccer', BASKETBALL:'basketball', BASEBALL:'baseball',
                     NFL:'nfl', NHL:'nhl', TENNIS:'tennis', F1:'f1' }[sport] || 'football_soccer';
  const brand    = sets.brands.find(b => b.name.toUpperCase() === publisher);
  if (brand) {
    if (!brand.sports)           brand.sports           = {};
    if (!brand.sports[sportKey]) brand.sports[sportKey] = [];
    const exists = brand.sports[sportKey].find(s => s.name.toUpperCase() === serie.toUpperCase());
    if (!exists) {
      const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      const serieCap = serie.split(' ').map(cap).join(' ');
      brand.sports[sportKey].push({
        name:           serieCap,
        full_name:      `${cap(publisher)} ${serieCap}`,
        visual_hints:   visual_hints || '',
        common_subsets: cardTypes.filter(ct => !ct.startsWith('PARALLEL')),
        ebay_keywords:  [`${cap(publisher)} ${serieCap}`],
        ebay_template:  `{joueur} ${cap(publisher)} ${serieCap} {saison} {numero}`,
        notes:          `Ajouté automatiquement depuis ${beckettUrl}`,
      });
    }
  }

  console.log(`     ✓ ${folder_id} (${cardTypes.length} types)`);
  if (cardTypes.length > 0) {
    console.log(`       ${cardTypes.slice(0, 5).join(', ')}${cardTypes.length > 5 ? '...' : ''}`);
  }
}

// ─── Mode --init : marquer tous les articles actuels comme vus ────────────────
async function initTracked() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  INIT — Indexation des articles Beckett existants  ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  console.log(`📋 Fetch ${BECKETT_LIST}...`);

  const html  = await fetchPage(BECKETT_LIST);
  const items = parseCategoryPage(html);
  const slugs = items.map(i => i.slug);

  // Pages 2 et 3 aussi pour être complet
  for (let page = 2; page <= 3; page++) {
    try {
      const pageHtml = await fetchPage(`${BECKETT_LIST}page/${page}/`);
      const more     = parseCategoryPage(pageHtml);
      slugs.push(...more.map(i => i.slug));
      await sleep(1500);
    } catch {}
  }

  const unique = [...new Set(slugs)];
  saveJson(TRACKED_PATH, unique);
  console.log(`✅ ${unique.length} slugs sauvegardés dans _tracked_slugs.json`);
  console.log('   Le prochain run ne traitera que les nouveaux articles.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--init')) { await initTracked(); return; }

  const ALL_MODE = process.argv.includes('--all');

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Sync collections depuis Beckett Soccer         ║');
  console.log(`║   Mode : ${ALL_MODE ? 'COMPLET (--all)           ' : `Derniers ${DAYS_LOOKBACK} jours              `}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  const index   = loadJson(INDEX_PATH);
  const catalog = loadJson(CAT_PATH);
  const sets    = loadJson(SETS_PATH);
  let   tracked = fs.existsSync(TRACKED_PATH) ? loadJson(TRACKED_PATH) : [];
  const seenSet = new Set(tracked);

  // ── 1. Catégorie Beckett (avec pagination en mode --all) ─────────────────
  const allItems = [];

  if (ALL_MODE) {
    console.log('📋 Mode --all : récupération de toutes les pages Beckett...\n');
    let page    = 1;
    let empty   = false;
    const MAX_PAGES = 30; // sécurité

    const globalSeen = new Set();
    let consecutiveFails = 0;
    const MAX_CONSECUTIVE_FAILS = 3;
    while (!empty && page <= MAX_PAGES) {
      const url = page === 1 ? BECKETT_LIST : `${BECKETT_LIST}page/${page}/`;
      console.log(`   Page ${page} : ${url}`);
      try {
        const html  = await fetchPage(url);
        const items = parseCategoryPage(html);
        // Dédupliquer les slugs entre pages (featured articles répétés)
        const newItems = items.filter(i => !globalSeen.has(i.slug));
        if (newItems.length === 0 && items.length === 0) { empty = true; break; }
        newItems.forEach(i => globalSeen.add(i.slug));
        allItems.push(...newItems);
        consecutiveFails = 0;
        console.log(`   → ${newItems.length} nouveaux articles (total : ${allItems.length})`);
        page++;
        await sleep(2000);
      } catch (e) {
        consecutiveFails++;
        console.warn(`   ⚠ Page ${page} inaccessible (${consecutiveFails}/${MAX_CONSECUTIVE_FAILS}) : ${e.message}`);
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) { break; }
        page++;
        await sleep(5000); // attente plus longue avant de retenter
      }
    }
    console.log(`\n   ✓ ${allItems.length} articles collectés sur ${page - 1} page(s)\n`);
  } else {
    console.log(`📋 Fetch ${BECKETT_LIST}...`);
    const listHtml = await fetchPage(BECKETT_LIST);
    allItems.push(...parseCategoryPage(listHtml));
    console.log(`   ${allItems.length} articles trouvés\n`);
  }

  // ── 2. Filtrer ───────────────────────────────────────────────────────────
  const toProcess = allItems.filter(item => {
    if (!ALL_MODE && seenSet.has(item.slug)) return false;
    if (!isCollectionArticle(item.title)) return false;
    if (!ALL_MODE && !isRecentEnough(item.date, DAYS_LOOKBACK)) return false;
    return true;
  });

  console.log(`   → ${toProcess.length} nouvelles collections à traiter\n`);

  if (toProcess.length === 0) {
    console.log('✅ Aucune nouvelle collection cette semaine.');
    saveJson(TRACKED_PATH, [...seenSet, ...allItems.map(i => i.slug)]);
    return;
  }

  let added = 0, skipped = 0, errors = 0;

  // ── 3. Traiter chaque collection ─────────────────────────────────────────
  for (const item of toProcess) {
    console.log(`📦 "${item.title}"`);
    console.log(`   ${item.url}`);
    item.date && console.log(`   Date : ${item.date.toLocaleDateString('fr-FR')}`);

    try {
      // a. Fetch l'article
      const html = await fetchPage(item.url);

      if (html.length < 5000) {
        console.log('   ⚠ Page trop courte — skip\n');
        seenSet.add(item.slug);
        skipped++;
        continue;
      }

      // b. Lien XLSX
      const xlsxUrl = extractXlsxUrl(html);
      if (xlsxUrl) console.log(`   📥 XLSX : ${xlsxUrl.split('/').pop()}`);

      // c. Parser checklist HTML → card_types (fallback si pas de XLSX)
      const cardTypes = parseChecklistHtml(html);
      console.log(`   📋 ${cardTypes.length} card_types HTML extraits`);

      if (cardTypes.length === 0 && !xlsxUrl) {
        console.log('   ⚠ Aucune donnée trouvée — skip\n');
        skipped++;
        continue;
      }

      // d. Gemini pour les métadonnées (titre court → publisher/serie/year)
      console.log('   🤖 Gemini → métadonnées...');
      const meta = await parseTitleWithGemini(item.title, item.url);

      if (!meta.publisher || !meta.serie || !meta.year || !meta.folder_id) {
        console.log(`   ⚠ Métadonnées incomplètes : ${JSON.stringify(meta)} — skip\n`);
        skipped++;
        continue;
      }

      // e. Vérifier doublon par folder_id
      const alreadyIn = index.collections.some(c => c.id === meta.folder_id)
                     || catalog.some(c => c.folder === meta.folder_id);
      if (alreadyIn) {
        console.log(`   ℹ Déjà dans la BDD sous "${meta.folder_id}" — marqué comme vu\n`);
        seenSet.add(item.slug);
        continue;
      }

      // f. Télécharger + parser le XLSX si disponible
      let xlsxSubsets = null;
      if (xlsxUrl) {
        console.log('   📊 Parsing XLSX...');
        xlsxSubsets = await parseXlsxUrl(xlsxUrl);
        if (xlsxSubsets) console.log(`   ✓ ${xlsxSubsets.length} subsets avec joueurs`);
        else console.log('   ⚠ XLSX non parsé — fallback HTML');
      }

      // g. Ajouter dans les fichiers
      addToAllFiles(meta, cardTypes, item.url, index, catalog, sets, xlsxSubsets);
      seenSet.add(item.slug);
      added++;

    } catch (e) {
      console.error(`   ✗ Erreur : ${e.message}\n`);
      errors++;
    }

    console.log('');
    await sleep(DELAY_MS);
  }

  // ── 4. Sauvegarder ───────────────────────────────────────────────────────
  // Marquer aussi les anciens articles vus (pour ne pas les retraiter)
  for (const item of allItems) seenSet.add(item.slug);

  if (added > 0) {
    console.log('💾 Sauvegarde JSON...');
    saveJson(INDEX_PATH, index);
    saveJson(CAT_PATH,   catalog);
    saveJson(SETS_PATH,  sets);
    console.log('   ✓ index.json, collections_catalog.json, sets.json');
  }
  saveJson(TRACKED_PATH, [...seenSet]);

  console.log('\n╔══════════════════════════════╗');
  console.log(`║ Ajoutées  : ${String(added).padEnd(18)}║`);
  console.log(`║ Ignorées  : ${String(skipped).padEnd(18)}║`);
  console.log(`║ Erreurs   : ${String(errors).padEnd(18)}║`);
  console.log('╚══════════════════════════════╝');

  if (errors > 0) process.exit(1);
}

main().catch(e => {
  console.error('\n💥', e.message);
  process.exit(1);
});
