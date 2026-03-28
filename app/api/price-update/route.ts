import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();

    if (!cardId || !keywords) {
      return NextResponse.json({ success: false, error: 'Données manquantes' }, { status: 400 });
    }

    // 🔒 RECUPERATION SECURISEE DES CLES DEPUIS VERCEL
    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CX;

    if (!apiKey || !cx) {
      console.error("Clés Google manquantes dans Vercel");
      return NextResponse.json({ success: false, error: 'Configuration API manquante sur le serveur' }, { status: 500 });
    }

    const query = encodeURIComponent(keywords);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // 🚨 DEBUG : Si Google renvoie une erreur (comme le fameux 403), on l'affiche
    if (data.error) {
      console.error("DÉTAIL ERREUR GOOGLE :", data.error);
      return NextResponse.json({ 
        success: false, 
        error: `Erreur Google API : ${data.error.message} (Code: ${data.error.code})` 
      }, { status: 500 });
    }

    // Vérification de la présence de résultats
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun résultat trouvé sur eBay via Google' });
    }

    // Extraction des prix
    let prices: number[] = [];
    
    data.items.forEach((item: any) => {
      // Regex pour capturer les prix dans les résultats Google
      const priceRegex = /(?:EUR|€|\$|£|GBP)?\s*(\d{1,5}[.,]\d{2})\s*(?:EUR|€|\$|£|GBP)?/gi;
      const textToScan = `${item.title} ${item.snippet}`.toUpperCase();
      
      let match;
      while ((match = priceRegex.exec(textToScan)) !== null) {
        const priceStr = match[1];
        if (priceStr) {
           const priceNum = parseFloat(priceStr.replace(',', '.'));
           // Filtre pour éviter les prix aberrants
           if (priceNum > 0.5 && priceNum < 100000) { 
             prices.push(priceNum);
           }
        }
      }
    });

    if (prices.length === 0) {
      return NextResponse.json({ success: false, error: 'Prix détectés mais illisibles dans les résultats' });
    }

    // Calcul de la moyenne propre
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / prices.length) * 100) / 100;

    // Sauvegarde dans Supabase
    const { error: dbError } = await supabase.from('card_prices').insert([{
      card_id: cardId,
      price: average
    }]);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, averagePrice: average });

  } catch (error: any) {
    console.error('Erreur API Route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}