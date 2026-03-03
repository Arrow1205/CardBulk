import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "❌ Clé API introuvable sur Vercel." });
    if (!image) return NextResponse.json({ error: "❌ Aucune image reçue." });

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

<<<<<<< HEAD
    // 🔥 LE COUPABLE EST CORRIGÉ ICI : On utilise le modèle présent dans ta liste !
    const modelName = "gemini-2.5-flash"; 
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
      return NextResponse.json({ error: `❌ Refus de Google: ${data.error.message}` });
=======
    // L'arsenal : on teste les modèles du plus récent au plus ancien
    const modelsToTry = [
      "gemini-2.0-flash",      // Le tout dernier modèle, souvent activé par défaut
      "gemini-flash-latest",   // Le nouvel alias standardisé
      "gemini-1.5-pro",        // Version avancée
      "gemini-1.5-flash",      // Celui qui te bloquait (testé au cas où)
      "gemini-pro-vision"      // L'ancien modèle, très permissif sur les anciennes clés
    ];

    let lastError = "";
    let successfulData = null;

    for (const modelName of modelsToTry) {
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

      // Si Google dit OUI et renvoie une réponse
      if (res.ok && !data.error && data.candidates) {
        successfulData = data;
        console.log(`✅ Succès avec le modèle : ${modelName}`);
        break; // On sort de la boucle, on a notre vainqueur !
      } else {
        // Si Google dit NON, on note l'erreur et on passe au modèle suivant
        lastError = data.error?.message || "Erreur inconnue";
        console.log(`❌ Échec avec ${modelName} : ${lastError}`);
      }
    }

    // Si la boucle est finie et qu'absolument aucun modèle n'a marché
    if (!successfulData) {
      return NextResponse.json({ error: `🚨 Tous les modèles ont été refusés. Dernière erreur de Google : ${lastError}. Vérifie que ta clé API a bien accès au service Generative Language.` });
>>>>>>> 227aa8489b4f391edf357183a99a4bcd9faf167d
    }

    // Traitement de la réponse gagnante
    const text = successfulData.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
<<<<<<< HEAD
      return NextResponse.json({ error: `❌ L'IA a répondu avec du texte normal : ${text}` });
=======
      return NextResponse.json({ error: `❌ L'IA a répondu, mais sans JSON : ${text}` });
>>>>>>> 227aa8489b4f391edf357183a99a4bcd9faf167d
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
    
  } catch (error: any) {
    return NextResponse.json({ error: `❌ Crash Serveur : ${error.message}` });
  }
}
