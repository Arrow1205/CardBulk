/**
 * Formate l'année pour une recherche eBay selon le sport et la marque.
 *
 * Règles :
 * - TENNIS, F1, NFL, BASEBALL → année seule (2025, 2026)
 * - SOCCER + Topps → année seule (Topps nomme ses produits "2026 Topps Chrome", pas "2025-26")
 * - SOCCER + autres marques (Panini, Futera…) → format saison (2025-26)
 * - BASKETBALL, NHL → format saison (2024-25)
 */
export function formatYearForEbay(year: string | number, sport: string, brand: string): string {
  const y = String(year || '');
  if (!y || !/^\d{4}$/.test(y)) return y;

  const s = (sport || '').toUpperCase();
  const b = (brand || '').toLowerCase();

  // Sports toujours en année seule
  if (['TENNIS', 'BASEBALL', 'F1', 'NFL'].includes(s)) return y;

  // Topps soccer → année seule
  if (s === 'SOCCER' && b.includes('topps')) return y;

  // Soccer (autres marques), Basketball, NHL → format saison
  if (['SOCCER', 'BASKETBALL', 'NHL'].includes(s)) {
    const yearNum = parseInt(y, 10);
    return `${yearNum - 1}-${y.slice(-2)}`;
  }

  return y;
}
