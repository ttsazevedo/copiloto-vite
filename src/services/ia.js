// ─── SERVIÇO DE IA: Gemini (primário) → Claude (fallback) ───

import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const GEMINI_MODEL = 'gemini-3-flash-preview';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

const genai = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

// ─── VALIDAÇÃO DE JSON ───

function validarSessao(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.resumo === 'string' &&
    Array.isArray(obj.temas) &&
    Array.isArray(obj.distorcoes) &&
    Array.isArray(obj.tecnicas) &&
    Array.isArray(obj.emocoes) &&
    Array.isArray(obj.alertas)
  );
}

function validarPlano(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.objetivo === 'string' &&
    Array.isArray(obj.tecnicas) &&
    Array.isArray(obj.perguntas) &&
    Array.isArray(obj.distorcoes_foco) &&
    typeof obj.tarefa === 'string'
  );
}

// ─── EXTRAIR JSON DE TEXTO (suporte a blocos markdown) ───

function extrairJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : text.trim());
}

// ─── PROMPTS ───

function promptExtrairSessao(texto, linha) {
  const exemplosDistorcoes =
    linha === 'tcc'
      ? 'Catastrofização, Leitura mental, Personalização, Generalização, Raciocínio emocional, Pensamento tudo-ou-nada'
      : 'Não aplicável para esta linha';

  return `Você é um assistente clínico especializado em psicoterapia (linha: ${linha}).
Analise as anotações de sessão abaixo e extraia as informações estruturadas.

ANOTAÇÕES:
${texto}

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com esta estrutura:
{
  "resumo": "resumo clínico conciso em 2-3 frases",
  "humor_inicio": null,
  "humor_fim": null,
  "temas": ["temas principais abordados"],
  "distorcoes": ["distorções identificadas${linha === 'tcc' ? ` — use apenas: ${exemplosDistorcoes}` : ''}"],
  "tecnicas": ["técnicas utilizadas na sessão"],
  "emocoes": [{"nome": "nome da emoção", "intensidade": 7}],
  "alertas": [],
  "resultado_tarefa": null,
  "tarefa_proxima": null
}`;
}

function promptGerarPlano(paciente, ultimaSessao) {
  const linha = paciente.linha || 'tcc';
  return `Você é um copiloto clínico para psicólogos especializado em ${linha}.
Gere um plano para a PRÓXIMA sessão com base no histórico do paciente.

PACIENTE: ${paciente.nome}
QUEIXA: ${paciente.queixa || ''}
META: ${paciente.meta || ''}
LINHA TERAPÊUTICA: ${linha}

ÚLTIMA SESSÃO (${ultimaSessao.data || ''}):
Resumo: ${ultimaSessao.resumo || ''}
Temas: ${(ultimaSessao.temas || []).join(', ')}
Distorções: ${(ultimaSessao.distorcoes || []).join(', ')}
Técnicas: ${(ultimaSessao.tecnicas || []).join(', ')}
Tarefa dada: ${ultimaSessao.tarefa_proxima || 'nenhuma'}

Retorne APENAS um JSON válido (sem markdown, sem texto extra):
{
  "objetivo": "objetivo principal da próxima sessão",
  "tecnicas": ["2 a 4 técnicas recomendadas"],
  "perguntas": ["3 a 5 perguntas terapêuticas sugeridas"],
  "distorcoes_foco": ["distorções a trabalhar"],
  "tarefa": "tarefa para o paciente até a próxima sessão",
  "observacoes": ""
}`;
}

// ─── CHAMADAS À API ───

async function chamarGemini(prompt) {
  if (!genai) throw new Error('VITE_GEMINI_API_KEY não configurada');
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });
  const text = response.text;
  if (!text) throw new Error('Gemini retornou resposta vazia');
  return extrairJSON(text);
}

async function chamarClaude(prompt) {
  if (!ANTHROPIC_KEY) throw new Error('VITE_ANTHROPIC_API_KEY não configurada');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error('[Claude] Erro body:', errBody);
    throw new Error(`Claude HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const json = await resp.json();
  const text = json.content?.[0]?.text;
  if (!text) throw new Error('Claude retornou resposta vazia');
  return extrairJSON(text);
}

async function chamarComFallback(prompt, onProviderChange) {
  if (genai) {
    try {
      onProviderChange?.('gemini');
      return { resultado: await chamarGemini(prompt), provider: 'gemini' };
    } catch (errGemini) {
      console.warn('[IA] Gemini falhou, tentando Claude:', errGemini.message);
    }
  }
  onProviderChange?.('claude');
  try {
    return { resultado: await chamarClaude(prompt), provider: 'claude' };
  } catch (errClaude) {
    throw new Error(`Gemini e Claude falharam. Último erro: ${errClaude.message}`);
  }
}

// ─── API PÚBLICA ───

export async function extrairSessaoDeTexto(texto, linha = 'tcc', onProviderChange) {
  const prompt = promptExtrairSessao(texto, linha);
  const { resultado, provider } = await chamarComFallback(prompt, onProviderChange);
  if (!validarSessao(resultado)) {
    throw new Error('IA retornou estrutura de sessão inválida');
  }
  return { sessao: resultado, provider };
}

export async function gerarPlanoSessao(paciente, ultimaSessao, onProviderChange) {
  const prompt = promptGerarPlano(paciente, ultimaSessao);
  const { resultado, provider } = await chamarComFallback(prompt, onProviderChange);
  if (!validarPlano(resultado)) {
    throw new Error('IA retornou estrutura de plano inválida');
  }
  return { plano: resultado, provider };
}
