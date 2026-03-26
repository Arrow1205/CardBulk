import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !image) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const modelName = "gemini-2.5-flash"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `Tu es un expert en cartes de sport. Analyse cette image. 
    Renvoie UNIQUEMENT un JSON strict avec ces clés exactes : 
    {
      "sport": "FOOTBALL ou BASKETBALL",
      "playerName": "Prénom Nom du joueur",
      "club": "Nom du club ou de l'équipe",
      "brand": "Marque (ex: TOPPS, PANINI)",
      "series": "Collection (ex: CHROME, PRIZM)",
      "year": "2024",
      "is_auto": false,
      "is_patch": false,
      "is_rookie": false,
      "is_numbered": false,
      "num_low": "numéro de la carte si numérotée (ex: 5)",
      "num_high": "numérotation max (ex: 50)"
    }`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("Format invalide");

    return NextResponse.json(JSON.parse(jsonMatch[0]));
    
  } catch (error) {
    console.error("Erreur API Scan Silencieuse");
    return NextResponse.json({ error: "Échec de l'analyse" }, { status: 500 });
  }
}
