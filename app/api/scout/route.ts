import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("🚨 ERREUR CRITIQUE : La variable GEMINI_API_KEY est introuvable dans Vercel !");
      return NextResponse.json({ error: "La clé API Gemini n'est pas configurée sur ce serveur." }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const body = await req.json();
    
    if (!body.prompt) {
      return NextResponse.json({ error: "La question (prompt) est vide." }, { status: 400 });
    }

    // On utilise le nom exact du modèle avec "-latest"
    const { text } = await generateText({
      model: google('gemini-1.5-flash-latest'),
      system: "Tu es un expert mondial en cartes de sport à collectionner (Soccer, NBA, NFL, etc.) et en investissement (le 'Hobby'). Tu réponds toujours de manière ultra-courte, directe, comme un texto, en utilisant quelques emojis. Tu donnes ton avis tranché sur les joueurs.",
      prompt: body.prompt,
    });

    return NextResponse.json({ text });
    
  } catch (error: any) {
    console.error("🚨 CRASH IA :", error);
    return NextResponse.json({ 
      error: "Le serveur IA a planté.", 
      details: error.message || String(error) 
    }, { status: 500 });
  }
}