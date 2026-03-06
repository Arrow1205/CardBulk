import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    // 🚀 SÉCURITÉ : Limite de temps à 8 secondes pour ne jamais tourner dans le vide
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let html = '';
    try {
      // 🚀 ASTUCE : On s'adapte à la cible. eBay bloque les faux Googlebot, donc on passe en Chrome.
      const isEbay = url.toLowerCase().includes('ebay');
      const userAgent = isEbay 
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      clearTimeout(timeoutId);
      html = await response.text();
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Erreur fetch HTML:", e);
      return NextResponse.json({ error: 'Délai dépassé ou page bloquée par la sécurité du site' }, { status: 500 });
    }

    // --------------------------------------------------------
    // 1️⃣ RECHERCHE DE L'IMAGE
    // --------------------------------------------------------
    let matchImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
             || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i)
             || html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
             || html.match(/<img[^>]*id=["']icImg["'][^>]*src=["']([^"']+)["'][^>]*>/i); // Sécurité spéciale eBay

    let imageUrl = matchImg ? matchImg[1] : null;
    let base64Image = null;

    if (imageUrl) {
      try {
        // Nettoyage de l'URL pour eBay
        imageUrl = imageUrl.replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

        const imgController = new AbortController();
        const imgTimeout = setTimeout(() => imgController.abort(), 5000);
        
        const imgRes = await fetch(imageUrl, { signal: imgController.signal });
        clearTimeout(imgTimeout);
        
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        base64Image = `data:${mimeType};base64,${base64}`;
      } catch (e) {
        console.error("Erreur téléchargement image:", e);
      }
    }

    // --------------------------------------------------------
    // 2️⃣ RECHERCHE DU PRIX
    // --------------------------------------------------------
    let extractedPrice = '';

    // A: JSON-LD (Schema.org)
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
        if (foundPrice) { extractedPrice = foundPrice; break; }
      } catch(e) {}
    }

    // B: Meta tags standards
    if (!extractedPrice) {
      let metaPrice = html.match(/<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:product|og):price:amount["']/i);
      if (metaPrice) extractedPrice = metaPrice[1];
    }

    // C: Spécifique eBay
    if (!extractedPrice) {
      let ebayPrice = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i)
                   || html.match(/class=["']x-price-primary["'][^>]*>([^<]+)</i);
      if (ebayPrice) extractedPrice = ebayPrice[1];
    }

    // D: Spécifique Vinted
    if (!extractedPrice) {
      let vintedPrice = html.match(/data-testid=["']item-price["'][^>]*>([^<]+)<\//i);
      if (vintedPrice) extractedPrice = vintedPrice[1];
    }

    // --------------------------------------------------------
    // 3️⃣ NETTOYAGE DU PRIX
    // --------------------------------------------------------
    if (extractedPrice) {
      extractedPrice = extractedPrice.replace(',', '.');
      extractedPrice = extractedPrice.replace(/[^\d.]/g, '');
      
      // Sécurité si un prix a plusieurs points (ex: format américain "1.200.50")
      const parts = extractedPrice.split('.');
      if (parts.length > 2) {
         extractedPrice = parts.slice(0, -1).join('') + '.' + parts[parts.length-1];
      }
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