import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    // Se faire passer pour Googlebot
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();

    // 1️⃣ RECHERCHE DE L'IMAGE
    let matchImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
             || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i)
             || html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);

    let imageUrl = matchImg ? matchImg[1] : null;
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

    // 2️⃣ RECHERCHE DU PRIX
    let extractedPrice = '';

    // CORRECTION TYPE SCRIPT : Boucle while classique au lieu de matchAll / for...of
    const regexLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = regexLd.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const findPrice = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.price) return String(obj.price);
          if (obj.offers && obj.offers.price) return String(obj.offers.price);
          for (const key in obj) {
            const found = findPrice(obj[key]);
            if (found) return found;
          }
          return null;
        };
        
        const foundPrice = findPrice(data);
        if (foundPrice) { 
          extractedPrice = foundPrice; 
          break; 
        }
      } catch(e) {
        // Ignore JSON parse errors
      }
    }

    if (!extractedPrice) {
      let metaPrice = html.match(/<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:product|og):price:amount["']/i);
      if (metaPrice) extractedPrice = metaPrice[1];
    }

    if (!extractedPrice) {
      let ebayPrice = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
      if (ebayPrice) extractedPrice = ebayPrice[1];
    }

    if (!extractedPrice) {
      let vintedPrice = html.match(/data-testid=["']item-price["'][^>]*>([^<]+)<\//i);
      if (vintedPrice) extractedPrice = vintedPrice[1];
    }

    // 3️⃣ NETTOYAGE DU PRIX
    if (extractedPrice) {
      extractedPrice = extractedPrice.replace(',', '.');
      extractedPrice = extractedPrice.replace(/[^\d.]/g, '');
    }

    if (!base64Image) {
      return NextResponse.json({ error: 'Aucune image trouvée sur ce lien' }, { status: 404 });
    }

    return NextResponse.json({ 
      base64: base64Image,
      price: extractedPrice || '' 
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Erreur lors du scraping' }, { status: 500 });
  }
}
