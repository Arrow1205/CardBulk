#!/usr/bin/env node
/**
 * match-cards-to-checklists.js
 *
 * Pour chaque carte déjà en base, cherche une collection connue (table `collections`
 * globale + `manual_collections` importées) qui correspond : même éditeur + même série
 * (approx.) + même année + même subset/section + le joueur présent dans le checklist
 * avec le bon type de carte (auto/relic/insert...).
 *
 * - Si un match fiable est trouvé : la carte est mise à jour avec les valeurs canoniques
 *   du checklist (brand/series/variation) + collection_folder (référence exacte, colonne
 *   à ajouter au préalable — voir SQL fourni), pour ne plus jamais dépendre du matching
 *   texte flou sur cette carte à l'avenir.
 * - Sinon : la carte est listée dans un rapport JSON (joueur, club, collection actuelle)
 *   pour correction manuelle.
 *
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/match-cards-to-checklists.js [--apply] [--user=<uuid>]
 *
 * Sans --apply : dry-run, affiche le rapport sans rien écrire en base.
 * --user=<uuid> : ne traite que les cartes de cet utilisateur (sinon : toutes les cartes).
 */

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find(a => a.startsWith('--user='));
const USER_ID = userArg ? userArg.split('=')[1] : null;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Matching (miroir de lib/checklistMatching.ts, en JS pur pour ce script Node) ───────────

function normText(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function splitVariation(variation) {
  if (!variation) return { type: '', name: '' };
  const parts = variation.split(/\s*[-/]\s*/).map(p => p.trim()).filter(Boolean);
  return { type: parts[0] || '', name: parts.slice(1).join(' ') };
}

const SUBSET_CAT_KEYWORDS = {
  AUTOGRAPH_RELIC: ['A+R', 'AUTOGRAPH RELIC', 'AUTOGRAPHED RELIC', 'AUTO RELIC', 'AUTO/RELIC', 'AUTOGRAPH MEMORABILIA', 'AUTOGRAPHED MEMORABILIA'],
  AUTOGRAPH: ['AUTOGRAPH', 'AUTO'],
  RELIC:     ['RELIC', 'MEMORABILIA', 'JERSEY', 'SWATCH', 'PATCH'],
  INSERT:    ['INSERT'],
  PARALLEL:  ['PARALLEL', 'REFRACTOR'],
};

function detectSubsetCat(s) {
  const u = (s || '').toUpperCase();
  if (u === 'BASE') return 'BASE';
  for (const [cat, kws] of Object.entries(SUBSET_CAT_KEYWORDS)) {
    if (kws.some(k => u.includes(k))) return cat;
  }
  return null;
}

function cardMatchesSubset(subset, section, card) {
  const subsetCat = detectSubsetCat(subset || '');
  const { type: cardType, name: cardName } = splitVariation(card.variation || '');
  const cardCat = detectSubsetCat(cardType)
    || (card.is_auto && card.is_patch ? 'AUTOGRAPH_RELIC' : null)
    || (card.is_auto ? 'AUTOGRAPH' : null)
    || (card.is_patch ? 'RELIC' : null);

  if (subsetCat === 'AUTOGRAPH_RELIC' && !(card.is_auto && card.is_patch)) return false;
  if (subsetCat === 'AUTOGRAPH' && !card.is_auto) return false;
  if (subsetCat === 'RELIC' && !card.is_patch) return false;
  if (subsetCat === 'BASE' && (card.is_auto || card.is_patch)) return false;
  if (subsetCat && cardCat && subsetCat !== cardCat) return false;

  if (cardName) {
    const nameNorm    = normText(cardName);
    const sectionNorm = normText(section || '');
    if (nameNorm.length >= 3 && sectionNorm.length >= 3 && nameNorm !== sectionNorm) return false;
  }
  return true;
}

function playerNameMatch(cardFirstname, cardLastname, joueur) {
  const cardFull   = normText(`${cardFirstname || ''} ${cardLastname || ''}`);
  const cardRev    = normText(`${cardLastname || ''} ${cardFirstname || ''}`);
  const normPlayer = normText(joueur || '');
  if (cardFull.length < 2 || normPlayer.length < 2) return false;
  return cardFull === normPlayer || cardRev === normPlayer
    || (cardFull.length >= 4 && normPlayer.includes(cardFull))
    || (normPlayer.length >= 4 && cardFull.includes(normPlayer));
}

// ─── Script principal ────────────────────────────────────────────────────────

async function main() {
  console.log(APPLY
    ? '🔧 Mode APPLY — les cartes matchées seront mises à jour en base.\n'
    : '👀 Mode DRY-RUN — aucune écriture. Relance avec --apply pour appliquer les changements.\n');

  let cardsQuery = supabase
    .from('cards')
    .select('id, user_id, firstname, lastname, club_name, brand, series, variation, year, is_auto, is_patch, is_wishlist')
    .eq('is_wishlist', false);
  if (USER_ID) cardsQuery = cardsQuery.eq('user_id', USER_ID);

  const { data: cards, error: cardsErr } = await cardsQuery;
  if (cardsErr) throw cardsErr;

  const { data: sharedRows, error: sharedErr } = await supabase.from('collections').select('folder, catalog, data');
  if (sharedErr) throw sharedErr;
  const { data: manualRows, error: manualErr } = await supabase.from('manual_collections').select('folder, catalog, data');
  if (manualErr) throw manualErr;

  const allCollections = [...(sharedRows || []), ...(manualRows || [])];
  console.log(`📦 ${cards.length} carte(s) à analyser, ${allCollections.length} collection(s) disponible(s).\n`);

  let toUpdate = 0, alreadyOk = 0;
  const unmatched = [];
  const updates = [];

  for (const card of cards) {
    const cardBrand = normText(card.brand || '');
    const cardSerie = normText(card.series || '');
    const cardYear  = String(card.year || '');

    if (!cardBrand || !cardSerie) {
      unmatched.push({
        joueur: `${card.firstname || ''} ${card.lastname || ''}`.trim(),
        club: card.club_name || '',
        brand: card.brand, series: card.series, variation: card.variation, year: card.year,
        id: card.id,
        raison: 'brand ou series manquant sur la carte',
      });
      continue;
    }

    // Collections candidates : même éditeur + même série (approché) + même année
    const candidates = allCollections.filter(row => {
      const col = { folder: row.folder, ...row.catalog };
      const colPub   = normText(col.editeur || col.publisher || '');
      const colSerie = normText(col.serie || '');
      const colYear  = String(col.annee || col.year || '').match(/\d{4}/)?.[0] || '';
      const yearMatch  = !colYear || cardYear === colYear;
      const brandMatch = colPub.length > 0 && cardBrand.length > 0 && (cardBrand.includes(colPub) || colPub.includes(cardBrand));
      const serieMatch = colSerie.length > 0 && cardSerie.length > 0 && (cardSerie.includes(colSerie) || colSerie.includes(cardSerie));
      return yearMatch && brandMatch && serieMatch;
    });

    // Parmi les candidates, on vérifie que le joueur ET le subset/section correspondent réellement
    let found = null;
    for (const row of candidates) {
      const checklist = row.data?.checklist || [];
      for (const item of checklist) {
        if (!playerNameMatch(card.firstname, card.lastname, item.joueur)) continue;
        if (!cardMatchesSubset(item.subset, item.section, card)) continue;
        found = { row, item };
        break;
      }
      if (found) break;
    }

    if (found) {
      const col = { folder: found.row.folder, ...found.row.catalog };
      const canonicalBrand     = col.editeur || col.publisher || card.brand;
      const canonicalSerie     = col.serie || card.series;
      const canonicalVariation = (found.item.section && found.item.section !== found.item.subset)
        ? `${found.item.subset} - ${found.item.section}`
        : found.item.subset;

      const needsUpdate = card.brand !== canonicalBrand || card.series !== canonicalSerie || card.variation !== canonicalVariation;
      if (needsUpdate) {
        toUpdate++;
        updates.push({
          id: card.id,
          brand: canonicalBrand,
          series: canonicalSerie,
          variation: canonicalVariation,
          collection_folder: found.row.folder,
          _debug: `${card.firstname} ${card.lastname} — "${card.brand}/${card.series}/${card.variation}" -> "${canonicalBrand}/${canonicalSerie}/${canonicalVariation}" (${found.row.folder})`,
        });
      } else {
        alreadyOk++;
      }
    } else {
      unmatched.push({
        joueur: `${card.firstname || ''} ${card.lastname || ''}`.trim(),
        club: card.club_name || '',
        brand: card.brand, series: card.series, variation: card.variation, year: card.year,
        id: card.id,
        raison: 'aucune checklist correspondante trouvée',
      });
    }
  }

  console.log(`✅ ${toUpdate} carte(s) à mettre à jour (matchées avec une checklist).`);
  console.log(`✔️  ${alreadyOk} carte(s) déjà à jour.`);
  console.log(`❓ ${unmatched.length} carte(s) sans correspondance trouvée.\n`);

  if (updates.length > 0) {
    console.log('--- Détail des mises à jour ---');
    updates.forEach(u => console.log('  ' + u._debug));
    console.log('');
  }

  const reportPath = path.join(__dirname, '..', 'unmatched-cards-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(unmatched, null, 2), 'utf-8');
  console.log(`📄 Rapport des cartes non matchées écrit dans : ${reportPath}`);

  if (updates.length > 0) {
    if (APPLY) {
      console.log('\n💾 Application des mises à jour...');
      let ok = 0, ko = 0;
      for (const u of updates) {
        const { id, _debug, ...fields } = u;
        const { error } = await supabase.from('cards').update(fields).eq('id', id);
        if (error) { console.error(`   ✗ ${id} : ${error.message}`); ko++; }
        else ok++;
      }
      console.log(`✅ Terminé : ${ok} mises à jour appliquées, ${ko} erreurs.`);
    } else {
      console.log('\nℹ️  Relance avec --apply pour appliquer ces mises à jour en base.');
    }
  }
}

main().catch(e => {
  console.error('\n💥', e.message);
  process.exit(1);
});
