import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!image || !apiKey) {
      return NextResponse.json({ error: "Image ou Clé API manquante" }, { status: 400 });
    }

    const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Appel direct à l'API REST de Google (plus fiable que le SDK)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Analyse cette carte. Renvoie UNIQUEMENT un JSON: { \"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"series\": \"Collection\", \"year\": 2024, \"is_rookie\": true/false, \"is_auto\": true/false, \"is_numbered\": true/false, \"numbering_max\": 50 }" },
            { inline_data: { mime_type: image.type, data: base64Image } }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
       console.error("Erreur Google API:", data.error);
       return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}