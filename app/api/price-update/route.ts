import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 1. Fonction Ninja améliorée (gère les nombres et le mot "EMPTY")
function cleanData(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  
  const strVal = String(value).toUpperCase().trim();
  if (strVal === '-' || strVal === 'NC' || strVal === 'N/A' || strVal === 'EMPTY' || strVal.includes('PAS DE DONN')) {
    return '';
  }
  return String(value).trim();
}

export async function GET(req: Request) {
  // SÉCURITÉ VERCEL
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Accès non autorisé', { status: 401 });
  }

  try {
    // RÉCUPÉRATION DES CARTES (15 par heure)
    const { data: cardsToUpdate, error: fetchError } = await supabase
      .from('cards') 
      .select('*')
      .order('updated_at', { ascending: true, nullsFirst: true }) 
      .limit(15);

    if (fetchError) throw fetchError;
    if (!cardsToUpdate || cardsToUpdate.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucune carte à mettre à jour.' });
    }

    // AUTHENTIFICATION EBAY
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;
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
      // 🏗️ CONSTRUCTION SUR-MESURE SELON TA BASE DE DONNÉES
      const annee = cleanData(card.year);
      const brand = cleanData(card.brand);
      const series = cleanData(card.series);
      const prenom = cleanData(card.firstname);
      const nom = cleanData(card.lastname);
      
      // Gestion de la numérotation (ex: si numbering_max = 99, ça donne "/99")
      const numerotation = card.is_numbered && card.numbering_max ? `/${cleanData(card.numbering_max)}` : '';
      
      // Gestion de la gradation (ex: "PSA 10")
      let gradation = '';
      if (card.is_graded && card.grading_company) {
        gradation = `${cleanData(card.grading_company)} ${cleanData(card.grading_grade)}`.trim();
      }

      // Ordre de recherche optimisé pour eBay
      const keywordsArray = [annee, brand, series, prenom, nom, numerotation, gradation];
      const keywords = keywordsArray.filter(Boolean).join(' ');

      if (!keywords) continue;

      const query = encodeURIComponent(keywords);
      const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=10`;

      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR'
        }
      });

      const searchData = await searchResponse.json();
      let average = 0;

      if (searchData.itemSummaries && searchData.itemSummaries.length > 0) {
        let prices: number[] = [];
        
        searchData.itemSummaries.forEach((item: any) => {
          const title = (item.title || "").toUpperCase();
          // On exclut les lots et les gradées SAUF si la carte qu'on cherche est elle-même gradée !
          const isGradedOrLot = !card.is_graded && (title.includes('PSA') || title.includes('PCA') || title.includes('LOT') || title.includes('BGS') || title.includes('CGC'));
          
          if (item.price && item.price.value && !isGradedOrLot) {
             const priceNum = parseFloat(item.price.value);
             if (priceNum > 0.5 && priceNum < 100000) prices.push(priceNum);
          }
        });

        if (prices.length > 0) {
          prices.sort((a, b) => a - b);
          if (prices.length >= 4) { prices.pop(); prices.shift(); }
          
          const sum = prices.reduce((a, b) => a + b, 0);
          average = Math.round((sum / prices.length) * 100) / 100;
        }
      }

      // 💾 ENREGISTREMENT SUPABASE
      await supabase.from('card_prices').insert([{ card_id: card.id, price: average }]);
      await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', card.id);
      
      updatedCount++;

      // ⏱️ Pause de 1 seconde pour eBay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({ success: true, message: `${updatedCount} cartes scannées avec succès.` });

  } catch (error: any) {
    console.error('Erreur Cron Job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}