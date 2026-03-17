import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CX) {
      return NextResponse.json({ error: "Clés API Google manquantes." }, { status: 500 });
    }

    // Appel à l'API Google Custom Search (Recherche de ventes terminées)
    const query = encodeURIComponent(`${keywords} sold price`);
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${query}`;

    const response = await fetch(googleUrl);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ message: "Aucun résultat trouvé." });
    }

    // Extraction des prix avec une Regex
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

      await supabase.from('card_prices').insert([{
        card_id: cardId,
        price: averagePrice,
        source: 'eBay via Google'
      }]);

      return NextResponse.json({ success: true, averagePrice });
    }

    return NextResponse.json({ message: "Aucun prix extrait." });

  } catch (error: any) {
    console.error("Erreur Price Update:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}