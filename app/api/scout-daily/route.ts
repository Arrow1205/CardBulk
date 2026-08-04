import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import webpush from 'web-push';
import { normText } from '@/lib/checklistMatching';
import { buildEbayKeywords } from '@/lib/ebay-keywords';
import { fetchSoldPrices, medianPrice } from '@/lib/fetch-sold-prices';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── Config VAPID ───────────────────────────────────────────────────────────
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// ── Types ──────────────────────────────────────────────────────────────────
interface TransferRumor {
  player: string;
  from_club: string;
  to_club: string;
  confidence: number;
  sport: string;
}

interface CardWithPrice {
  id: string;
  firstname: string;
  lastname: string;
  brand: string;
  series: string;
  variation: string;
  year: string;
  sport: string;
  is_auto: boolean;
  is_patch: boolean;
  is_numbered: boolean;
  numbering_max: string | null;
  is_graded: boolean;
  grading_grade: string | null;
  purchase_price: number;
  currentPrice: number | null;
  delta: number | null;
}

// ── TEMPS 1 : Récupère les rumeurs depuis Google News RSS ──────────────────
async function fetchTransferRumors(): Promise<TransferRumor[]> {
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

  const queries = [
    'transfert+football+rumeur',
    'transfer+rumor+soccer',
  ];

  const rssItems: string[] = [];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      );
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 15)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
          || item.match(/<description>(.*?)<\/description>/)?.[1] || '';
        if (title) rssItems.push(`${title} — ${desc.slice(0, 120)}`);
      }
    } catch { /* ignore timeout */ }
  }

  if (rssItems.length === 0) return [];

  const prompt = `Voici des titres d'actualité sur les transferts sportifs.
Extrais les rumeurs de transfert les plus importantes.
Pour chaque rumeur retourne UNIQUEMENT un tableau JSON (sans markdown) avec les champs :
player (nom complet), from_club, to_club, confidence (0-100 entier), sport (SOCCER/BASKETBALL/etc.)

Inclus SEULEMENT les rumeurs avec confidence >= 60. Maximum 5 rumeurs.

Titres :
${rssItems.slice(0, 25).join('\n')}

Réponds UNIQUEMENT avec un tableau JSON valide, exemple :
[{"player":"Kylian Mbappé","from_club":"Real Madrid","to_club":"Arsenal","confidence":75,"sport":"SOCCER"}]`;

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as TransferRumor[];
  } catch {
    return [];
  }
}

// ── TEMPS 2 : Croise rumeurs × collection utilisateur + prix eBay ──────────
async function analyzeUserCollection(
  sb: any,
  userId: string,
  rumors: TransferRumor[]
): Promise<{
  toSell: CardWithPrice[];
  buyRecs: { rumor: TransferRumor; reason: string }[];
}> {
  const { data: cards } = await sb
    .from('cards')
    .select('id, firstname, lastname, brand, series, variation, year, sport, is_auto, is_patch, is_numbered, numbering_max, is_graded, grading_grade, purchase_price')
    .eq('user_id', userId)
    .eq('is_wishlist', false)
    .gt('purchase_price', 0);

  const userCards: any[] = cards || [];
  const toSell: CardWithPrice[] = [];
  const buyRecs: { rumor: TransferRumor; reason: string }[] = [];

  for (const rumor of rumors) {
    const normRumorPlayer = normText(rumor.player);

    // Cartes du joueur en rumeur dans la collection
    const matchingCards = userCards.filter(card => {
      const full = normText(`${card.firstname} ${card.lastname}`);
      const rev  = normText(`${card.lastname} ${card.firstname}`);
      return full === normRumorPlayer || rev === normRumorPlayer
        || full.includes(normRumorPlayer) || normRumorPlayer.includes(full);
    });

    if (matchingCards.length > 0) {
      // Fetch eBay price pour chaque carte du joueur
      for (const card of matchingCards) {
        const keywords = buildEbayKeywords(card);
        let currentPrice: number | null = null;
        try {
          const prices = await fetchSoldPrices(keywords);
          currentPrice = medianPrice(prices);
          if (currentPrice) {
            await (sb as any).from('card_prices').insert([{ card_id: card.id, price: currentPrice }]);
          }
        } catch { /* continue sans prix */ }

        const delta = currentPrice && card.purchase_price > 0
          ? Math.round(((currentPrice - card.purchase_price) / card.purchase_price) * 100)
          : null;

        if (delta !== null && delta >= 30) {
          toSell.push({ ...card, currentPrice, delta });
        }
      }
    } else {
      // Joueur non possédé → recommandation d'achat
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
      try {
        const { text } = await generateText({
          model: google('gemini-2.5-flash'),
          prompt: `${rumor.player} est lié à un transfert de ${rumor.from_club} vers ${rumor.to_club} (confiance ${rumor.confidence}%).
En 2 phrases maximum, explique pourquoi ses cartes pourraient prendre de la valeur et quel type de carte acheter en priorité (rookie, base, auto...). Pas d'emoji.`,
        });
        buyRecs.push({ rumor, reason: text.trim() });
      } catch { /* ignore */ }
    }
  }

  return { toSell, buyRecs };
}

// ── TEMPS 3 : Envoie la notification push ─────────────────────────────────
async function sendPushNotification(
  subscription: any,
  rumors: TransferRumor[],
  toSell: CardWithPrice[],
  buyRecs: { rumor: TransferRumor; reason: string }[]
): Promise<void> {
  const rumorLines = rumors
    .slice(0, 5)
    .map(r => `${r.player} → ${r.to_club} (${r.confidence}%)`)
    .join('\n');

  const sellLines = toSell.length > 0
    ? toSell.map(c => `${c.firstname} ${c.lastname} ${c.series} — +${c.delta}%`).join('\n')
    : 'Aucune carte à vendre aujourd\'hui';

  const buyLines = buyRecs.length > 0
    ? buyRecs.map(b => `${b.rumor.player} → ${b.rumor.to_club}`).join('\n')
    : '';

  const bodyParts = [
    rumors.length > 0 ? `Rumeurs :\n${rumorLines}` : '',
    `Vendre maintenant :\n${sellLines}`,
    buyLines ? `A acheter :\n${buyLines}` : '',
  ].filter(Boolean);

  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'Scouty — Les actus des cartes',
    body: bodyParts.join('\n\n'),
    icon: '/asset/scouty.svg',
    url: '/collection?tab=scouty',
  }));
}

// ── Handler cron ───────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const report = { rumors: 0, notifsSent: 0, errors: [] as string[] };

  // TEMPS 1 — Rumeurs
  const rumors = await fetchTransferRumors();
  report.rumors = rumors.length;

  if (rumors.length === 0) {
    return NextResponse.json({ ok: true, ...report, message: 'Pas de rumeurs aujourd\'hui' });
  }

  // Récupère toutes les subscriptions push actives
  const { data: subs } = await sb.from('push_subscriptions').select('user_id, subscription');

  for (const sub of subs || []) {
    try {
      // TEMPS 2 — Analyse collection utilisateur
      const { toSell, buyRecs } = await analyzeUserCollection(sb, sub.user_id, rumors);

      // TEMPS 3 — Notification
      await sendPushNotification(sub.subscription, rumors, toSell, buyRecs);
      report.notifsSent++;
    } catch (e: any) {
      report.errors.push(`user ${sub.user_id}: ${e.message}`);
      // Supprime les subscriptions expirées
      if (e.statusCode === 410) {
        await sb.from('push_subscriptions').delete().eq('user_id', sub.user_id);
      }
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
