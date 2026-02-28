export default async function handler(req, res) {
  // Basic CORS (same-origin on Vercel, but helps if Safari does a preflight)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
  }

  const prompt = `
Analyse cette image de carte de sport.
Retourne UNIQUEMENT un JSON valide avec ces clés :
- "prenom"
- "nom"
- "marque"
- "collection"
Aucun texte avant/après.
  `.trim();

  // Model fallback chain (some projects don't expose unversioned aliases)
  const models = ["gemini-1.5-flash-002", "gemini-1.5-flash-001", "gemini-1.5-flash"];

  try {
    let data = null;
    let lastErr = null;

    for (const model of models) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: base64Data } },
                ],
              },
            ],
          }),
        }
      );

      data = await r.json();
      if (!data?.error) {
        lastErr = null;
        break;
      }
      lastErr = data.error?.message || "Gemini error";
    }

    if (lastErr) {
      return res.status(500).json({ error: lastErr });
    }

    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // If Gemini returns something slightly malformed, still return a safe payload
      return res.status(500).json({ error: "Invalid JSON from model", raw });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
