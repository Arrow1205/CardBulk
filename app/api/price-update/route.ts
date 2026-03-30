import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes : Impossible de lire la carte ou les mots-clés.' }, { status: 400 });
    }

    // 🔒 RECUPERATION DES CLES EBAY DEPUIS VERCEL
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (!appId || !certId) {
      return NextResponse.json({ success: false, error: 'Configuration Vercel : Clés eBay manquantes (EBAY_APP_ID ou EBAY_CERT_ID).' }, { status: 500 });
    }

    // --------------------------------------------------------
    // 1️⃣ GÉNÉRATION DU TOKEN D'ACCÈS EBAY (Standard Browse API)
    // --------------------------------------------------------
    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      // Scope classique (autorisé pour tous les comptes développeurs)
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error("Erreur Token eBay complet :", tokenData);
      throw new Error("eBay a refusé l'accès. Vérifie que tes clés Production sont correctes.");
    }

    // --------------------------------------------------------
    // 2️⃣ RECHERCHE DES ANNONCES ACTIVES SUR EBAY
    // --------------------------------------------------------
    const query = encodeURIComponent(keywords);
    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=10`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' // Tu peux changer par EBAY_US si besoin un jour
      }
    });

    const searchData = await searchResponse.json();

    if (!searchData.itemSummaries || searchData.itemSummaries.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune annonce active trouvée sur eBay en ce moment pour ces critères.' });
    }

    // --------------------------------------------------------
    // 3️⃣ CALCUL DU PRIX MOYEN "INTELLIGENT"
    // --------------------------------------------------------
    let prices: number[] = [];
    
    searchData.itemSummaries.forEach((item: any) => {
      const title = (item.title || "").toUpperCase();
      // On exclut les lots et les cartes gradées pour ne pas fausser le prix
      const isGradedOrLot = title.includes('PSA') || title.includes('PCA') || title.includes('LOT') || title.includes('BGS') || title.includes('CGC');
      
      if (item.price && item.price.value && !isGradedOrLot) {
         const priceNum = parseFloat(item.price.value);
         // Sécurité : on ignore les prix à 0 ou les valeurs absurdes
         if (priceNum > 0.5 && priceNum < 100000) { 
           prices.push(priceNum);
         }
      }
    });

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Annonces trouvées, mais toutes exclues (ce sont des lots ou des cartes gradées).' });
    }

    // Sécurité Anti-Pigeon / Anti-Bradage
    prices.sort((a, b) => a - b);
    if (prices.length >= 4) {
      prices.pop();   // Enlève le plus cher
      prices.shift(); // Enlève le moins cher
    }

    // Calcul de la moyenne
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    // --------------------------------------------------------
    // 4️⃣ SAUVEGARDE DANS SUPABASE
    // --------------------------------------------------------
    // On archive le prix dans l'historique
    await supabase.from('card_prices').insert([{ 
      card_id: cardId, 
      price: average 
    }]);
    
    // On met à jour la date de dernière actualisation de la carte
    await supabase.from('cards').update({ 
      updated_at: new Date().toISOString() 
    }).eq('id', cardId);

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.error('Erreur API eBay Critique:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erreur technique inattendue du serveur.' }, { status: 500 });
  }
}