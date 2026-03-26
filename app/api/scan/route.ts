import { NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File;
    const autoCrop = formData.get("auto_crop") === "true"; // On vérifie si l'app demande le recadrage
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !image) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const buffer = await image.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);
    const base64 = imageBuffer.toString("base64");

    const modelName = "gemini-2.5-flash"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // 🚨 PROMPT MAGIQUE : On force Gemini à trouver le VRAI contour physique de la carte
    const prompt = `Tu es un expert en cartes de sport et en vision par ordinateur. 
    MISSION 1 : Analyse l'image et extrais les informations de la carte.
    MISSION 2 : Détecte les VRAIS bords physiques de la carte (ignore la table, les doigts, ou tout autre élément du fond).
    
    Renvoie UNIQUEMENT un JSON strict. 
    Pour la clé "box_2d", donne les coordonnées exactes pour recadrer la carte. C'est un tableau [ymin, xmin, ymax, xmax] de valeurs entre 0.00 et 1.00.
    
    Exemple de format attendu :
    {
      "sport": "FOOTBALL ou BASKETBALL",
      "playerName": "Prénom Nom",
      "club": "Nom du club",
      "brand": "Marque",
      "series": "Collection",
      "year": "2024",
      "is_auto": false,
      "is_patch": false,
      "is_rookie": false,
      "is_numbered": false,
      "num_low": "",
      "num_high": "",
      "box_2d": [0.12, 0.08, 0.88, 0.92]
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

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("Format invalide");

    const parsedData = JSON.parse(jsonMatch[0]);
    let finalBase64 = null;

    // ✂️ DÉCOUPE EXACTE SUR LES COORDONNÉES DE L'IA (Le rectangle rouge !)
    if (autoCrop && parsedData.box_2d && Array.isArray(parsedData.box_2d) && parsedData.box_2d.length === 4) {
      try {
        const [ymin, xmin, ymax, xmax] = parsedData.box_2d;
        const metadata = await sharp(imageBuffer).metadata();
        
        if (metadata.width && metadata.height) {
          // Conversion des pourcentages (0.0 - 1.0) en Pixels
          const left = Math.floor(xmin * metadata.width);
          const top = Math.floor(ymin * metadata.height);
          const width = Math.floor((xmax - xmin) * metadata.width);
          const height = Math.floor((ymax - ymin) * metadata.height);

          // Sécurité mathématique pour éviter que la découpe ne déborde
          const safeLeft = Math.max(0, left);
          const safeTop = Math.max(0, top);
          const safeWidth = Math.min(width, metadata.width - safeLeft);
          const safeHeight = Math.min(height, metadata.height - safeTop);

          if (safeWidth > 50 && safeHeight > 50) {
            // Découpage réel de l'image
            const croppedBuffer = await sharp(imageBuffer)
              .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
              .toBuffer();
            
            // On renvoie l'image détourée sous forme de Base64
            finalBase64 = croppedBuffer.toString("base64");
          }
        }
      } catch (cropErr) {
        console.error("Erreur silencieuse lors de la découpe Sharp :", cropErr);
      }
    }

    // On retourne les infos de la carte + la nouvelle photo découpée
    return NextResponse.json({
      ...parsedData,
      cropped_image_base64: finalBase64 
    });
    
  } catch (error) {
    console.error("Erreur API Scan :", error);
    return NextResponse.json({ error: "Échec de l'analyse" }, { status: 500 });
  }
}