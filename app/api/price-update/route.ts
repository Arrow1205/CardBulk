import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    // 🔒 RECUPERATION DES CLES EBAY DEPUIS VERCEL
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (!appId || !certId) {
      console.error("Clés eBay manquantes dans Vercel");
      return NextResponse.json({ success: false, error: 'Configuration eBay manquante' }, { status: 500 });
    }

    // --------------------------------------------------------
    // 1️⃣ GÉNÉRATION DU TOKEN D'ACCÈS EBAY
    // --------------------------------------------------------
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
    
    if (!tokenData.access_token) {
      console.error("Erreur Token eBay :", tokenData);
      throw new Error("Impossible de s'authentifier auprès d'eBay");
    }

    // --------------------------------------------------------
    // 2️⃣ RECHERCHE DES CARTES SUR EBAY
    // --------------------------------------------------------
    const query = encodeURIComponent(keywords);
    // limit=10 pour faire une moyenne sur les 10 résultats les plus pertinents
    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=10`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR' // Recherche sur eBay France (tu peux mettre EBAY_US si besoin)
      }
    });

    const searchData = await searchResponse.json();

    if (!searchData.itemSummaries || searchData.itemSummaries.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun résultat trouvé sur eBay pour cette carte' });
    }

    // --------------------------------------------------------
    // 3️⃣ CALCUL DU PRIX MOYEN
    // --------------------------------------------------------
    let prices: number[] = [];
    
    searchData.itemSummaries.forEach((item: any) => {
      if (item.price && item.price.value) {
         const priceNum = parseFloat(item.price.value);
         // On ignore les prix à 0 ou les aberrations
         if (priceNum > 0.5 && priceNum < 100000) { 
           prices.push(priceNum);
         }
      }
    });

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Annonces trouvées, mais prix illisibles' });
    }

    // Calcul de la moyenne
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    // --------------------------------------------------------
    // 4️⃣ SAUVEGARDE DANS SUPABASE
    // --------------------------------------------------------
    const { error: dbError } = await supabase.from('card_prices').insert([{
      card_id: cardId,
      price: average
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.error('Erreur globale eBay API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
