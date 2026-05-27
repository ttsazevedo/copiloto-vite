// ─── SERVIÇO DE IA: Gemini (primário) → Claude (fallback) ───

const GEMINI_MODEL = 'gemini-2.0-flash';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

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
    typeof obj.tarefa === 'string' &&
    (Array.isArray(obj.perguntas) || Array.isArray(obj.fluxoSocratico))
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

// ─── HELPERS PARA PROMPT DE PLANO ───

function getNomeLinha(linha) {
  const nomes = {
    tcc: 'Terapia Cognitivo-Comportamental (TCC)',
    psicanalise: 'Psicanálise',
    gestalt: 'Gestalt-terapia',
    junguiana: 'Psicologia Analítica Junguiana',
    humanista: 'Abordagem Centrada na Pessoa (ACP)',
    comportamental: 'Análise do Comportamento (ABA/ACT)',
  };
  return nomes[linha] || linha || 'abordagem não especificada';
}

function formatarSessaoParaPrompt(s, indice) {
  const label = indice === 0 ? 'SESSÃO MAIS RECENTE' : `SESSÃO ANTERIOR ${indice}`;
  return `--- ${label} | Sessão nº${s.numero ?? '?'} | Data: ${s.data ?? 'não informada'} ---
Resumo clínico: ${s.resumo || 'Não registrado'}
Temas trabalhados: ${(s.temas || []).join(', ') || 'Não registrado'}
Distorções identificadas: ${(s.distorcoes || []).join(', ') || 'Nenhuma'}
Técnicas utilizadas: ${(s.tecnicas || []).join(', ') || 'Nenhuma'}
Emoções (início → fim da sessão): ${s.humor_inicio ?? '?'}/10 → ${s.humor_fim ?? '?'}/10
Tarefa prescrita nesta sessão: ${s.tarefa_proxima || 'Nenhuma'}
Resultado da tarefa anterior: ${s.resultado_tarefa || 'Não registrado'}
Alertas clínicos: ${(s.alertas || []).join(', ') || 'Nenhum'}`.trim();
}

// ─── CHAMADAS À API ───

async function chamarGemini(prompt) {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'gemini', prompt, model: GEMINI_MODEL }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Gemini HTTP ${resp.status}: ${JSON.stringify(err).slice(0, 200)}`);
  }
  const { text } = await resp.json();
  if (!text) throw new Error('Gemini retornou resposta vazia');
  return extrairJSON(text);
}

async function chamarClaude(prompt) {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'claude', prompt, model: CLAUDE_MODEL }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Claude HTTP ${resp.status}: ${JSON.stringify(err).slice(0, 200)}`);
  }
  const { text } = await resp.json();
  if (!text) throw new Error('Claude retornou resposta vazia');
  return extrairJSON(text);
}

async function chamarComFallback(prompt, onProviderChange) {
  try {
    onProviderChange?.('gemini');
    return { resultado: await chamarGemini(prompt), provider: 'gemini' };
  } catch (errGemini) {
    console.warn('[IA] Gemini falhou, tentando Claude:', errGemini.message);
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

export async function gerarPlanoSessao(paciente, sessoesInput, janelaContexto = 3, onProviderChange) {
  const janela = Math.min(janelaContexto || 3, 5);
  const sessoes = Array.isArray(sessoesInput)
    ? sessoesInput.slice(0, janela)
    : [sessoesInput].filter(Boolean);

  const nSessoes = sessoes.length;

  const blocoSessoes = sessoes.map(formatarSessaoParaPrompt).join('\n\n');

  const todasDistorcoes = sessoes.flatMap(s => s.distorcoes || []);
  const distorcoesRecorrentes = [...new Set(
    todasDistorcoes.filter(d => todasDistorcoes.filter(x => x === d).length > 1)
  )];

  const todosTemas = sessoes.flatMap(s => s.temas || []);
  const temasRecorrentes = [...new Set(
    todosTemas.filter(t => todosTemas.filter(x => x === t).length > 1)
  )];

  const evolucaoHumor = sessoes
    .map(s => s.humor_fim ?? null)
    .filter(v => v !== null)
    .join(' → ');

  const tarefasResultado = sessoes
    .filter(s => s.resultado_tarefa)
    .map(s => `Sessão ${s.numero}: ${s.resultado_tarefa}`)
    .join(' | ');

  const prompt = `Você é um copiloto clínico especializado em ${getNomeLinha(paciente.linha)}.
Sua função é ajudar o terapeuta a preparar a PRÓXIMA sessão com base no histórico longitudinal do paciente.
Você é um assistente de preparação pré-sessão — não conduz sessões, não diagnostica, não prescreve.

## PERFIL DO PACIENTE
Nome: ${paciente.nome}
Queixa principal: ${paciente.queixa || 'Não informada'}
Diagnóstico (se registrado): ${paciente.diagnostico || 'Não fechado ainda'}
Abordagem terapêutica: ${getNomeLinha(paciente.linha)}
Meta terapêutica registrada: ${paciente.meta || 'Não definida'}
Total de sessões realizadas: ${paciente.sessoes || nSessoes}
Nível de risco clínico: ${paciente.risco || 'baixo'}

## HISTÓRICO DAS ÚLTIMAS ${nSessoes} SESSÃO(ÕES)
${blocoSessoes}

## PADRÕES IDENTIFICADOS NO HISTÓRICO
Distorções que aparecem em 2 ou mais sessões: ${distorcoesRecorrentes.length > 0 ? distorcoesRecorrentes.join(', ') : 'Nenhuma identificada ainda'}
Temas que reaparecem em múltiplas sessões: ${temasRecorrentes.length > 0 ? temasRecorrentes.join(', ') : 'Nenhum identificado ainda'}
Evolução do humor ao final das sessões: ${evolucaoHumor || 'Dados insuficientes'}
Padrão de adesão às tarefas: ${tarefasResultado || 'Sem histórico de tarefas ainda'}

## INSTRUÇÕES — LEIA COM ATENÇÃO ANTES DE GERAR

### PROFUNDIDADE CLÍNICA — OBRIGATÓRIO
- PROIBIDO tomar o caminho óbvio: não gere análise genérica que serviria para qualquer paciente com essa queixa. Identifique o padrão específico deste caso, neste momento do processo.
- Explore o que NÃO está sendo dito: que dor pode estar implícita no histórico, ainda não verbalizada explicitamente na sessão?
- Se o histórico sugerir critérios clínicos ainda não explorados (padrões de evitação, comorbidades potenciais, marcos diagnósticos não avaliados), sinalize no campo "obs" — sem diagnosticar, mas indicando ao terapeuta que vale avaliar.
- O campo "focoPrincipal" deve ter no mínimo 3 linhas e justificar POR QUÊ este é o foco, com base em evidências concretas do histórico — não apenas descrever o quê.
- Ao terminar de gerar internamente, aplique este teste antes de retornar: "Um terapeuta lendo este plano diria que a IA entendeu este caso específico, ou que gerou algo que serviria para qualquer paciente com ansiedade/depressão?" Se for a segunda opção, refaça com mais especificidade.

### FLUXO SOCRÁTICO — OBRIGATÓRIO
- As perguntas devem passar em DOIS TESTES antes de serem incluídas:
  TESTE 1 — ESPECIFICIDADE: "Esta pergunta é específica a ESTE paciente neste momento, ou seria válida para qualquer pessoa com essa queixa?" → Se for genérica, reformule ou descarte.
  TESTE 2 — INTENÇÃO OCULTA: "Esta pergunta revela ao paciente o que o terapeuta está investigando?" → Se sim, reformule. O paciente deve chegar à conclusão pelos próprios passos, sem perceber para onde está sendo conduzido.
- Evite perguntas excessivamente abertas que o paciente não conseguirá responder de forma produtiva.
- Cada eixo deve ter exatamente 2 perguntas em progressão: a segunda aprofunda e pressupõe a primeira.
- Os 3 eixos são FIXOS, nessa ordem exata:
  Eixo 1: "Investigação de evidências" — ancorar o pensamento automático na realidade concreta, antes de qualquer questionamento ou reestruturação.
  Eixo 2: "Exploração de perspectiva" — ampliar o campo de visão sem impor uma conclusão. Só acontece após o Eixo 1 ter sido trabalhado.
  Eixo 3: "Construção de resposta alternativa" — avançar para reestruturação apenas quando as evidências já foram exploradas nos eixos anteriores.

### CONTINUIDADE TERAPÊUTICA — OBRIGATÓRIO
- A tarefa NÃO pode ser genérica. Especifique: em qual tipo de situação, com qual objetivo clínico, conectada ao que foi trabalhado neste histórico.
- "itensRevisar" deve refletir o resultado real da tarefa anterior (se disponível) e abrir perguntas clínicas concretas — não tópicos vagos.
- Se houver distorções ou temas recorrentes identificados, o plano DEVE endereçá-los explicitamente.
- Baseie o plano no PADRÃO LONGITUDINAL, não apenas na sessão mais recente.

### RISCO E SEGURANÇA
- Se risco for "alto", defina urgencia como "alto" e coloque avaliação de segurança como primeiro item de "itensRevisar".
- Se qualquer sessão do histórico contiver alerta de ideação, inclua revisão de segurança nos "itensRevisar", independentemente do risco atual.

Retorne SOMENTE o JSON abaixo. Sem texto antes, sem texto depois, sem markdown, sem explicações.

{
  "objetivo": "string — objetivo clínico central da próxima sessão, específico a este caso",
  "itensRevisar": [
    "string — item concreto para revisar no início da sessão",
    "string — segundo item"
  ],
  "focoPrincipal": "string — mínimo 3 linhas explicando O QUÊ e POR QUÊ, com base no histórico",
  "fluxoSocratico": [
    {
      "eixo": "Investigação de evidências",
      "descricao": "string — como este eixo se aplica especificamente a este caso",
      "perguntas": [
        { "id": "p1", "texto": "string — pergunta 1, específica ao caso", "editado": false },
        { "id": "p2", "texto": "string — pergunta 2, aprofunda a primeira", "editado": false }
      ]
    },
    {
      "eixo": "Exploração de perspectiva",
      "descricao": "string — como este eixo se aplica especificamente a este caso",
      "perguntas": [
        { "id": "p3", "texto": "string", "editado": false },
        { "id": "p4", "texto": "string", "editado": false }
      ]
    },
    {
      "eixo": "Construção de resposta alternativa",
      "descricao": "string — como este eixo se aplica especificamente a este caso",
      "perguntas": [
        { "id": "p5", "texto": "string", "editado": false },
        { "id": "p6", "texto": "string", "editado": false }
      ]
    }
  ],
  "tecnicas": ["string — técnica 1 com contexto de aplicação", "string — técnica 2"],
  "tarefa": "string — tarefa específica: situação + objetivo clínico + forma de registro",
  "obs": "string — o que o histórico longitudinal revela que a leitura de uma única sessão não revelaria; padrões, resistências, marcos, dores implícitas",
  "duracaoSugerida": "50 min",
  "urgencia": "normal",
  "contextoUtilizado": ${nSessoes}
}`;

  const { resultado, provider } = await chamarComFallback(prompt, onProviderChange);
  if (!validarPlano(resultado)) {
    throw new Error('IA retornou estrutura de plano inválida');
  }
  return { plano: resultado, provider };
}

// ─── ANÁLISE LONGITUDINAL ───

export async function gerarAnaliseLongitudinal(paciente, todasSessoes) {
  const sessoes = [...todasSessoes].reverse();

  const blocoSessoes = sessoes.map(s => `
--- Sessão nº${s.numero} | ${s.data} ---
Resumo: ${s.resumo || 'Não registrado'}
Temas: ${(s.temas || []).join(', ') || 'Não registrado'}
Distorções: ${(s.distorcoes || []).join(', ') || 'Nenhuma'}
Técnicas: ${(s.tecnicas || []).join(', ') || 'Nenhuma'}
Humor início→fim: ${s.humor_inicio ?? '?'} → ${s.humor_fim ?? '?'}
Resultado da tarefa: ${s.resultado_tarefa || s.resultadoTarefa || 'Não registrado'}
Alertas: ${(s.alertas || []).join(', ') || 'Nenhum'}
`.trim()).join('\n\n');

  const prompt = `
Você é um assistente clínico especializado em análise longitudinal de casos.
Analise o histórico completo abaixo e produza uma síntese clínica profunda.

Você NÃO é supervisor clínico. Você sistematiza padrões que o histórico revela
e que a memória humana tende a perder ao longo de muitas sessões.
Não interprete dinâmica relacional, não prognostique, não diagnostique.

## PERFIL DO PACIENTE
Nome: ${paciente.nome}
Queixa principal: ${paciente.queixa || 'Não informada'}
Diagnóstico: ${paciente.diagnostico || 'Não fechado'}
Abordagem: ${paciente.linha || 'tcc'}
Meta terapêutica: ${paciente.meta || 'Não definida'}
Total de sessões: ${sessoes.length}
Em acompanhamento desde: ${paciente.inicio || 'Não informado'}

## HISTÓRICO COMPLETO (${sessoes.length} sessões — ordem cronológica)
${blocoSessoes}

## INSTRUÇÕES

Produza uma análise longitudinal com CINCO seções obrigatórias.
Cada seção deve ter profundidade real — não resuma o óbvio.
Identifique o que só é visível quando se olha o conjunto, não uma sessão isolada.

SEÇÃO 1 — EVOLUÇÃO DO CASO
O que mudou desde o início? O que permanece igual?
Há progresso real ou progresso aparente?
Que marcos clínicos são observáveis no histórico?

SEÇÃO 2 — PADRÕES PERSISTENTES
Quais distorções, temas ou comportamentos reaparecem mesmo após intervenção?
Com que frequência? Em que contextos tendem a emergir?

SEÇÃO 3 — PONTOS DE ATENÇÃO
Discrepâncias entre o que foi prescrito e o resultado obtido.
Sessões onde o humor piorou após o trabalho clínico.
Lacunas: o que parece nunca ter sido explorado?

SEÇÃO 4 — HIPÓTESES A EXPLORAR
Com base nos padrões do histórico, o que pode estar por baixo da queixa apresentada?
Que crenças centrais o histórico sugere?

SEÇÃO 5 — DIREÇÃO PARA OS PRÓXIMOS CICLOS
Com base em tudo que o histórico revela, qual é o foco mais produtivo
para as próximas 3 a 5 sessões?

Retorne SOMENTE o JSON abaixo. Sem markdown, sem texto fora do JSON.

{
  "evolucaoCaso": "string — mínimo 4 linhas",
  "padroesPresistentes": [
    { "padrao": "nome", "frequencia": "X de Y sessões", "contexto": "string", "indicacao": "string" }
  ],
  "pontosAtencao": ["string", "string"],
  "hipoteses": ["string", "string"],
  "direcaoProximosCiclos": "string — mínimo 3 linhas",
  "sessoesAnalisadas": ${sessoes.length},
  "dataAnalise": "${new Date().toLocaleDateString('pt-BR')}"
}
`.trim();

  const { resultado, provider } = await chamarComFallback(prompt);
  return { ...resultado, geradoPor: provider };
}
