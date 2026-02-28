export default async function handler(req, res) {
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
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
        }),
      }
    );

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
