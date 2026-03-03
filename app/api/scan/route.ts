import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!image || !apiKey) return NextResponse.json({ error: "Manquant" }, { status: 400 });

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Appel direct v1beta pour éviter le "Model Not Found"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Analyse cette carte. JSON strict: { \"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"numbering_max\": 50 }" },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    return NextResponse.json(JSON.parse(text.match(/\{[\s\S]*\}/)[0]));
  } catch (error) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}