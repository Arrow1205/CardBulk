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

  // Page suspecte (trop petite) — probablement une erreur ScraperAPI ou CAPTCHA
  if (html.length < 50000) {
    console.log('[price-update] small page content:', html.slice(0, 600));
    return [];
  }

  // Détecte les pages sans résultats eBay
  const noResults =
    html.includes('0 résultat') ||
    html.includes('0 article') ||
    html.includes('srp-save-null-search') ||
    html.includes('"totalEntries":0') ||
    html.includes('"itemsCount":0');
  if (noResults) {
    console.log('[price-update] eBay: 0 résultats');
    return [];
  }

  const prices: number[] = [];

  // --- Méthode 1 : JSON embarqué eBay (le plus fiable) ---
  // eBay injecte les données de listing dans window.__PRELOADED_STATE__ ou des balises JSON-LD
  const jsonPriceMatches = Array.from(
    html.matchAll(/"soldPrice"\s*:\s*\{[^}]*?"value"\s*:\s*"([\d.]+)"/g)
  );
  for (const m of jsonPriceMatches) {
    const p = parseFloat(m[1]);
    if (p > 0.5 && p < 100000) prices.push(p);
  }

  // --- Méthode 2 : balises <span> contenant le prix vendu ---
  // eBay.fr peut utiliser BOLD, s-item__price, g-b, POSITIVE selon la version du template
  if (prices.length === 0) {
    // Découpe par article (chaque résultat eBay est dans un bloc s-item)
    const itemBlocks = html.split(/s-item[^_]|s-item__wrapper/);
    for (const block of itemBlocks.slice(1)) {
      const title = (block.match(/class="(?:s-item__title|ITEM-TITLE)[^"]*"[^>]*>([^<]{0,200})/)?.[1] || '').toUpperCase();
      const isGradedOrLot =
        title.includes('PSA') || title.includes('BGS') || title.includes('CGC') ||
        title.includes('PCA') || title.includes('LOT ') || title.includes(' LOT');
      if (isGradedOrLot) continue;

      // Cherche le prix dans le bloc — plusieurs formats possibles
      const pm =
        block.match(/class="(?:s-item__price|BOLD|g-b|POSITIVE)[^"]*"[^>]*>\s*(?:<[^>]+>)?([\d\s]+[,.][\d]{2})\s*(?:EUR|€)/i) ||
        block.match(/"displayPrice"\s*:\s*"EUR\s*([\d,.]+)"/i);
      if (!pm) continue;

      const p = parseFloat(pm[1].replace(/\s/g, '').replace(',', '.'));
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }

  // --- Méthode 3 : prix dans le JSON structuré de la page ---
  if (prices.length === 0) {
    const structPrices = Array.from(
      html.matchAll(/"currentPrice"\s*:\s*\{[^}]*?"value"\s*:\s*([\d.]+)/g)
    );
    for (const m of structPrices) {
      const p = parseFloat(m[1]);
      if (p > 0.5 && p < 100000) prices.push(p);
    }
  }

  // --- Diagnostic si toujours rien ---
  if (prices.length === 0) {
    // Cherche le contexte autour du premier montant EUR pour adapter le parser
    const eurIdx = html.search(/\d[,.]\d{2}\s*EUR/);
    if (eurIdx !== -1) {
      console.log('[price-update] EUR sample (no match):', html.slice(Math.max(0, eurIdx - 100), eurIdx + 150));
    } else {
      console.log('[price-update] no EUR found at all');
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
