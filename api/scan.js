// Vercel Serverless Function: /api/scan
// Nimmt ein Foto (Base64) entgegen, ruft die Anthropic API auf und schickt
// eine grobe Kalorien-/Makro-Schätzung zurück. Der API-Key bleibt serverseitig
// (Umgebungsvariable ANTHROPIC_API_KEY) und ist nie im Frontend sichtbar.

export default async function handler(req, res) {
  // CORS – bei Bedarf auf deine eigene Domain einschränken statt "*"
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt' });

  const { image, mediaType } = req.body || {};
  if (!image || !mediaType) {
    return res.status(400).json({ error: 'Bild (Base64) und mediaType erforderlich' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server nicht konfiguriert (ANTHROPIC_API_KEY fehlt)' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // günstiger: 'claude-haiku-4-5-20251001'
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              {
                type: 'text',
                text:
                  'Schau dir das Foto einer Mahlzeit an. Schätze grob: 1) welche Lebensmittel zu ' +
                  'sehen sind, 2) geschätzte Gesamtkalorien (als Bereich, z.B. 500-650 kcal), ' +
                  '3) grobe Makros (Eiweiß/Kohlenhydrate/Fett in g). Antworte kurz in 4-6 Zeilen ' +
                  'auf Deutsch, ohne Diät-Ratschläge, nur die Schätzung.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Anthropic API Fehler', detail: errText });
    }

    const data = await response.json();
    const text = data.content?.find((b) => b.type === 'text')?.text || 'Keine Antwort erhalten.';
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: 'Serverfehler', detail: String(err) });
  }
}
