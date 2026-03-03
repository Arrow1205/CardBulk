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

    // Appel REST direct à l'API v1beta (plus flexible sur les noms de modèles)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Analyse cette carte. Renvoie UNIQUEMENT un JSON: { \"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"series\": \"Collection\", \"year\": 2024, \"is_rookie\": true, \"is_auto\": false, \"is_numbered\": true, \"numbering_max\": 50, \"club\": \"Club\" }" },
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

    const rawText = data.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("Format JSON non détecté");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error("Erreur API Scan:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}