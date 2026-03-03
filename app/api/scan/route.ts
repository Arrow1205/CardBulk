import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Utilisation de la clé API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) return NextResponse.json({ error: "Pas d'image" }, { status: 400 });

    // On force l'utilisation du modèle flash le plus récent
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const imageBuffer = await image.arrayBuffer();

    const prompt = `Analyse cette carte de sport. Renvoie UNIQUEMENT un JSON :
    {
      "playerName": "Prénom Nom",
      "brand": "Marque",
      "series": "Collection",
      "year": 2024,
      "is_rookie": true/false,
      "is_auto": true/false,
      "is_numbered": true/false,
      "numbering_max": 50
    }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: Buffer.from(imageBuffer).toString("base64"), mimeType: image.type } }
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    
    // Tentative d'extraction du JSON au cas où il y aurait du texte parasite
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const finalJson = text.substring(jsonStart, jsonEnd);

    return NextResponse.json(JSON.parse(finalJson));
  } catch (error: any) {
    console.error("Erreur Gemini:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}