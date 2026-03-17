import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();
    console.log("1. Recherche eBay lancée pour :", keywords);

    if (!process.env.EBAY_APP_ID) {
      console.error("❌ ERREUR : Clé EBAY_APP_ID introuvable dans les variables d'environnement.");
      return NextResponse.json({ error: "Clé manquante." }, { status: 500 });
    }

    const ebayUrl = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.7.0&SECURITY-APPNAME=${process.env.EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${encodeURIComponent(keywords)}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&paginationInput.entriesPerPage=10`;

    const response = await fetch(ebayUrl);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ ERREUR API EBAY :", errorText);
        return NextResponse.json({ error: "eBay a refusé la connexion." }, { status: 500 });
    }

    const data = await response.json();
    
    if (data.errorMessage) {
        console.error("❌ Message d'erreur d'eBay :", JSON.stringify(data.errorMessage));
        return NextResponse.json({ error: "Requête eBay invalide." }, { status: 500 });
    }

    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item;

    if (!items || items.length === 0) {
      console.log("2. Aucun résultat trouvé sur eBay pour ces mots-clés.");
      return NextResponse.json({ message: "Aucune vente trouvée." });
    }

    let prices: number[] = [];
    items.forEach((item: any) => {
      const priceString = item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'];
      if (priceString) prices.push(parseFloat(priceString));
    });

    if (prices.length > 0) {
      prices.sort((a, b) => a - b);
      if (prices.length > 4) prices = prices.slice(1, prices.length - 1);
      const sum = prices.reduce((a, b) => a + b, 0);
      const averagePrice = +(sum / prices.length).toFixed(2);

      console.log(`3. Prix calculé avec succès : ${averagePrice} €`);

      const { error: dbError } = await supabase.from('card_prices').insert([{
        card_id: cardId,
        price: averagePrice,
        source: 'API eBay'
      }]);

      if (dbError) {
          console.error("❌ ERREUR SUPABASE (Insertion) :", dbError);
          return NextResponse.json({ error: "Erreur Base de données." }, { status: 500 });
      }

      console.log("4. ✅ Historique sauvegardé !");
      return NextResponse.json({ success: true, averagePrice });
    }

    return NextResponse.json({ message: "Aucun prix exploitable." });

  } catch (error: any) {
    console.error("❌ CRASH FATAL DE L'API :", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}