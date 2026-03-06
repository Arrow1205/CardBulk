import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });

    // 🚀 L'ASTUCE MAGIQUE : Se faire passer pour Googlebot pour contourner l'anti-bot Vinted/eBay
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();

    // --------------------------------------------------------
    // 1️⃣ RECHERCHE DE L'IMAGE (Open Graph)
    // --------------------------------------------------------
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

    // --------------------------------------------------------
    // 2️⃣ RECHERCHE INTELLIGENTE DU PRIX (Vinted / eBay)
    // --------------------------------------------------------
    let extractedPrice = '';

    // Méthode A : Chercher dans les données JSON-LD (Schema.org)
    // 🚀 CORRECTION TYPESCRIPT : Utilisation d'une boucle while avec regex.exec (infaillible)
    const regexLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regexLd.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        // Fonction récursive pour trouver une clé "price" n'importe où dans le JSON
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

    // Méthode B : Les balises Meta (og:price:amount)
    if (!extractedPrice) {
      let metaPrice = html.match(/<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:product|og):price:amount["']/i);
      if (metaPrice) extractedPrice = metaPrice[1];
    }

    // Méthode C : Les balises spécifiques eBay (itemprop="price")
    if (!extractedPrice) {
      let ebayPrice = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
                   || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
      if (ebayPrice) extractedPrice = ebayPrice[1];
    }

    // Méthode D : Directement dans le HTML de Vinted (data-testid="item-price")
    if (!extractedPrice) {
      let vintedPrice = html.match(/data-testid=["']item-price["'][^>]*>([^<]+)<\//i);
      if (vintedPrice) extractedPrice = vintedPrice[1];
    }

    // --------------------------------------------------------
    // 3️⃣ NETTOYAGE DU PRIX (Garder uniquement les chiffres)
    // --------------------------------------------------------
    if (extractedPrice) {
      // Remplace la virgule par un point (ex: "15,50" -> "15.50")
      extractedPrice = extractedPrice.replace(',', '.');
      // Supprime tout ce qui n'est pas un chiffre ou un point (supprime "€", "EUR", les espaces...)
      extractedPrice = extractedPrice.replace(/[^\d.]/g, '');
    }

    if (!base64Image) {
      return NextResponse.json({ error: 'Aucune image trouvée sur ce lien' }, { status: 404 });
    }

    return NextResponse.json({ 
      base64: base64Image,
      price: extractedPrice || '' // Renvoie le prix formaté, ou vide s'il n'a rien trouvé
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Erreur lors du scraping' }, { status: 500 });
  }
}
