import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

// Cache RSS 30 min pour ne pas re-fetcher à chaque message
let _rssCache: string | null = null;
let _rssCacheAt = 0;

async function getLiveRumorContext(): Promise<string> {
  if (_rssCache && Date.now() - _rssCacheAt < 30 * 60 * 1000) return _rssCache;
  try {
    const res = await fetch(
      'https://news.google.com/rss/search?q=transfert+football+rumeur&hl=fr&gl=FR&ceid=FR:fr',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    );
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const titles: string[] = [];
    for (const item of items.slice(0, 10)) {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      if (title) titles.push(title);
    }
    _rssCache = titles.join('\n');
    _rssCacheAt = Date.now();
    return _rssCache;
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Clé API non configurée.' }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    const body = await req.json();

    if (!body.messages) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const rumorContext = await getLiveRumorContext();

    const collectionSummary = Array.isArray(body.collectionData) && body.collectionData.length > 0
      ? `\nCOLLECTION DE L'UTILISATEUR (${body.collectionData.length} cartes) :\n${JSON.stringify(body.collectionData, null, 2)}`
      : '';

    const systemPrompt = `Tu es "Scouty", un expert reconnu en cartes de sport et en scouting de joueurs.
Tu combines trois domaines d'expertise :
1. Transferts & rumeurs — tu connais le marché des transferts footballistiques et sportifs en temps réel.
2. Marché des cartes — tu connais la valeur des cartes (rookies, autos, parallèles, numérotées), les tendances eBay, et les investissements à fort potentiel.
3. Analyse joueur — tu évalues le potentiel des jeunes talents et des joueurs en rumeur de transfert.

ACTUALITÉS DE TRANSFERT DU JOUR (source : Google Actualités, mises à jour toutes les 30 min) :
${rumorContext || 'Aucune actualité disponible pour le moment.'}
${collectionSummary}

RÈGLES ABSOLUES :
1. Sois expert, direct et concis. 3 à 5 phrases maximum par réponse.
2. Aucun emoji. Jamais.
3. Tutoiement obligatoire.
4. Pour les conseils d'investissement : précise toujours que c'est une analyse, pas une garantie financière.
5. Si l'utilisateur te parle d'un joueur en rumeur de transfert : croise avec les actualités du jour et donne un avis éclairé sur l'impact potentiel sur la valeur de ses cartes.
6. Si l'utilisateur a des cartes de ce joueur (voir COLLECTION) : analyse le delta valeur actuelle vs prix d'achat.
7. Pour les recommandations d'achat : rookie card en priorité, puis auto, puis parallèles numérotées.
8. Si tu ne connais pas une cote précise : dis-le et recommande eBay "Ventes réussies" ou 130point.
9. Refuse poliment toute question hors cartes de sport et transferts.`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: body.messages,
    });

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Scouty crash:', error);
    return NextResponse.json({ error: 'Erreur serveur Scouty.', details: error.message }, { status: 500 });
  }
}
