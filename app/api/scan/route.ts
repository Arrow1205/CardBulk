import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "❌ GEMINI_API_KEY introuvable." });
    if (!image) return NextResponse.json({ error: "❌ Aucune image reçue." });

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // 1. AUTO-DÉCOUVERTE : On demande à Google les modèles auxquels ta clé a droit
    const modelsReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsReq.json();

    let modelName = "gemini-1.5-flash"; // Valeur par défaut

    if (modelsData.models) {
        // On filtre pour trouver un modèle IA capable de lire des images
        const availableModels = modelsData.models.filter((m: any) => 
            m.supportedGenerationMethods?.includes("generateContent") &&
            (m.name.includes("gemini-1.5") || m.name.includes("gemini-pro-vision"))
        );

        if (availableModels.length > 0) {
            // On prend le premier modèle autorisé trouvé par ta clé
            const flash = availableModels.find((m: any) => m.name.includes("flash"));
            modelName = flash ? flash.name.replace("models/", "") : availableModels[0].name.replace("models/", "");
        } else {
            return NextResponse.json({ error: `❌ Ta clé API Google n'a accès à aucun modèle d'image. Crée une nouvelle clé sur Google AI Studio.` });
        }
    }

    // 2. ANALYSE AVEC LE BON MODÈLE
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Tu es un expert en cartes de sport. Analyse cette image. Renvoie UNIQUEMENT un JSON avec ces clés: {\"playerName\": \"Prénom Nom\", \"brand\": \"Marque\", \"series\": \"Collection\", \"year\": 2024, \"is_rookie\": false, \"is_auto\": false, \"is_numbered\": false, \"numbering_max\": 50, \"club\": \"Club\"}" },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: `❌ Google a bloqué le modèle ${modelName}: ${data.error.message}` });
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: `❌ L'IA a répondu avec du texte normal au lieu d'un code : ${text}` });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
    
  } catch (error: any) {
    return NextResponse.json({ error: `❌ Erreur Serveur : ${error.message}` });
  }
}