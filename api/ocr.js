export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64Data, mimeType } = req.body;

  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Analyse cette image de carte de sport.
Retourne uniquement un JSON avec :
- prenom
- nom
- marque
- collection
`
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(raw);

    res.status(200).json(parsed);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
