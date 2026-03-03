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

    const prompt = `Analyse cette carte de collection et renvoie UNIQUEMENT un JSON :
    {
      "playerName": "Prénom Nom",
      "brand": "Marque (ex: Topps, Panini)",
      "series": "Collection (ex: Chrome, Prizm)",
      "year": 2024,
      "is_rookie": true/false,
      "is_auto": true/false,
      "is_numbered": true/false,
      "numbering_max": 50 (si écrit 1/50, sinon null)
    }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: Buffer.from(imageBuffer).toString("base64"), mimeType: image.type } }
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "");
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Échec de l'analyse" }, { status: 500 });
  }
}