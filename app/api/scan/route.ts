import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Vérification Clé API
    if (!apiKey) return NextResponse.json({ error: "❌ GEMINI_API_KEY est introuvable sur Vercel." });
    // 2. Vérification Image
    if (!image) return NextResponse.json({ error: "❌ Aucune image reçue par le serveur." });

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Tu es un expert en cartes. Analyse cette image. Renvoie UNIQUEMENT un JSON avec ces clés: {\"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"series\": \"Collection\", \"year\": 2024, \"is_rookie\": false, \"is_auto\": false, \"is_numbered\": false, \"numbering_max\": 50, \"club\": \"Club\"}" },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();

    // 3. Vérification du retour Google
    if (!res.ok || data.error) {
      return NextResponse.json({ error: `❌ Refus de Google: ${data.error?.message || 'Erreur inconnue'}` });
    }

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json({ error: "❌ L'IA a bloqué l'image (sécurité) ou n'a rien trouvé." });
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    // 4. Vérification du format JSON
    if (!jsonMatch) {
      return NextResponse.json({ error: "❌ L'IA a répondu, mais pas au format JSON.", rawText: text });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
    
  } catch (error: any) {
    // 5. Interception du Crash Global (ex: Image trop lourde pour Vercel)
    return NextResponse.json({ error: `❌ Crash Serveur Interne: ${error.message}` });
  }
}