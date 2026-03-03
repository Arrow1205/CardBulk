import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "❌ GEMINI_API_KEY introuvable sur Vercel." });
    if (!image) return NextResponse.json({ error: "❌ Aucune image reçue." });

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // 1. Appel REST direct et forcé sur le modèle flash en v1beta
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Tu es un expert en cartes de sport. Analyse cette image. Renvoie UNIQUEMENT un JSON avec ces clés: {\"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"series\": \"Collection\", \"year\": 2024, \"is_rookie\": false, \"is_auto\": false, \"is_numbered\": false, \"numbering_max\": 50, \"club\": \"Club\"}" },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();

    // 🚨 2. SI GOOGLE REFUSE, ON AFFICHE SON MESSAGE D'ERREUR EXACT
    if (!res.ok || data.error) {
      const msg = data.error?.message || JSON.stringify(data);
      return NextResponse.json({ error: `🚨 Refus de Google : ${msg}` });
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: `❌ L'IA a répondu sans JSON : ${text}` });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
    
  } catch (error: any) {
    return NextResponse.json({ error: `❌ Crash Serveur : ${error.message}` });
  }
}
