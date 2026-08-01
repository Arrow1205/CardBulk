// Matching checklist ↔ cartes possédées — partagé entre l'API (calcul serveur)
// et le composant collection (vue détail, checkmarks joueur par joueur).

export const normText = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// La colonne "variation" d'une carte est saisie au format "TYPE - RARETÉ" ou "TYPE / RARETÉ"
// (ex: "INSERT - WONDERKIDS", "AUTOGRAPH - BASE VARIATION", "BASE - SP").
export function splitVariation(variation: string): { type: string; name: string } {
  if (!variation) return { type: '', name: '' };
  const parts = variation.split(/\s*[-/]\s*/).map(p => p.trim()).filter(Boolean);
  return { type: parts[0] || '', name: parts.slice(1).join(' ') };
}

const SUBSET_CAT_KEYWORDS: Record<string, string[]> = {
  AUTOGRAPH: ['AUTOGRAPH', 'AUTO'],
  RELIC:     ['RELIC', 'MEMORABILIA', 'JERSEY', 'SWATCH', 'PATCH'],
  INSERT:    ['INSERT'],
  PARALLEL:  ['PARALLEL', 'REFRACTOR'],
};

export function detectSubsetCat(s: string): string | null {
  const u = (s || '').toUpperCase();
  if (u === 'BASE') return 'BASE';
  for (const [cat, kws] of Object.entries(SUBSET_CAT_KEYWORDS)) {
    if (kws.some(k => u.includes(k))) return cat;
  }
  return null;
}

// Confronte le type de carte attendu (subset + section du checklist) aux specs de la carte possédée
// (flags is_auto/is_patch + variation découpée). On ne bloque que quand on peut détecter la
// catégorie avec confiance des deux côtés ; sinon (subsets "produit" type PRIZM, SELECT...) on laisse passer.
export function cardMatchesSubset(subset: string | undefined, section: string | undefined, card: any): boolean {
  const subsetCat = detectSubsetCat(subset || '');
  const { type: cardType, name: cardName } = splitVariation(card.variation || '');
  const cardCat = detectSubsetCat(cardType)
    || (card.is_auto ? 'AUTOGRAPH' : null)
    || (card.is_patch ? 'RELIC' : null);

  if (subsetCat === 'AUTOGRAPH' && !card.is_auto) return false;
  if (subsetCat === 'RELIC' && !card.is_patch) return false;
  if (subsetCat === 'BASE' && (card.is_auto || card.is_patch)) return false;
  if (subsetCat && cardCat && subsetCat !== cardCat) return false;

  if ((subsetCat === 'INSERT' || subsetCat === 'PARALLEL' || !subsetCat) && cardName) {
    const nameNorm    = normText(cardName);
    const sectionNorm = normText(section || '');
    if (nameNorm.length >= 3 && sectionNorm.length >= 3) {
      if (!(nameNorm.includes(sectionNorm) || sectionNorm.includes(nameNorm))) return false;
    }
  }
  return true;
}

// Retrouve la carte possédée correspondant à une ligne de checklist (joueur + subset/section),
// pour une collection identifiée par éditeur/série/année.
export function findMatchingCard(
  playerName: string,
  subset: string | undefined,
  section: string | undefined,
  colYear: string,
  colPub: string,
  colSerie: string,
  cards: any[]
): any | null {
  const normPlayer = normText(playerName);
  if (normPlayer.length < 2) return null;
  return cards.find(card => {
    const cardFull = normText(`${card.firstname || ''} ${card.lastname || ''}`);
    const cardRev  = normText(`${card.lastname || ''} ${card.firstname || ''}`);
    if (cardFull.length < 2) return false;
    const nameMatch = cardFull === normPlayer || cardRev === normPlayer
      || (cardFull.length >= 4 && normPlayer.includes(cardFull))
      || (normPlayer.length >= 4 && cardFull.includes(normPlayer));
    if (!nameMatch) return false;

    const cardYear = String(card.year || '');
    const yearMatch = !colYear || cardYear === colYear
      || (colYear.length === 4 && cardYear.includes(colYear))
      || (cardYear.length === 4 && colYear.includes(cardYear));

    const cardBrand = normText(card.brand || '');
    const cardSerie = normText(card.series || '');
    const brandMatch = colPub.length > 0 && cardBrand.length > 0
      && (cardBrand.includes(colPub) || colPub.includes(cardBrand));
    const serieMatch = colSerie.length > 0 && cardSerie.length > 0
      && (cardSerie.includes(colSerie) || colSerie.includes(cardSerie));

    return yearMatch && brandMatch && serieMatch && cardMatchesSubset(subset, section, card);
  }) || null;
}

// Empreinte stable d'une collection de cartes (pour invalider un cache quand elle change).
export function cardsSignature(cards: any[]): string {
  return cards.map((c: any) => `${c.id}:${c.updated_at}`).sort().join('|');
}

// Dérive un nom lisible depuis un collection_id/folder en retirant le préfixe de marque
// (déjà affiché ailleurs — éditeur), sans y toucher pour le reste.
// Ex: "futera-fans-selection-borussia-monchengladbach-2025-26" -> "fans selection borussia monchengladbach 2025-26"
const KNOWN_BRANDS = new Set(['futera', 'panini', 'topps', 'donruss']);

export function formatCollectionIdWithoutBrand(collectionId: string): string {
  const parts = collectionId.split('-');
  const start = parts.length > 0 && KNOWN_BRANDS.has(parts[0].toLowerCase()) ? 1 : 0;
  const rest = parts.slice(start);

  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const cur = rest[i];
    const next = rest[i + 1];
    // Recolle un couple "AAAA" + "AA" (ex: 2025 + 26) en "AAAA-AA" pour garder le format saison
    if (/^\d{4}$/.test(cur) && next && /^\d{2}$/.test(next)) {
      out.push(`${cur}-${next}`);
      i++;
    } else {
      out.push(cur);
    }
  }
  return out.join(' ');
}
