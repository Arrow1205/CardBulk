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
  // Doit être vérifié AVANT AUTOGRAPH/RELIC (sinon "A+R"/"AUTOGRAPH RELIC" matcherait AUTOGRAPH en premier).
  AUTOGRAPH_RELIC: ['A+R', 'AUTOGRAPH RELIC', 'AUTOGRAPHED RELIC', 'AUTO RELIC', 'AUTO/RELIC', 'AUTOGRAPH MEMORABILIA', 'AUTOGRAPHED MEMORABILIA'],
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
    || (card.is_auto && card.is_patch ? 'AUTOGRAPH_RELIC' : null)
    || (card.is_auto ? 'AUTOGRAPH' : null)
    || (card.is_patch ? 'RELIC' : null);

  if (subsetCat === 'AUTOGRAPH_RELIC' && !(card.is_auto && card.is_patch)) return false;
  if (subsetCat === 'AUTOGRAPH' && !card.is_auto) return false;
  if (subsetCat === 'RELIC' && !card.is_patch) return false;
  if (subsetCat === 'BASE' && (card.is_auto || card.is_patch)) return false;
  if (subsetCat && cardCat && subsetCat !== cardCat) return false;

  // Si la variation de la carte précise un nom de rareté (ex: "WONDERKIDS", "FUSION"),
  // il doit correspondre EXACTEMENT à la section du checklist — une simple sous-chaîne
  // ferait matcher "PRIZED FOOTBALLERS" avec "PRIZED FOOTBALLERS FUSION" par erreur,
  // alors que ce sont deux variantes distinctes. S'applique à toutes les catégories
  // (pas seulement INSERT/PARALLEL) dès qu'un nom précis est renseigné des deux côtés.
  if (cardName) {
    const nameNorm    = normText(cardName);
    const sectionNorm = normText(section || '');
    if (nameNorm.length >= 3 && sectionNorm.length >= 3 && nameNorm !== sectionNorm) return false;
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
  cards: any[],
  colSport?: string
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

    if (colSport && card.sport && normText(card.sport) !== normText(colSport)) return false;
    return yearMatch && brandMatch && serieMatch && cardMatchesSubset(subset, section, card);
  }) || null;
}

// Empreinte stable d'une collection de cartes (pour invalider un cache quand elle change).
export function cardsSignature(cards: any[]): string {
  return cards.map((c: any) => `${c.id}:${c.updated_at}`).sort().join('|');
}

// Dérive un nom lisible et simplifié depuis un collection_id/folder, pour l'affichage
// sur la page Checklist : retire la marque (déjà affichée ailleurs — éditeur), les
// années/saisons, les mois, et le bruit de scraping ("soccer cards", "fiche signalétique
// avec check-list", "précommande en...", etc.). Garde tout le reste, y compris le pays.
// Ex: "topps-match-attax-bundesliga-allemagne-2023-octobre-soccer-cards" -> "Match Attax Bundesliga Allemagne"
const KNOWN_BRANDS = new Set(['futera', 'panini', 'topps', 'donruss']);

const MONTHS_FR = new Set([
  'janvier', 'fevrier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'aout', 'août', 'septembre', 'octobre', 'novembre', 'decembre', 'décembre',
]);

const JUNK_WORDS = new Set([
  'soccer', 'cards', 'card', 'trading',
  'fiche', 'signaletique', 'signalétique', 'avec', 'check', 'list', 'li',
  'coup', 'il', 'oeil', 'mise', 'jour', 'precommande', 'précommande', 'en',
  'd', 'l',
]);

export function formatCollectionIdWithoutBrand(collectionId: string): string {
  let parts = collectionId.split('-');
  if (parts.length > 0 && KNOWN_BRANDS.has(parts[0].toLowerCase())) parts = parts.slice(1);

  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const low = raw.toLowerCase();

    if (MONTHS_FR.has(low) || JUNK_WORDS.has(low)) continue;

    // Année 4 chiffres (1900-2099) : on la retire, avec son éventuel suffixe de saison
    // à 2 chiffres qui suit immédiatement (ex: "2025" + "26" -> les deux disparaissent).
    if (/^(19|20)\d{2}$/.test(raw)) {
      const next = parts[i + 1];
      if (next && /^\d{2}$/.test(next)) i++;
      continue;
    }

    // Saison écrite en format court ("24-25") : deux nombres à 2 chiffres consécutifs.
    if (/^\d{2}$/.test(raw)) {
      const next = parts[i + 1];
      if (next && /^\d{2}$/.test(next)) {
        const a = parseInt(raw, 10);
        const b = parseInt(next, 10);
        if (b === (a + 1) % 100) { i++; continue; }
      }
    }

    out.push(raw);
  }

  return out
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
