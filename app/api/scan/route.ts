import { NextResponse } from "next/server";
import sharp from "sharp";
import TYPE_CARTE from '@/data/type-carte.json'; // 📂 Import de ton super dictionnaire

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get("action") as string || "scan"; 
    const imageUrl = formData.get("imageUrl") as string | null;
    const imageFile = formData.get("image") as File | null;
    const autoCrop = formData.get("auto_crop") === "true";

    let imageBuffer: Buffer;

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

    if (action === "proxy") {
        return NextResponse.json({ base64: `data:image/jpeg;base64,${imageBuffer.toString("base64")}` });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 400 });

    // 🧠 PRÉPARATION DU CERVEAU IA : On ne garde que les indices pour économiser les tokens
    const aiVariationsRules: any = {};
    for (const [brand, categories] of Object.entries(TYPE_CARTE)) {
      aiVariationsRules[brand] = {};
      for (const [catName, variations] of Object.entries(categories as any)) {
        aiVariationsRules[brand][catName] = (variations as any[]).map(v => ({
          variation: v.variation_name,
          clues: v.ai_detection_clues
        }));
      }
    }

    const base64 = imageBuffer.toString("base64");
    const modelName = "gemini-1.5-flash"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `Tu es un expert en cartes de sport et en vision par ordinateur. 
    MISSION 1 : Analyse l'image et extrais les informations de la carte.
    MISSION 2 : Détecte les VRAIS bords physiques de la carte (ignore la table, les doigts...).
    MISSION 3 : DÉTECTION EXPERTE DE LA VARIATION.
    
    Voici ton dictionnaire officiel des règles de variations :
    ${JSON.stringify(aiVariationsRules)}
    
    RÈGLES ABSOLUES POUR LA VARIATION :
    1. Identifie d'abord la marque (brand).
    2. Cherche dans le dictionnaire ci-dessus les 'clues' qui correspondent à l'image.
    3. ⚠️ EXCEPTION : Si la variation trouvée est 'Numbered Color Parallels' ou similaire, NE RENVOIE PAS ce nom générique. Renvoie la couleur dominante et la numérotation (ex: 'Red /299' ou 'Gold /10').
    
    RÈGLES STRICTES D'IDENTIFICATION DES VARIATIONS (À LIRE ATTENTIVEMENT) :

1. DÉFINITION D'UNE CARTE "BASE" :
- C'est le design standard de la collection. 
- ATTENTION : Une carte de la marque "Topps Chrome" ou "Finest" est naturellement brillante et métallique. Ce reflet métallique NE FAIT PAS d'elle un "Refractor" ou un "Insert". Si elle n'a pas de bordure de couleur spécifique ou de motif géométrique (wave, mojo), c'est une "Base".
2. DÉFINITION D'UN "INSERT" :
- Un Insert N'EST PAS juste une carte brillante. 
- Un Insert possède un NOM DE SOUS-COLLECTION clairement imprimé avec une typographie spéciale sur le recto (exemples : "The Greats", "Memory Makers", "Summer Signings", "Champion"). Si le seul logo est celui de la marque (ex: "Topps Chrome" ou "Merlin") et de l'équipe, ce N'EST PAS un Insert.

3. DÉFINITION D'UN "REFRACTOR" / "PARALLEL" :
- Ne classe JAMAIS une carte en Refractor/Parallel juste à cause d'un reflet de lumière ou de flash.
- Une vraie "Parallèle" se distingue par :
  A) Une BORDURE DE COULEUR très nette (Bleu, Rouge, Vert, etc.) différente du design de base.
  B) Un MOTIF GÉOMÉTRIQUE holographique dans le fond (carrés, vagues, bulles d'air).
  C) La présence d'un numéro de série imprimé sur la carte (ex: "95/99"). Si tu vois un numéro de série, c'est obligatoirement une variation numérotée, tu dois l'extraire.

4. LA RÈGLE DU DOUTE :
- Si la carte n'a pas de nom de sous-collection écrit en gros (Insert), pas de couleur de bordure évidente (Parallel), et pas de numéro de série, tu DOIS obligatoirement la classer en "Base".

    Renvoie UNIQUEMENT un JSON strict avec ces clés exactes :
    {
      "sport": "FOOTBALL, BASKETBALL, BASEBALL, etc.",
      "playerName": "Prénom Nom",
      "club": "Nom du club",
      "brand": "Marque",
      "series": "Collection",
      "variation": "Nom de la variation ou Couleur /Numéro",
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
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }]
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
        console.error("Erreur silencieuse lors de la découpe Sharp :", cropErr);
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