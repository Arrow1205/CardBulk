export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || !mimeType) return res.status(400).json({ error: "Missing image data" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });

  const prompt = `
Analyse cette image de carte de sport.
Retourne UNIQUEMENT un JSON valide avec ces clés :
- "prenom"
- "nom"
- "marque"
- "collection"
Aucun texte avant/après.
`;

  try {
    const models = ["gemini-1.5-flash-002","gemini-1.5-flash-001"];
    let data = null;
    let lastErr = null;

    for (const model of models){
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
          }),
        }
      );

      const txt = await r.text();
      try { data = txt ? JSON.parse(txt) : {}; }
      catch { data = { error: { message: txt || `HTTP ${r.status}` } }; }

      if (!data?.error){ lastErr = null; break; }
      lastErr = data.error.message || `Gemini error (${model})`;
    }

    if (lastErr) return res.status(502).json({ error: lastErr });

    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
