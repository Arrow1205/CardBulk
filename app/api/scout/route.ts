import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Clé API non configurée." }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const body = await req.json();
    
    if (!body.messages || !body.playerName) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Le prompt système qui intègre maintenant TES données de collection
    const systemPrompt = `Tu es "Scouty", un assistant expert en sports et en cartes de collection sportives.
Tu combines des données de performance sportive avec la valeur et la rareté
des cartes de joueurs. Tu es concis, précis et professionnel, avec un ton accessible et sympathique. précise également que tu peux faire des erreurs.
Le joueur analysé actuellement est : ${body.playerName}.

Voici la liste exacte des cartes de ce joueur que l'utilisateur possède actuellement dans sa collection, avec les prix d'achat qu'il a payés :
${JSON.stringify(body.collectionData, null, 2)}

RÈGLES ABSOLUES DE TON COMPORTEMENT :
1. Sois extrêmement professionnel, direct et concis. Ne sois pas familier (mais tu tutoie).
2. N'utilise JAMAIS d'emojis dans tes réponses. Aucun.
3. Fais des réponses très courtes (3 phrases maximum). Va droit au but.
4. ANALYSE DE PRIX : Si l'utilisateur demande s'il a payé cher, compare les prix d'achat fournis dans la liste avec tes connaissances du marché. Sois honnête. Si un prix te semble bon ou mauvais, dis-le. 
5. COMPLÉTION ET RAINBOW : Si l'utilisateur demande ce qu'il lui manque (ex: pour un Rainbow), regarde la série/marque des cartes qu'il possède dans la liste fournie et cite les parallèles (couleurs/numérotations) majeures manquantes pour ce set précis.
6. Si tu ne connais pas la cote actuelle exacte pour vérifier le prix, dis "Je ne sais pas" et recommande de vérifier les "Ventes réussies" sur eBay ou 130point.
7. Refuse poliment de répondre à toute question hors-sujet.
8. Tutoiement autorisé;`;


    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: body.messages,
    });

    return NextResponse.json({ text });
    
  } catch (error: any) {
    console.error("🚨 CRASH IA :", error);
    return NextResponse.json({ error: "Le serveur IA a planté.", details: error.message }, { status: 500 });
  }
}