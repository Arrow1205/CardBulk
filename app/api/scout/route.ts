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

    const systemPrompt = `Tu es "Scouty", un agent professionnel spécialisé dans les cartes de sport à collectionner et l'investissement.
Le joueur analysé actuellement est : ${body.playerName}.

RÈGLES ABSOLUES DE TON COMPORTEMENT :
1. Sois extrêmement professionnel, direct et concis. Ne sois pas familier.
2. N'utilise JAMAIS d'emojis dans tes réponses. Aucun.
3. Fais des réponses très courtes (3 phrases maximum). Va droit au but.
4. Si l'utilisateur demande un prix ou une cote : donne des fourchettes réelles si tu les connais, sinon dis clairement "Je ne sais pas". Ne tourne pas autour du pot. Recommande toujours à la fin de vérifier les ventes réussies sur eBay ou 130point pour valider.
5. Refuse poliment de répondre à toute question hors-sujet (qui ne concerne pas les cartes de ce joueur, les prix, ou le Hobby en général).`;

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