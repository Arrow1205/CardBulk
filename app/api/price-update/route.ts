import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    const appId = process.env.EBAY_APP_ID;

    if (!appId) {
      return NextResponse.json({ success: false, error: 'Configuration Vercel manquante' }, { status: 500 });
    }

    // Actualise la date dès le début, même si aucun prix n'est trouvé
    await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);

    // Finding API — findCompletedItems : ventes réussies (équivalent LH_Sold=1&LH_Complete=1)
    // Pas besoin de token OAuth, l'App ID suffit
    const query = encodeURIComponent(keywords);
    const searchUrl =
      `https://svcs.ebay.com/services/search/FindingService/v1` +
      `?OPERATION-NAME=findCompletedItems` +
      `&SERVICE-VERSION=1.0.0` +
      `&SECURITY-APPNAME=${appId}` +
      `&RESPONSE-DATA-FORMAT=JSON` +
      `&keywords=${query}` +
      `&itemFilter%280%29.name=SoldItemsOnly` +
      `&itemFilter%280%29.value=true` +
      `&paginationInput.entriesPerPage=20`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const items: any[] =
      searchData?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune vente trouvée.' });
    }

    let prices: number[] = [];
    items.forEach((item: any) => {
      const title = (item.title?.[0] || '').toUpperCase();
      const isGradedOrLot =
        title.includes('PSA') || title.includes('PCA') ||
        title.includes('LOT') || title.includes('BGS') || title.includes('CGC');
      const priceVal = item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'];
      if (priceVal && !isGradedOrLot) {
        const priceNum = parseFloat(priceVal);
        if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
      }
    });

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Annonces exclues (gradées ou lots).' });
    }

    prices.sort((a, b) => a - b);
    if (prices.length >= 4) { prices.pop(); prices.shift(); }

    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    await supabase.from('card_prices').insert([{ card_id: cardId, price: average }]);

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
