import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Scrape les ventes réussies eBay.fr — même URL que le bouton "Ventes réussies"
async function fetchSoldPrices(keywords: string): Promise<number[]> {
  const encoded = encodeURIComponent(keywords);
  const url = `https://www.ebay.fr/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1&_ipg=20`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });

  const html = await res.text();
  console.log('[price-update] eBay scrape status:', res.status, '| html length:', html.length);

  // Extrait les prix depuis les blocs .s-item
  // Chaque vente a : <span class="s-item__price">X,XX EUR</span>
  // On utilise une regex pour parser rapidement sans DOM
  const prices: number[] = [];

  // Repère les blocs article pour exclure les lots et gradées
  const itemBlocks = html.split('s-item__info');
  for (const block of itemBlocks.slice(1)) {
    // Titre de l'annonce
    const titleMatch = block.match(/class="s-item__title[^"]*"[^>]*>([^<]{0,200})</);
    const title = (titleMatch?.[1] || '').toUpperCase();

    const isGradedOrLot =
      title.includes('PSA') || title.includes('BGS') || title.includes('CGC') ||
      title.includes('PCA') || title.includes('LOT ') || title.includes(' LOT');

    if (isGradedOrLot) continue;

    // Prix — format eBay.fr : "12,50 EUR" ou "12.50 EUR"
    const priceMatch = block.match(/s-item__price[^>]*>[^<]*?([\d\s]+[,.][\d]+)\s*(?:EUR|€)/);
    if (!priceMatch) continue;

    const rawPrice = priceMatch[1].replace(/\s/g, '').replace(',', '.');
    const priceNum = parseFloat(rawPrice);
    if (priceNum > 0.5 && priceNum < 100000) {
      prices.push(priceNum);
    }
  }

  console.log('[price-update] parsed prices:', prices);
  return prices;
}

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    // Actualise la date dès le début, même si aucun prix n'est trouvé
    await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);

    console.log('[price-update] keywords:', keywords);

    let prices = await fetchSoldPrices(keywords);

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune vente trouvée.' });
    }

    prices.sort((a, b) => a - b);
    if (prices.length >= 4) { prices.pop(); prices.shift(); }

    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    await supabase.from('card_prices').insert([{ card_id: cardId, price: average }]);

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.log('[price-update] error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
