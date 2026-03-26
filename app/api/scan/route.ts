import { NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const autoCrop = formData.get("auto_crop") === "true"; // Détecte si le front demande un recadrage
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !image) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    // 1. Préparation de l'image brute
    const buffer = await image.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);
    const base64 = imageBuffer.toString("base64");

    const modelName = "gemini-2.5-flash"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // 2. Le Prompt Magique (On demande les coordonnées de la carte)
    const prompt = `Tu es un expert en cartes de sport. Analyse cette image. 
    Trouve la carte physique et donne-moi ses coordonnées exactes (bounding box) pour la recadrer, en ignorant le fond/la table. Les coordonnées doivent être des pourcentages de l'image entre 0.0 et 1.0 (ymin = bord haut, xmin = bord gauche, ymax = bord bas, xmax = bord droit).
    Renvoie UNIQUEMENT un JSON strict avec ces clés exactes : 
    {
      "sport": "FOOTBALL ou BASKETBALL",
      "playerName": "Prénom Nom du joueur",
      "club": "Nom du club ou de l'équipe",
      "brand": "Marque (ex: TOPPS, PANINI)",
      "series": "Collection (ex: CHROME, PRIZM)",
      "year": "2024",
      "is_auto": false,
      "is_patch": false,
      "is_rookie": false,
      "is_numbered": false,
      "num_low": "numéro de la carte si numérotée (ex: 5)",
      "num_high": "numérotation max (ex: 50)",
      "boundingBox": {
        "ymin": 0.10,
        "xmin": 0.15,
        "ymax": 0.90,
        "xmax": 0.85
      }
    }`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: image.type, data: base64 } }
          ]
        }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // 3. Extraction du JSON renvoyé par Gemini
    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("Format invalide");

    const parsedData = JSON.parse(jsonMatch[0]);
    let finalBase64 = null;

    // ✂️ 4. AUTO-CROP IA (La magie opère ici) ✂️
    if (autoCrop && parsedData.boundingBox) {
      try {
        const { ymin, xmin, ymax, xmax } = parsedData.boundingBox;
        const metadata = await sharp(imageBuffer).metadata();
        
        if (metadata.width && metadata.height) {
          // Conversion des pourcentages (0.0 à 1.0) en vrais Pixels
          const left = Math.max(0, Math.floor(xmin * metadata.width));
          const top = Math.max(0, Math.floor(ymin * metadata.height));
          let width = Math.floor((xmax - xmin) * metadata.width);
          let height = Math.floor((ymax - ymin) * metadata.height);

          // Sécurité anti-débordement
          width = Math.min(width, metadata.width - left);
          height = Math.min(height, metadata.height - top);

          if (width > 0 && height > 0) {
            // Découpage de l'image avec Sharp
            const croppedBuffer = await sharp(imageBuffer)
              .extract({ left, top, width, height })
              .toBuffer();
            
            // On convertit l'image détourée en Base64 pour l'application
            finalBase64 = croppedBuffer.toString("base64");
          }
        }
      } catch (cropErr) {
        console.error("Erreur lors du recadrage Sharp :", cropErr);
        // Si le crop échoue, on ne crashe pas, on renverra juste le JSON normal
      }
    }

    // 5. On renvoie les données + la nouvelle image détourée !
    return NextResponse.json({
      ...parsedData,
      cropped_image_base64: finalBase64 
    });
    
  } catch (error) {
    console.error("Erreur API Scan Silencieuse", error);
    return NextResponse.json({ error: "Échec de l'analyse" }, { status: 500 });
  }
}