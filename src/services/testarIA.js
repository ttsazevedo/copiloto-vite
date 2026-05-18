import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

async function testarGemini() {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Responda apenas: OK",
    });
    const text = response.text?.trim();
    console.log(`[Gemini] ✓ Chave válida — resposta: "${text}"`);
  } catch (err) {
    console.log(`[Gemini] ✗ Erro: ${err.message}`);
  }
}

async function testarClaude() {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }
    const json = await resp.json();
    const text = json.content?.[0]?.text?.trim();
    console.log(`[Claude] ✓ Chave válida — resposta: "${text}"`);
  } catch (err) {
    console.log(`[Claude] ✗ Erro: ${err.message}`);
  }
}

export async function testarChavesIA() {
  if (GEMINI_KEY) await testarGemini();
  else console.log('[Gemini] ✗ VITE_GEMINI_API_KEY não definida');

  if (ANTHROPIC_KEY) await testarClaude();
  else console.log('[Claude] ✗ VITE_ANTHROPIC_API_KEY não definida');
}
