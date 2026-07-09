import { NextResponse } from "next/server";
import sharp from "sharp";
import TYPE_CARTE from '@/data/type-carte.json';
import SET_DATA from '@/data/sets.json';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = formData.get("action") as string || "scan"; 
    const imageUrl = formData.get("imageUrl") as string | null;
    const imageFile = formData.get("image") as File | null;
    const autoCrop = formData.get("auto_crop") === "true";
    const examplesRaw = formData.get("examples") as string | null;
    let fewShotExamples: any[] = [];
    if (examplesRaw) {
      try { fewShotExamples = JSON.parse(examplesRaw); } catch {}
    }

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

    // 🧠 PRÉPARATION DES RÈGLES IA
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

    // Dictionnaire visual_hints + common_subsets par marque/série
    const setsReference: any = {};
    for (const brand of (SET_DATA.brands || []) as any[]) {
      setsReference[brand.name] = {};
      if (brand.sports) {
        for (const sets of Object.values(brand.sports) as any[][]) {
          for (const set of sets) {
            setsReference[brand.name][set.name] = {
              visual_hints: set.visual_hints,
              common_subsets: set.common_subsets
            };
          }
        }
      }
    }

    const base64 = imageBuffer.toString("base64");

    const fewShotSection = fewShotExamples.length > 0
      ? `\n    EXEMPLES DE CARTES DÉJÀ VALIDÉES PAR L'UTILISATEUR (utilise ces confirmations pour affiner tes réponses) :\n${fewShotExamples.map((ex: any, i: number) => `    Exemple ${i + 1} : brand="${ex.brand}", series="${ex.series}", variation="${ex.variation}", sport="${ex.sport}", year="${ex.year}", is_auto=${ex.is_auto}, is_patch=${ex.is_patch}, is_rookie=${ex.is_rookie}, is_numbered=${ex.is_numbered}`).join('\n')}\n`
      : '';

    const prompt = `Tu es un expert en cartes de sport et en vision par ordinateur.
    MISSION 1 : Analyse l'image et extrais les informations de la carte.
    MISSION 2 : Détecte les VRAIS bords physiques de la carte (ignore la table, les doigts...).
    MISSION 3 : DÉTECTION EXPERTE DE LA VARIATION (SUBSET) — PRIORITÉ ABSOLUE AU DICTIONNAIRE.

    Dictionnaire 1 — Règles visuelles de variation par marque (TYPE_CARTE) :
    ${JSON.stringify(aiVariationsRules)}

    Dictionnaire 2 — Références visuelles et subsets officiels par série (SETS) :
    ${JSON.stringify(setsReference)}
    ${fewShotSection}
    PROCESSUS OBLIGATOIRE POUR LE CHAMP "variation" — SUIS CES ÉTAPES DANS L'ORDRE :

    ÉTAPE 1 — Identifie la marque (brand) et la série (series) visibles sur la carte.

    ÉTAPE 2 — Cherche IMMÉDIATEMENT cette combinaison marque+série dans le Dictionnaire 2.
      Essaie toutes les variantes de casse (ex : "Panini", "PANINI", "panini" → c'est la même chose).
      Cherche aussi par correspondance partielle si le nom exact n'est pas trouvé (ex : "Chrome UCL" → cherche "Chrome").

    ÉTAPE 3 — SI la marque+série EST trouvée dans le Dictionnaire 2 :
      → Examine la liste common_subsets disponible pour cette série.
      → Analyse visuellement la carte (texte imprimé, design, badge, position dans le set, style graphique).
      → Retourne EXACTEMENT l'une des valeurs de common_subsets — celle qui correspond le mieux visuellement.
      → INTERDIT d'inventer une valeur absente de common_subsets dans ce cas.

    ÉTAPE 4 — SI la marque+série N'EST PAS dans le Dictionnaire 2 :
      → Utilise le Dictionnaire 1 (indices visuels par marque) pour déduire le subset.
      → Utilise aussi tes connaissances générales sur les cartes sportives.
      → Retourne librement le subset au format "CATÉGORIE / SECTION" en MAJUSCULES.

    ÉTAPE 5 — CAS PARTICULIER PARALLÈLES (prioritaire sur les étapes 3 et 4) :
      → Si la carte porte une couleur distinctive (Gold, Silver, Red, Blue, Green, Black, etc.) avec ou sans numérotation visible, c'est un parallèle.
      → Retourne "PARALLEL / [Couleur] [/Numérotation si visible]" ex : "PARALLEL / Gold /10", "PARALLEL / Red /25".
      → Cette règle s'applique MÊME si la marque+série est dans le Dictionnaire 2.

    ÉTAPE 6 — RÈGLE DU DOUTE ABSOLU :
      → Si aucun indice distinctif n'est visible ET que la série est absente du Dictionnaire 2, retourne "BASE".

    Renvoie UNIQUEMENT un JSON strict avec ces clés exactes :
    {
      "sport": "SOCCER, BASKETBALL, etc.",
      "playerName": "Prénom Nom",
      "club": "Nom du club",
      "brand": "Marque",
      "series": "Collection",
      "variation": "Variation ou Couleur /Numéro",
      "year": "2024",
      "is_auto": false,
      "is_patch": false,
      "is_rookie": false,
      "is_numbered": false,
      "num_low": "",
      "num_high": "",
      "box_2d": [ymin, xmin, ymax, xmax]
    }`;

    // 🚀 CONFIGURATION DE L'APPEL
    const bodyConfig = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }]
    };

    // 🚀 ESSAI 1 : Modèle Stable (2.5 Flash)
    let modelName = "gemini-2.5-flash";
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    let res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyConfig)
    });

    let data = await res.json();

    // 🚀 ESSAI 2 : Modèle Lite (si le 2.5 Flash est saturé en 503)
    if (data.error && data.error.code === 503) {
      console.warn(`⚠️ High Demand sur ${modelName}. Tentative avec gemini-2.5-flash-lite...`);
      modelName = "gemini-2.5-flash-lite";
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyConfig)
      });
      data = await res.json();
    }

    // 🚨 GESTION DES ERREURS FINALES
    if (data.error) {
      console.error("🚨 ERREUR GOOGLE ORIGINALE :", JSON.stringify(data.error, null, 2));
      throw new Error(`Erreur Google (${data.error.code}) : ${data.error.message}`);
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("Format JSON invalide reçu de l'IA");

    const parsedData = JSON.parse(jsonMatch[0]);
    let finalBase64 = null;

    // ✂️ DÉCOUPE AUTO AVEC SHARP
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
        console.error("Erreur Sharp :", cropErr);
      }
    }

    return NextResponse.json({
      ...parsedData,
      cropped_image_base64: finalBase64 
    });
    
  } catch (error: any) {
    console.error("Erreur API Scan :", error);
    return NextResponse.json({ error: error.message || "Échec de l'analyse" }, { status: 500 });
  }
}