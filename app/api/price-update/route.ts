import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (!appId || !certId) {
      return NextResponse.json({ success: false, error: 'Configuration Vercel manquante' }, { status: 500 });
    }

    // 🌟 NOUVEAUTÉ : On actualise la date de la carte DÈS LE DÉBUT de l'opération !
    // Comme ça, on sait que le scan a eu lieu, même s'il ne trouve rien.
    await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error("eBay a refusé l'accès.");

    const query = encodeURIComponent(keywords);
    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=10`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    const searchData = await searchResponse.json();

    if (!searchData.itemSummaries || searchData.itemSummaries.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune annonce active.' });
    }

    let prices: number[] = [];
    searchData.itemSummaries.forEach((item: any) => {
      const title = (item.title || "").toUpperCase();
      const isGradedOrLot = title.includes('PSA') || title.includes('PCA') || title.includes('LOT') || title.includes('BGS') || title.includes('CGC');
      if (item.price && item.price.value && !isGradedOrLot) {
         const priceNum = parseFloat(item.price.value);
         if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
      }
    });

    if (prices.length === 0) return NextResponse.json({ success: false, error: 'Annonces exclues.' });

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