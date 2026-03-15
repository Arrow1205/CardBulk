import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

// On indique explicitement à la librairie d'utiliser ta variable GEMINI_API_KEY
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      system: "Tu es un expert mondial en cartes de sport à collectionner (Soccer, NBA, NFL, etc.) et en investissement (le 'Hobby'). Tu réponds toujours de manière ultra-courte, directe, comme un texto, en utilisant quelques emojis. Tu donnes ton avis tranché sur les joueurs.",
      prompt: prompt,
    });

    return NextResponse.json({ text });
    
  } catch (error) {
    console.error("Erreur IA:", error);
    return NextResponse.json({ error: 'Erreur de connexion à l\'IA' }, { status: 500 });
  }
}