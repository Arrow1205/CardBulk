import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) return NextResponse.json({ error: "Pas d'image" }, { status: 400 });

    // On utilise le nom de modèle le plus stable
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = await image.arrayBuffer();

    const prompt = `Analyse cette carte de collection. 
    Réponds UNIQUEMENT avec un JSON strict :
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
      { inlineData: { data: Buffer.from(imageBuffer).toString("base64"), mimeType: image.type } }
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Erreur Gemini:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}