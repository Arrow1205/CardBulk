import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();
    
    console.log("🚀 APPEL API REÇU POUR :", keywords);
    console.log("🔑 VERIF CLÉ SERPAPI :", process.env.SERPAPI_KEY ? "PRÉSENTE (Début: " + process.env.SERPAPI_KEY.substring(0, 5) + "...)" : "❌ MANQUANTE");
    
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      console.error("❌ ERREUR : La variable SERPAPI_KEY est manquante dans Vercel !");
      return NextResponse.json({ error: "Clé SerpApi manquante." }, { status: 500 });
    }

    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keywords + " ebay sold price")}&api_key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ ERREUR SERPAPI :", data.error);
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    if (!data.organic_results) {
      console.log("⚠️ Aucun résultat organique trouvé.");
      return NextResponse.json({ message: "Aucun résultat trouvé sur Google." });
    }

    const priceRegex = /(?:EUR|USD|GBP|\$|€|£)\s*(\d+(?:[.,]\d+)?)/gi;
    let prices: number[] = [];

    data.organic_results.forEach((result: any) => {
      const text = (result.title + " " + result.snippet).replace(/\s/g, ' ');
      let match;
      while ((match = priceRegex.exec(text)) !== null) {
        const p = parseFloat(match[1].replace(',', '.'));
        if (p > 1 && p < 50000) prices.push(p);
      }
    });

    if (prices.length > 0) {
      const avg = +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      console.log("✅ Prix moyen trouvé :", avg);

      const { error: dbError } = await supabase.from('card_prices').insert([{
        card_id: cardId,
        price: avg,
        source: 'eBay via SerpApi'
      }]);

      if (dbError) {
        console.error("❌ ERREUR SUPABASE :", dbError);
        return NextResponse.json({ error: "Erreur DB" }, { status: 500 });
      }

      return NextResponse.json({ success: true, averagePrice: avg });
    }

    return NextResponse.json({ error: "Aucun prix extrait des résultats." });

  } catch (error: any) {
    console.error("❌ CRASH :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}