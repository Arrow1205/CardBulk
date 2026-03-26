import { NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get("action") as string || "scan"; // 'scan', 'edit' ou 'rotate'
    const imageUrl = formData.get("imageUrl") as string | null;
    const imageFile = formData.get("image") as File | null;

    let imageBuffer: Buffer;

    // 1. Récupération de l'image (Bypass de la sécurité CORS)
    if (imageUrl && imageUrl.startsWith('http')) {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
    } else if (imageFile) {
        const arrayBuffer = await imageFile.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
    } else {
        return NextResponse.json({ error: "Aucune image fournie" }, { status: 400 });
    }

    // 🎨 MODE ÉDITION (Luminosité, Contraste, Zoom, Saturation) - Ultra rapide, sans IA
    if (action === "edit") {
        const brightness = parseFloat(formData.get("brightness") as string) / 100 || 1;
        const contrast = parseFloat(formData.get("contrast") as string) / 100 || 1;
        const saturation = parseFloat(formData.get("saturation") as string) / 100 || 1;
        const zoom = parseFloat(formData.get("zoom") as string) || 1;

        let sharpInstance = sharp(imageBuffer);
        const metadata = await sharpInstance.metadata();

        // Application du Zoom (on rogne le centre)
        if (zoom > 1 && metadata.width && metadata.height) {
            const newWidth = Math.floor(metadata.width / zoom);
            const newHeight = Math.floor(metadata.height / zoom);
            const left = Math.floor((metadata.width - newWidth) / 2);
            const top = Math.floor((metadata.height - newHeight) / 2);
            sharpInstance = sharpInstance.extract({ left, top, width: newWidth, height: newHeight });
        }

        // Application des filtres de couleur
        const editedBuffer = await sharpInstance
            .modulate({ brightness, saturation })
            .linear(contrast, -(128 * contrast) + 128) // Formule mathématique pour le contraste
            .jpeg({ quality: 95 })
            .toBuffer();
        
        return NextResponse.json({ cropped_image_base64: editedBuffer.toString("base64") });
    }

    // 🔄 MODE ROTATION
    if (action === "rotate") {
        const rotatedBuffer = await sharp(imageBuffer).rotate(90).jpeg({ quality: 95 }).toBuffer();
        return NextResponse.json({ cropped_image_base64: rotatedBuffer.toString("base64") });
    }

    // 🧠 MODE SCAN (Détection IA + Auto Crop)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 400 });

    const base64 = imageBuffer.toString("base64");
    const modelName = "gemini-2.5-flash"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `Tu es un expert en cartes de sport et en vision par ordinateur. 
    MISSION 1 : Analyse l'image et extrais les informations de la carte.
    MISSION 2 : Détecte les VRAIS bords physiques de la carte (ignore la table ou le fond).
    
    Renvoie UNIQUEMENT un JSON strict. 
    Pour la clé "box_2d", donne les coordonnées exactes pour recadrer la carte sous forme de tableau [ymin, xmin, ymax, xmax] avec des valeurs entre 0.00 et 1.00.
    
    Exemple attendu :
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
            { inline_data: { mime_type: "image/jpeg", data: base64 } }
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

    // Découpage automatique avec Sharp si Gemini a trouvé les bords
    const autoCrop = formData.get("auto_crop") === "true";
    if (autoCrop && parsedData.box_2d && Array.isArray(parsedData.box_2d) && parsedData.box_2d.length === 4) {
      try {
        const [ymin, xmin, ymax, xmax] = parsedData.box_2d;
        const metadata = await sharp(imageBuffer).metadata();
        
        if (metadata.width && metadata.height) {
          const left = Math.max(0, Math.floor(xmin * metadata.width));
          const top = Math.max(0, Math.floor(ymin * metadata.height));
          const width = Math.min(Math.floor((xmax - xmin) * metadata.width), metadata.width - left);
          const height = Math.min(Math.floor((ymax - ymin) * metadata.height), metadata.height - top);

          if (width > 50 && height > 50) {
            const croppedBuffer = await sharp(imageBuffer)
              .extract({ left, top, width, height })
              .toBuffer();
            finalBase64 = croppedBuffer.toString("base64");
          }
        }
      } catch (cropErr) {
        console.error("Erreur découpe :", cropErr);
      }
    }

    return NextResponse.json({
      ...parsedData,
      cropped_image_base64: finalBase64 
    });
    
  } catch (error) {
    console.error("Erreur API Scan :", error);
    return NextResponse.json({ error: "Échec de l'analyse" }, { status: 500 });
  }
}