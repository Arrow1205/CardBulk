import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();
    console.log("1. Recherche Google lancée pour :", keywords);

    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CX) {
      console.error("❌ ERREUR : Clés GOOGLE_API_KEY ou GOOGLE_CX manquantes ! As-tu fait un Redeploy sur Vercel ?");
      return NextResponse.json({ error: "Clés API Google manquantes." }, { status: 500 });
    }

    const query = encodeURIComponent(`${keywords} sold price`);
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${query}`;

    console.log("2. Appel de l'API Google...");
    const response = await fetch(googleUrl);
    const data = await response.json();

    // Vérification d'une erreur renvoyée par Google
    if (data.error) {
        console.error("❌ ERREUR API GOOGLE :", JSON.stringify(data.error));
        return NextResponse.json({ error: "Erreur renvoyée par Google." }, { status: 500 });
    }

    if (!data.items || data.items.length === 0) {
      console.log("3. Aucun résultat pertinent trouvé par Google.");
      return NextResponse.json({ message: "Aucun résultat trouvé." });
    }

    const priceRegex = /(?:EUR|USD|GBP|\$|€|£)\s*(\d+(?:[.,]\d+)?)/gi;
    let prices: number[] = [];

    data.items.forEach((item: any) => {
      const textToSearch = item.title + " " + item.snippet;
      let match;
      while ((match = priceRegex.exec(textToSearch)) !== null) {
        const priceVal = parseFloat(match[1].replace(',', '.'));
        if (priceVal > 0 && priceVal < 100000) prices.push(priceVal);
      }
    });

    if (prices.length > 0) {
      prices.sort((a, b) => a - b);
      if (prices.length > 4) prices = prices.slice(1, prices.length - 1);
      
      const sum = prices.reduce((a, b) => a + b, 0);
      const averagePrice = +(sum / prices.length).toFixed(2);

      console.log(`4. Prix calculé avec succès : ${averagePrice} €`);

      const { error: dbError } = await supabase.from('card_prices').insert([{
        card_id: cardId,
        price: averagePrice,
        source: 'eBay via Google'
      }]);

      if (dbError) {
          console.error("❌ ERREUR SUPABASE (Insertion) :", dbError);
          return NextResponse.json({ error: "Erreur Base de données." }, { status: 500 });
      }

      console.log("5. ✅ Historique sauvegardé !");
      return NextResponse.json({ success: true, averagePrice });
    }

    console.log("3. Des résultats trouvés, mais aucun prix exploitable extrait.");
    return NextResponse.json({ message: "Aucun prix extrait." });

  } catch (error: any) {
    console.error("❌ CRASH FATAL DE L'API :", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 