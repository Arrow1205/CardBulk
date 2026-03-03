import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialisation avec la clé API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "Aucune image reçue" }, { status: 400 });
    }

    // Correction du nom du modèle pour éviter le 404
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imageBuffer = await image.arrayBuffer();
    
    const prompt = `Analyse cette carte de collection. 
    Réponds UNIQUEMENT avec un objet JSON strict, sans texte avant ou après, sous ce format :
    {
      "playerName": "Prénom Nom",
      "brand": "Marque",
      "series": "Collection",
      "year": 2024,
      "is_rookie": true,
      "is_auto": false,
      "is_numbered": true,
      "numbering_max": 50
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: Buffer.from(imageBuffer).toString("base64"),
          mimeType: image.type,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Nettoyage du texte pour extraire uniquement le JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("L'IA n'a pas renvoyé un format JSON valide");
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error("Détail erreur API:", error);
    // Renvoie l'erreur précise pour debug
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}