import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    // On se fait passer pour un vrai navigateur pour ne pas être bloqué
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();

    // 1. RECHERCHE DE L'IMAGE (Open Graph)
    let match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
             || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i)
             || html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);

    let imageUrl = match ? match[1] : null;
    let base64Image = null;

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        base64Image = `data:${mimeType};base64,${base64}`;
      } catch (e) {
        console.error("Erreur téléchargement image:", e);
      }
    }

    // 2. RECHERCHE DU PRIX (Tags spécifiques ou Titre)
    let extractedPrice = '';
    
    // Essai A : Balises de prix standards
    let priceMatch = html.match(/<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                  || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:product|og):price:amount["'][^>]*>/i);
    
    if (priceMatch && priceMatch[1]) {
      extractedPrice = priceMatch[1];
    } else {
      // Essai B : Extraction depuis le titre (très commun sur Vinted/Leboncoin)
      let titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) 
                    || html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      
      if (titleMatch && titleMatch[1]) {
        const titleText = titleMatch[1];
        // Cherche un motif du type "15,00 €", "15€", "15.00"
        const regexPrice = /([0-9]+(?:[.,][0-9]{1,2})?)\s*[€$£]/;
        const found = titleText.match(regexPrice);
        if (found && found[1]) {
          extractedPrice = found[1].replace(',', '.'); // Normalise la virgule en point
        }
      }
    }

    if (!base64Image) {
      return NextResponse.json({ error: 'Aucune image trouvée sur ce lien' }, { status: 404 });
    }

    // On renvoie l'image ET le prix trouvé (s'il y en a un)
    return NextResponse.json({ 
      base64: base64Image,
      price: extractedPrice 
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Erreur lors du scraping' }, { status: 500 });
  }
}
