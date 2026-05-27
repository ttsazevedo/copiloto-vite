const PROMPT_TESTE = 'Responda apenas: OK';

async function testarGemini() {
  try {
    const resp = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', prompt: PROMPT_TESTE }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`HTTP ${resp.status}: ${JSON.stringify(err).slice(0, 200)}`);
    }
    const { text } = await resp.json();
    console.log(`[Gemini] ✓ Proxy OK — resposta: "${text?.trim()}"`);
  } catch (err) {
    console.log(`[Gemini] ✗ Erro: ${err.message}`);
  }
}

async function testarClaude() {
  try {
    const resp = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', prompt: PROMPT_TESTE }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`HTTP ${resp.status}: ${JSON.stringify(err).slice(0, 200)}`);
    }
    const { text } = await resp.json();
    console.log(`[Claude] ✓ Proxy OK — resposta: "${text?.trim()}"`);
  } catch (err) {
    console.log(`[Claude] ✗ Erro: ${err.message}`);
  }
}

export async function testarChavesIA() {
  await testarGemini();
  await testarClaude();
}
