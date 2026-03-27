import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    // 🚨 ON FORCE LES CLÉS EN DUR ICI (N'oublie pas les guillemets autour !)
    const apiKey = "AIzaSyAwgoHk2me9fZwkXjCVg73bWqo5G4O0-Sw"; 
    const cx = "b76d5fd2fdc12441a";

    // ... la suite du code reste exactement pareille ...

    // 1. On force la recherche sur les sites pertinents (eBay)
    const query = encodeURIComponent(`${keywords} site:ebay.fr OR site:ebay.com OR site:ebay.co.uk`);
    
    // 2. Appel à l'API Google Custom Search
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}`;
    const response = await fetch(url);
    const data = await response.json();

    // Gestion de l'erreur si la clé Google est bloquée / invalide
    if (data.error) {
      console.error("Erreur API Google :", data.error.message);
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 });
    }

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun résultat pertinent trouvé' });
    }

    // 3. Extraction des prix avec notre Regex
    let prices: number[] = [];
    
    // Cette regex cherche : EUR XX.XX ou XX,XX € ou $XX.XX etc.
    const priceRegex = /(?:EUR|€|\$|£|GBP)?\s*(\d{1,5}[.,]\d{2})\s*(?:EUR|€|\$|£|GBP)?/gi;

    data.items.forEach((item: any) => {
      // On fouille dans le Titre ET dans le Snippet (la description courte de Google)
      const textToScan = `${item.title} ${item.snippet}`.toUpperCase();
      
      // 🚨 CORRECTION TypeScript : La boucle classique "while" remplace matchAll()
      let match;
      while ((match = priceRegex.exec(textToScan)) !== null) {
        const priceStr = match[1]; // Le groupe capturé (le chiffre)
        if (priceStr) {
           const priceNum = parseFloat(priceStr.replace(',', '.'));
           // On ignore les valeurs absurdes (ex: prix < 0.50€ ou > 100 000€)
           if (priceNum > 0.5 && priceNum < 100000) { 
             prices.push(priceNum);
           }
        }
      }
    });

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Impossible de lire un prix clair dans les résultats' });
    }

    // 4. Calcul de la moyenne propre
    // On dé-duplique les prix identiques (souvent la même annonce qui ressort 2 fois)
    const uniquePrices = Array.from(new Set(prices));
    
    const sum = uniquePrices.reduce((a, b) => a + b, 0);
    let average = sum / uniquePrices.length;

    // Arrondi à 2 décimales
    average = Math.round(average * 100) / 100;

    // 5. Sauvegarde directe dans Supabase
    const { error: dbError } = await supabase.from('card_prices').insert([{
      card_id: cardId,
      price: average
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.error('Erreur Update Prix:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}