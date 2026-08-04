// Partagé entre /api/price-update et /api/scout-daily
export async function fetchSoldPrices(keywords: string): Promise<number[]> {
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const ebayUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(keywords)}&LH_Sold=1&LH_Complete=1&_ipg=20`;
  const fetchUrl = scraperApiKey
    ? `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(ebayUrl)}&country_code=fr`
    : ebayUrl;

  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  const html = await res.text();
  if (html.length < 50000) return [];
  if (html.includes('0 résultat') || html.includes('0 article') || html.includes('"totalEntries":0')) return [];

  const prices: number[] = [];
  const cardBlocks = html.split('s-card__attribute-row');
  if (cardBlocks.length > 1) {
    for (const block of cardBlocks.slice(1)) {
      const m = block.match(/s-card__price[^>]*>([\d\s]+[,.][\d]{2})\s*EUR/);
      if (!m) continue;
      const p = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }
  if (prices.length === 0) {
    for (const m of Array.from(html.matchAll(/s-card__price[^>]*>([\d\s]+[,.][\d]{2})\s*EUR/g))) {
      const p = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }
  return prices;
}

export function medianPrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? Math.round(sorted[mid] * 100) / 100
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}
