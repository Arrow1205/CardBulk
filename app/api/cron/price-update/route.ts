import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 🥷 Fonction de nettoyage (la même que sur ton app)
function cleanData(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  const strVal = String(value).toUpperCase().trim();
  if (strVal === '-' || strVal === 'NC' || strVal === 'N/A' || strVal === 'EMPTY' || strVal.includes('PAS DE DONN')) {
    return '';
  }
  return String(value).trim();
}

export async function GET(req: Request) {
  // 🔒 SÉCURITÉ VERCEL : Empêche n'importe qui de lancer ton robot
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Accès non autorisé', { status: 401 });
  }

  try {
    // RÉCUPÉRATION DES CARTES (15 cartes max par heure pour ne pas spammer eBay)
    const { data: cardsToUpdate, error: fetchError } = await supabase
      .from('cards') 
      .select('*')
      .order('updated_at', { ascending: true, nullsFirst: true }) // Prend celles qui n'ont pas été scannées depuis le plus longtemps
      .limit(15);

    if (fetchError) throw fetchError;
    if (!cardsToUpdate || cardsToUpdate.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucune carte à mettre à jour.' });
    }

    // AUTHENTIFICATION EBAY
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;
    if (!appId || !certId) throw new Error("Clés eBay manquantes");

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error("Erreur Token eBay");

    // LA BOUCLE DES PRIX
    let updatedCount = 0;

    for (const card of cardsToUpdate) {
      // 1️⃣ On actualise la date de scan pour dire "Le robot est passé par là"
      await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', card.id);

      // 2️⃣ CONSTRUCTION INTELLIGENTE DES MOTS-CLÉS (Identique au scan manuel)
      let formattedYear = card.year;
      if (!['TENNIS', 'BASEBALL', 'F1'].includes(card.sport) && card.year && /^\d{4}$/.test(card.year.toString())) {
        const yearNum = parseInt(card.year, 10); 
        const prevYear = yearNum - 1; 
        const shortYear = card.year.toString().slice(-2);
        formattedYear = `${prevYear}-${shortYear}`;
      }

      const annee = cleanData(formattedYear);
      const brand = cleanData(card.brand);
      const series = cleanData(card.series);
      const prenom = cleanData(card.firstname);
      const nom = cleanData(card.lastname);
      const variation = cleanData(card.variation);
      
      // 🌟 L'ajout des options Auto/Patch et Numérotation propre (sans doublon !)
      const autoKeyword = card.is_auto ? 'Auto' : '';
      const patchKeyword = card.is_patch ? 'Patch' : '';
      const numerotation = card.is_numbered && card.numbering_max ? cleanData(card.numbering_max) : '';

      const keywordsArray = [annee, brand, series, prenom, nom, variation, autoKeyword, patchKeyword, numerotation];
      const keywords = keywordsArray.filter(Boolean).join(' ');

      if (!keywords) continue;

      const query = encodeURIComponent(keywords);
      const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=10`;

      // 3️⃣ RECHERCHE SUR LE MARCHÉ US
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' // 🇺🇸 Le marché principal
        }
      });

      const searchData = await searchResponse.json();
      let average = 0;

      if (searchData.itemSummaries && searchData.itemSummaries.length > 0) {
        let prices: number[] = [];
        
        searchData.itemSummaries.forEach((item: any) => {
          const title = (item.title || "").toUpperCase();
          const isGradedOrLot = title.includes('PSA') || title.includes('PCA') || title.includes('LOT') || title.includes('BGS') || title.includes('CGC');
          
          if (item.price && item.price.value && !isGradedOrLot) {
             const priceNum = parseFloat(item.price.value);
             if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
          }
        });

        // 4️⃣ SÉCURITÉ ANTI-PIGEON
        if (prices.length > 0) {
          prices.sort((a, b) => a - b);
          if (prices.length >= 4) { prices.pop(); prices.shift(); }
          
          const sum = prices.reduce((a, b) => a + b, 0);
          average = Math.round((sum / prices.length) * 100) / 100;
        }
      }

      // 5️⃣ ENREGISTREMENT SUPABASE
      // On n'ajoute un point sur le graphique que si on a trouvé un prix !
      if (average > 0) {
        await supabase.from('card_prices').insert([{ card_id: card.id, price: average }]);
      }
      
      updatedCount++;

      // ⏱️ Pause de 1 seconde pour être gentil avec les serveurs d'eBay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({ success: true, message: `${updatedCount} cartes scannées avec succès.` });

  } catch (error: any) {
    console.error('Erreur Cron Job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}