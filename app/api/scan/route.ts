import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { imageBase64 } = await req.json();

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = "Analyse cette carte de sport. Donne-moi uniquement un JSON avec: player_name, team_name, sport, brand (Topps/Panini), series, year, is_rookie (boolean).";

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
  ]);

  const response = await result.response;
  return NextResponse.json(JSON.parse(response.text()));
}