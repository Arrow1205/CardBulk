import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) return NextResponse.json({ error: "Clé SerpApi manquante." }, { status: 500 });

    // On cherche spécifiquement les ventes terminées sur eBay via SerpApi
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keywords + " ebay sold price")}&api_key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.organic_results) {
      return NextResponse.json({ message: "Aucun résultat trouvé sur Google." });
    }

    const priceRegex = /(?:EUR|USD|GBP|\$|€|£)\s*(\d+(?:[.,]\d+)?)/gi;
    let prices: number[] = [];

    // On scanne les titres et les descriptions renvoyés par SerpApi
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
      
      await supabase.from('card_prices').insert([{
        card_id: cardId,
        price: avg,
        source: 'eBay via SerpApi'
      }]);

      return NextResponse.json({ success: true, averagePrice: avg });
    }

    return NextResponse.json({ error: "Aucun prix extrait des résultats." });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}