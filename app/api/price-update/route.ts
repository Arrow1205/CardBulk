import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchSoldPrices(keywords: string): Promise<number[]> {
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const ebayUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(keywords)}&LH_Sold=1&LH_Complete=1&_ipg=20`;

  const fetchUrl = scraperApiKey
    ? `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(ebayUrl)}&country_code=fr&premium=true`
    : ebayUrl;

  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  const html = await res.text();

  // Page trop petite = erreur CAPTCHA ou ScraperAPI bloqué
  if (html.length < 50000) return [];

  // 0 résultats eBay
  if (
    html.includes('0 résultat') ||
    html.includes('0 article') ||
    html.includes('srp-save-null-search') ||
    html.includes('"totalEntries":0')
  ) return [];

  const prices: number[] = [];

  // Méthode principale : classe s-card__price (structure eBay.fr actuelle)
  const cardBlocks = html.split('s-card__attribute-row');
  if (cardBlocks.length > 1) {
    for (const block of cardBlocks.slice(1)) {
      const m = block.match(/s-card__price[^>]*>([\d\s]+[,.][\d]{2})\s*EUR/);
      if (!m) continue;
      const p = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }

  // Fallback : toutes les occurrences s-card__price
  if (prices.length === 0) {
    for (const m of Array.from(html.matchAll(/s-card__price[^>]*>([\d\s]+[,.][\d]{2})\s*EUR/g))) {
      const p = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }

  return prices;
}

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);

    const prices = await fetchSoldPrices(keywords);

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune vente trouvée.' });
    }

    const sorted = [...prices].sort((a, b) => a - b);

    // Médiane : insensible aux outliers (une carte rare à 524€ n'affecte pas le résultat)
    const mid = Math.floor(sorted.length / 2);
    const average = sorted.length % 2 !== 0
      ? Math.round(sorted[mid] * 100) / 100
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;

    await supabase.from('card_prices').insert([{ card_id: cardId, price: average }]);

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
