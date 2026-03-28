import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    // 1. On prépare la recherche
    const searchQuery = encodeURIComponent(keywords.trim());
    
    // 2. On interroge eBay directement (ventes réussies uniquement)
    const url = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&LH_Sold=1&LH_Complete=1&_ipg=25`;
    
    // On se fait passer pour un navigateur classique
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      cache: 'no-store' // On force la récupération des derniers prix
    });

    const html = await response.text();

    // 3. Regex pour trouver les prix en vert (ventes terminées sur eBay)
    const priceRegex = /<span class="POSITIVE"[^>]*>[^0-9]*([\d\s.,]+)/gi;
    
    let prices: number[] = [];
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
      if (match[1]) {
        // Nettoyage : on enlève les espaces et on remplace la virgule par un point
        let priceValue = match[1].replace(/\s/g, '').replace(',', '.').trim();
        const priceNum = parseFloat(priceValue);
        
        // On évite les prix absurdes ou à 0
        if (!isNaN(priceNum) && priceNum > 0.5 && priceNum < 100000) {
          prices.push(priceNum);
        }
      }
    }

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun prix trouvé sur eBay pour cette carte.' });
    }

    // 4. Calcul de la moyenne
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    // 5. Sauvegarde dans Supabase
    const { error: dbError } = await supabase.from('card_prices').insert([{
      card_id: cardId,
      price: average
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.error('Erreur Route Scraping:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}