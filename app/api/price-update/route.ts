import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Scrape les ventes réussies eBay.fr via ScraperAPI (contourne le blocage IP de Vercel)
async function fetchSoldPrices(keywords: string): Promise<number[]> {
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
  console.log('[price-update] status:', res.status, '| length:', html.length);

  // Diagnostic — log extrait HTML autour de la première occurrence de prix
  const diagIdx = html.search(/s-item__price|POSITIVE|itemprop="price"/);
  if (diagIdx !== -1) {
    console.log('[price-update] price HTML sample:', html.slice(diagIdx, diagIdx + 400));
  } else {
    // Log les 500 premiers chars pour voir ce qu'on reçoit
    console.log('[price-update] no price pattern found. HTML start:', html.slice(0, 500));
  }

  const prices: number[] = [];

  // --- Méthode 1 : blocs s-item__info (structure eBay classique) ---
  const itemBlocks = html.split('s-item__info');
  if (itemBlocks.length > 1) {
    for (const block of itemBlocks.slice(1)) {
      const titleMatch = block.match(/class="s-item__title[^"]*"[^>]*>\s*<span[^>]*>([^<]{0,200})</);
      const title = (titleMatch?.[1] || '').toUpperCase();
      const isGradedOrLot =
        title.includes('PSA') || title.includes('BGS') || title.includes('CGC') ||
        title.includes('PCA') || title.includes('LOT ') || title.includes(' LOT');
      if (isGradedOrLot) continue;

      // Prix dans le bloc — eBay.fr format: "12,50 EUR" ou "12.50 EUR" ou "12 EUR"
      const priceMatch = block.match(/s-item__price[^>]*>[\s\S]{0,50}?([\d\s]{1,8}[,.][\d]{2})\s*(?:EUR|€)/i);
      if (!priceMatch) continue;
      const priceNum = parseFloat(priceMatch[1].replace(/\s/g, '').replace(',', '.'));
      if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
    }
  }

  // --- Méthode 2 fallback : toutes les occurrences EUR dans la page ---
  if (prices.length === 0) {
    const allPrices = Array.from(html.matchAll(/"POSITIVE"[^>]*>([\d\s,.']+)\s*EUR/g));
    for (const m of allPrices) {
      const priceNum = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
    }
  }

  // --- Méthode 3 fallback large : toutes valeurs EUR de la page ---
  if (prices.length === 0) {
    const allEur = Array.from(html.matchAll(/([\d]{1,6}[,.][\d]{2})\s*EUR/g));
    for (const m of allEur) {
      const priceNum = parseFloat(m[1].replace(',', '.'));
      if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
    }
  }

  console.log('[price-update] parsed prices:', prices.slice(0, 20));
  return prices;
}

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);

    console.log('[price-update] keywords:', keywords);

    const prices = await fetchSoldPrices(keywords);

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune vente trouvée.' });
    }

    const sorted = [...prices].sort((a, b) => a - b);
    if (sorted.length >= 4) { sorted.pop(); sorted.shift(); }

    const average = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100;

    await supabase.from('card_prices').insert([{ card_id: cardId, price: average }]);

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.log('[price-update] error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
