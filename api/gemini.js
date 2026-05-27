// api/gemini.js — Proxy serverless unificado (Gemini + Claude)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, prompt, model } = req.body ?? {};

  if (!provider || !prompt) {
    return res.status(400).json({ error: 'provider e prompt são obrigatórios' });
  }
  if (provider !== 'gemini' && provider !== 'claude') {
    return res.status(400).json({ error: 'provider deve ser "gemini" ou "claude"' });
  }

  try {
    let text;

    if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor' });

      const geminiModel = model ?? 'gemini-1.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`;

      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json({ error: err });
      }

      const data = await upstream.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(502).json({ error: 'Gemini retornou resposta vazia' });

    } else {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });

      const claudeModel = model ?? 'claude-sonnet-4-6';

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json({ error: err });
      }

      const data = await upstream.json();
      text = data.content?.[0]?.text;
      if (!text) return res.status(502).json({ error: 'Claude retornou resposta vazia' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('[proxy] Erro interno:', err);
    return res.status(500).json({ error: 'Erro interno no proxy' });
  }
}
