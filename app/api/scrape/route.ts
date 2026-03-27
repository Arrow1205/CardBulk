import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let html = '';
    const isEbay = url.toLowerCase().includes('ebay');
    const isCardhobby = url.toLowerCase().includes('cardhobby');
    
    try {
      // Pour eBay et Cardhobby on simule un navigateur Chrome classique, pour Vinted on simule Googlebot
      const userAgent = (isEbay || isCardhobby)
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow', // Très important pour suivre les liens courts ebay.us
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
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
             || html.match(/<img[^>]*id=["']icImg["'][^>]*src=["']([^"']+)["'][^>]*>/i);

    let imageUrl = matchImg ? matchImg[1] : null;
    let base64Image = null;

    if (imageUrl) {
      try {
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

    // A: JSON-LD (Schema.org) -> Parfait pour Vinted
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

    // B: Meta tags standards (og:price)
    if (!extractedPrice) {
      let metaPrice = html.match(/<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:product|og):price:amount["']/i);
      if (metaPrice) extractedPrice = metaPrice[1];
    }

    // C: SUPER-EXTRACTEUR SPÉCIFIQUE EBAY
    if (!extractedPrice && isEbay) {
      // Niveau 1 : Le code JSON interne d'eBay (très fiable sur mobile)
      let ebayJsonPrice = html.match(/"price"\s*:\s*["']?(\d+([.,]\d{1,2})?)["']?/i) 
                       || html.match(/"convertedPrice"\s*:\s*["']?(\d+([.,]\d{1,2})?)["']?/i);
      if (ebayJsonPrice) {
        extractedPrice = ebayJsonPrice[1];
      }

      // Niveau 2 : Les balises itemprop cachées
      if (!extractedPrice) {
        let ebayMeta = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
                    || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
        if (ebayMeta) extractedPrice = ebayMeta[1];
      }

      // Niveau 3 : Aspiration du HTML visuel et extraction mathématique
      if (!extractedPrice) {
        let ebayDiv = html.match(/class=["'][^"']*(?:x-price-primary|prc-display)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i);
        if (ebayDiv) {
          let cleanText = ebayDiv[1].replace(/<[^>]+>/g, ' ').trim();
          const regexPrice = /([0-9]+[.,][0-9]{2})/; 
          const found = cleanText.match(regexPrice);
          if (found) extractedPrice = found[1];
        }
      }
    }

    // D: Spécifique Vinted (test visuel)
    if (!extractedPrice) {
      let vintedPrice = html.match(/data-testid=["']item-price["'][^>]*>([^<]+)<\//i);
      if (vintedPrice) extractedPrice = vintedPrice[1];
    }

    // E: Spécifique Cardhobby (si le prix est dans le HTML de base)
    if (!extractedPrice && isCardhobby) {
       let hobbyPrice = html.match(/"price"\s*:\s*([\d.]+)/i) || html.match(/¥\s*([\d.]+)/i);
       if (hobbyPrice) extractedPrice = hobbyPrice[1];
    }

    // --------------------------------------------------------
    // 3️⃣ NETTOYAGE ABSOLU DU PRIX
    // --------------------------------------------------------
    if (extractedPrice) {
      extractedPrice = extractedPrice.replace(',', '.'); // Format standard Next.js
      extractedPrice = extractedPrice.replace(/[^\d.]/g, ''); // Détruit les lettres (EUR, $)
      
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