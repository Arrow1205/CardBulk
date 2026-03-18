import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  try {
    const { cardId, keywords } = await req.json();
    
    // --- TEST DE CONNEXION ---
    console.log("🚀 APPEL API REÇU POUR :", keywords);
    console.log("🔑 VERIF CLÉ SERPAPI :", process.env.SERPAPI_KEY ? "PRÉSENTE (Début: " + process.env.SERPAPI_KEY.substring(0, 5) + "...)" : "❌ MANQUANTE");
    
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      console.error("❌ ERREUR : La variable SERPAPI_KEY n'est pas configurée dans Vercel !");
      return NextResponse.json({ error: "Clé SerpApi manquante." }, { status: 500 });
    }
    // -------------------------

    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keywords + " ebay sold price")}&api_key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ ERREUR SERPAPI :", data.error);
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    // ... (la suite du code reste la même)