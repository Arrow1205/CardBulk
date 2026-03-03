import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 30; // Force Vercel à tenir 30s (indispensable pour l'IA)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("ERREUR: Clé GEMINI_API_KEY manquante dans Vercel");
      return NextResponse.json({ error: "Clé API non configurée" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const formData = await req.formData();
    const image = formData.get("image") as File;

    if (!image) return NextResponse.json({ error: "Image manquante" }, { status: 400 });

    const bytes = await image.arrayBuffer();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyse cette carte. Renvoie UNIQUEMENT un JSON: {"playerName": "NOM", "brand": "MARQUE", "series": "SET", "year": "ANNEE", "is_rookie": false, "is_auto": false, "is_numbered": false, "numbering_max": null}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: Buffer.from(bytes).toString("base64"), mimeType: image.type } }
    ]);

    const text = result.response.text().replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Détail Erreur Gemini:", error);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}