import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) return NextResponse.json({ error: "Pas d'image" }, { status: 400 });

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
      { inlineData: { data: Buffer.from(imageBuffer).toString("base64"), mimeType: image.type } }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // NETTOYAGE CRUCIAL : Enlève les balises ```json ou le texte parasite
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Format JSON non trouvé");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error("Erreur API Scan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}