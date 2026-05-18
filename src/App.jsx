import { useState, useRef, useEffect } from "react";
import { onAuthStateChange, signOut } from "./services/auth.js";
import { hasSupabase, testarConexao } from "./services/supabase.js";
import TelaLogin from "./components/TelaLogin.jsx";
import TelaCarregando from "./components/TelaCarregando.jsx";
import { extrairSessaoDeTexto, gerarPlanoSessao } from "./services/ia.js";
import { salvarPlano, buscarPlano } from "./services/planos.js";
import { testarChavesIA } from "./services/testarIA.js";
import { listarSessoes, criarSessao } from "./services/sessoes.js";
import { listarPacientes, atualizarPaciente, excluirPaciente, criarPaciente as criarPacienteService } from "./services/pacientes.js";

// ─── HOOK DE BREAKPOINT ───────────────────────────────────────────────────────
const useBreakpoint = () => {
  const [bp, setBp] = useState(() =>
    window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop"
  );
  useEffect(() => {
    const fn = () => setBp(window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop");
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
};

// ─── BANCO DE PALAVRAS POR LINHA TEÓRICA ──────────────────────────────────────
const BANCO_PALAVRAS = {
  tcc: {
    label: "TCC", cor: "#6366f1",
    categorias: {
      "Cognição": ["Pensamento automático","Crença central","Crença intermediária","Distorção cognitiva","Catastrofização","Leitura mental","Personalização","Generalização","Raciocínio emocional","Reestruturação"],
      "Comportamento": ["Exposição","Evitamento","Experimento comportamental","Comportamento-alvo","Análise funcional","Autocontrole","Modelagem","Plano de ação","Tarefa de casa","Monitoramento"],
      "Emoção / Sintoma": ["Ansiedade","Depressão","Escala de humor","Registro de pensamentos","Relaxamento","Mindfulness","Habilidades sociais","Objetivo terapêutico","Evidências pró","Evidências contra"],
    }
  },
  psicanalise: {
    label: "Psicanálise", cor: "#0ea5e9",
    categorias: {
      "Processo": ["Associação livre","Interpretação","Transferência","Contratransferência","Resistência","Repetição","Transferência negativa","Defesa","Recalque"],
      "Estrutura": ["Inconsciente","Pré-consciente","Consciente","Estrutura","Neurose","Psicose","Perversão","Complexo","Nome-do-Pai"],
      "Material": ["Sonho","Ato falho","Fantasia","Desejo","Gozo","Objeto a","Angústia","Pulsão","Sublimação","Projeção","Identificação"],
    }
  },
  gestalt: {
    label: "Gestalt", cor: "#10b981",
    categorias: {
      "Contato": ["Aqui-agora","Contato","Retirada","Bloqueio de contato","Introjeção","Projeção","Retroflexão","Confluência","Deflexão","Ciclo de contato"],
      "Awareness": ["Awareness","Awareness corporal","Sensação","Figura","Fundo","Fenomenologia","Experiência","Presença","Campo"],
      "Processo": ["Gestalt aberta","Polaridade","Experimento","Ajustamento criativo","Autossuporte","Expressão","Autenticidade","Responsabilidade","Emoção"],
    }
  },
  junguiana: {
    label: "Junguiana", cor: "#f59e0b",
    categorias: {
      "Arquétipos": ["Arquétipo","Sombra","Persona","Self","Anima","Animus","Herói","Sábio","Grande Mãe","Trickster","Arquétipo do Self"],
      "Inconsciente": ["Inconsciente coletivo","Inconsciente pessoal","Complexo","Símbolo","Imagem","Sincronicidade","Sombra coletiva","Energia psíquica"],
      "Processo": ["Individuação","Individuação simbólica","Jornada","Tipos psicológicos","Função dominante","Função inferior","Mito","Mandala","Sagrado"],
    }
  },
  humanista: {
    label: "Humanista / ACP", cor: "#ec4899",
    categorias: {
      "Relação": ["Empatia","Congruência","Aceitação","Escuta ativa","Escuta profunda","Presença","Relação terapêutica","Relação Eu-Tu","Presença genuína"],
      "Self": ["Autenticidade","Autoaceitação","Autocompaixão","Autoexpressão","Autodescoberta","Autoexploração","Autonomia","Vulnerabilidade","Tendência atualizante"],
      "Processo": ["Insight","Crescimento","Potencial","Experiência interna","Abertura","Vivência","Processo terapêutico","Liberdade interna"],
    }
  },
  comportamental: {
    label: "Análise do Comportamento", cor: "#8b5cf6",
    categorias: {
      "Análise ABC": ["Antecedente","Comportamento","Consequência","Análise funcional","Controle de estímulos","Função","Esquiva","Evitamento"],
      "Reforço": ["Reforço","Reforçador","Reforço positivo","Reforço negativo","Punição","Punição positiva","Punição negativa","Extinção","Modelagem"],
      "Métricas": ["Frequência","Intensidade","Duração","Comportamento-alvo","Generalização","Discriminação","Treino","Cadeia comportamental","Repertório","Motivação"],
    }
  },
};

const DISTORCOES_TCC = [
  "Catastrofização","Leitura mental","Personalização","Generalização",
  "Raciocínio emocional","Pensamento tudo-ou-nada","Desqualificação do positivo",
  "Abstração seletiva","Rotulação","Dever obrigatório"
];

// Memória de estilo do terapeuta (acumula durante a sessão)
// Na Fase 2 isso será persistido via API
const ESTILO_INICIAL = {
  edicoesTarefa: [],      // { original, editada, pacienteId }
  edicoesObs: [],         // { original, editada, pacienteId }
  tecnicasPreferidas: {}, // { linha: [tecnicas mantidas sem edição] }
  perguntasEditadas: [],  // perguntas que foram substituídas
};

// ─── DADOS SIMULADOS ───────────────────────────────────────────────────────────
const PACIENTES = [
  {
    id: 1,
    nome: "Mariana Costa",
    iniciais: "MC",
    idade: 31,
    cor: "#6366f1",
    queixa: "Ansiedade generalizada + fobia social",
    inicio: "Mar 2024",
    sessoes: 18,
    proximaSessao: "Hoje, 14h",
    adesao: 82,
    humor: [6, 5, 7, 6, 4, 5, 7],
    crenças: ["Sou inadequada para qualquer grupo", "Sempre vou decepcionar as pessoas"],
    distorcoesFrequentes: ["Leitura mental", "Catastrofização", "Personalização"],
    tarefaAtual: "Registro de pensamentos em situações sociais",
    cumprimentoTarefas: 72,
    risco: "baixo",
    linha: "tcc",
    email: "mariana.costa@email.com",
    telefone: "(11) 98765-4321",
    convenio: "Particular",
    diagnostico: "F40.1 — Fobia social",
    meta: "Desenvolver habilidades de enfrentamento social e reduzir a evitação de situações sociais",
    sessoes_pagas: 18,
    sessoesList: [
      {
        numero: 18,
        data: "12 mai 2025",
        temas: ["Reunião de trabalho geradora de ansiedade", "Antecipação catastrófica"],
        emocoes: [{ nome: "Ansiedade", intensidade: 85 }, { nome: "Vergonha", intensidade: 60 }],
        pensamentos: ["Vão perceber que sou incompetente", "Vou travar na hora de falar"],
        distorcoes: ["Leitura mental", "Catastrofização"],
        tecnicas: ["Registro de pensamentos ABC", "Questionamento socrático"],
        tarefa: "Registrar 3 situações sociais usando formulário ABC",
        resultadoTarefa: "Realizou parcialmente — registrou 2 situações",
        evolucao: "Demonstrou maior consciência dos gatilhos. Ainda dificuldade em questionar os PAs.",
        alertas: [],
        obs: "Próximo foco: dessensibilização sistemática para fala em público."
      },
      {
        numero: 17,
        data: "05 mai 2025",
        temas: ["Evitação de situações sociais", "Isolamento no fim de semana"],
        emocoes: [{ nome: "Ansiedade", intensidade: 90 }, { nome: "Tristeza", intensidade: 55 }],
        pensamentos: ["Se eu for, vou passar mal", "Prefiro ficar em casa e ficar bem"],
        distorcoes: ["Catastrofização", "Generalização"],
        tecnicas: ["Psicoeducação sobre ciclo evitação-ansiedade", "Hierarquia de exposição"],
        tarefa: "Ir a UMA situação social pequena durante a semana",
        resultadoTarefa: "Não realizou — relatou medo muito alto",
        evolucao: "Paciente reconhece o padrão de evitação mas ainda com alta resistência.",
        alertas: ["Padrão de evitação crescente — 3 sessões consecutivas"],
        obs: ""
      },
      {
        numero: 16,
        data: "28 abr 2025",
        temas: ["Crenças sobre julgamento alheio", "Histórico escolar de bullying"],
        emocoes: [{ nome: "Vergonha", intensidade: 75 }, { nome: "Raiva", intensidade: 40 }],
        pensamentos: ["Desde criança eu sempre fui o alvo", "As pessoas não mudam a visão que têm de mim"],
        distorcoes: ["Rotulação", "Pensamento absolutista"],
        tecnicas: ["Linha do tempo de evidências", "Reestruturação de crença central"],
        tarefa: "Escrever 5 evidências contrárias à crença 'sou inadequada'",
        resultadoTarefa: "Realizou completamente — encontrou 6 evidências",
        evolucao: "Sessão de boa produtividade. Tarefa bem executada demonstra engajamento.",
        alertas: [],
        obs: "Primeiro contato com crença central. Abertura para explorar."
      }
    ]
  },
  {
    id: 2,
    nome: "Rafael Souza",
    iniciais: "RS",
    idade: 28,
    cor: "#0ea5e9",
    queixa: "TOC + perfeccionismo clínico",
    inicio: "Jan 2025",
    sessoes: 9,
    proximaSessao: "Amanhã, 10h",
    adesao: 91,
    humor: [4, 3, 5, 4, 6, 5, 4],
    crenças: ["Errar significa que sou uma pessoa falha", "Preciso ter certeza absoluta antes de agir"],
    distorcoesFrequentes: ["Pensamento mágico", "Responsabilidade inflada", "Intolerância à incerteza"],
    tarefaAtual: "Prevenção de resposta: esperar 15min antes de checar e-mails",
    cumprimentoTarefas: 88,
    risco: "medio",
    linha: "tcc",
    email: "rafael.souza@email.com",
    telefone: "(11) 91234-5678",
    convenio: "Unimed",
    diagnostico: "F42 — Transtorno obsessivo-compulsivo",
    meta: "Reduzir rituais compulsivos e aumentar tolerância à incerteza via ERP",
    sessoes_pagas: 9,
    sessoesList: [
      {
        numero: 9,
        data: "09 mai 2025",
        temas: ["Rituais de checagem no trabalho", "Medo de erro com consequências graves"],
        emocoes: [{ nome: "Ansiedade", intensidade: 88 }, { nome: "Culpa", intensidade: 70 }],
        pensamentos: ["Se eu não checar, algo vai dar errado e será minha culpa", "Só consigo me concentrar depois de conferir tudo"],
        distorcoes: ["Responsabilidade inflada", "Intolerância à incerteza"],
        tecnicas: ["ERP (exposição com prevenção de resposta)", "Psicoeducação sobre TOC"],
        tarefa: "Prevenção de resposta: esperar 15min antes de checar e-mail após envio",
        resultadoTarefa: "Realizou em 5 de 7 dias — ansiedade alta mas tolerou",
        evolucao: "Boa adesão à ERP. Relata que a ansiedade 'passou sozinha' em 3 ocasiões.",
        alertas: [],
        obs: "Aumentar intervalo para 30min na próxima semana."
      },
      {
        numero: 8,
        data: "02 mai 2025",
        temas: ["Impacto no relacionamento por exigência de certeza", "Conflito com parceira"],
        emocoes: [{ nome: "Ansiedade", intensidade: 78 }, { nome: "Tristeza", intensidade: 65 }],
        pensamentos: ["Ela não entende que eu preciso ter certeza", "Vou perder o relacionamento por causa disso"],
        distorcoes: ["Catastrofização", "Leitura mental"],
        tecnicas: ["Técnica das duas colunas", "Questionamento de evidências"],
        tarefa: "Conversar com parceira sobre o TOC usando linguagem psicoeducativa",
        resultadoTarefa: "Realizou — relatou conversa produtiva",
        evolucao: "Insight importante sobre impacto relacional. Motivação aumentada para tratamento.",
        alertas: [],
        obs: ""
      }
    ]
  },
  {
    id: 3,
    nome: "Beatriz Lemos",
    iniciais: "BL",
    idade: 45,
    cor: "#10b981",
    queixa: "Depressão moderada + burnout",
    inicio: "Out 2024",
    sessoes: 26,
    proximaSessao: "Sex, 16h",
    adesao: 64,
    humor: [3, 4, 3, 2, 3, 4, 3],
    crenças: ["Não valho nada fora do meu trabalho", "Precisar de ajuda é fraqueza"],
    distorcoesFrequentes: ["Desqualificação do positivo", "Dever obrigatório", "Abstração seletiva"],
    tarefaAtual: "Ativação comportamental: uma atividade prazerosa por dia",
    cumprimentoTarefas: 45,
    risco: "alto",
    linha: "tcc",
    email: "beatriz.lemos@email.com",
    telefone: "(11) 99876-5432",
    convenio: "Bradesco Saúde",
    diagnostico: "F32.1 — Episódio depressivo moderado",
    meta: "Melhora do humor e redução de ideação passiva. Ativação comportamental progressiva",
    sessoes_pagas: 24,
    sessoesList: [
      {
        numero: 26,
        data: "08 mai 2025",
        temas: ["Recaída após promoção no trabalho", "Aumento de carga e piora dos sintomas"],
        emocoes: [{ nome: "Desesperança", intensidade: 72 }, { nome: "Exaustão", intensidade: 90 }, { nome: "Tristeza", intensidade: 80 }],
        pensamentos: ["Mesmo quando consigo algo, não consigo aproveitar", "Estou condenada a me sentir assim"],
        distorcoes: ["Desqualificação do positivo", "Pensamento absolutista"],
        tecnicas: ["Ativação comportamental", "Exploração de significados positivos"],
        tarefa: "Realizar 1 atividade prazerosa por dia, sem justificativa",
        resultadoTarefa: "Realizou em apenas 2 dos 7 dias",
        evolucao: "Sinaliza piora após evento positivo — padrão de autossabotagem identificado.",
        alertas: ["Ideação passiva de morte relatada de forma vaga — monitorar", "Cumprimento de tarefas abaixo de 50% por 4 sessões consecutivas"],
        obs: "Avaliar ajuste de abordagem. Considerar encaminhamento para avaliação psiquiátrica se não houver melhora."
      }
    ]
  }
];

const PLANOS_GERADOS = {
  1: {
    objetivo: "Aprofundar questionamento socrático dos pensamentos automáticos em contextos sociais",
    itensRevisar: [
      "Resultado dos 2 registros ABC feitos na semana",
      "Como se sentiu na situação que registrou na quinta",
      "O que aprendeu sobre o padrão 'vão perceber que sou incompetente'"
    ],
    focoPrincipal: "Fortalecer a capacidade de questionar PAs no momento da situação social, não apenas depois",
    fluxoSocratico: [
      {
        eixo: "Investigação de evidências",
        descricao: "Ancorar o pensamento automático na realidade concreta antes de qualquer questionamento",
        perguntas: [
          { id: 1, texto: "Me conta o que estava acontecendo naquele momento — o que você viu, ouviu, observou?", editado: false },
          { id: 2, texto: "O que especificamente te fez chegar a essa conclusão naquela hora?", editado: false }
        ]
      },
      {
        eixo: "Exploração de perspectiva",
        descricao: "Ampliar o campo de visão sem impor uma conclusão",
        perguntas: [
          { id: 3, texto: "Já aconteceu antes de você estar nessa situação e o resultado ter sido diferente do que esperava?", editado: false },
          { id: 4, texto: "Se você observasse outra pessoa passando por isso, o que você notaria?", editado: false }
        ]
      },
      {
        eixo: "Construção de resposta alternativa",
        descricao: "Avançar para reestruturação apenas quando as evidências já foram exploradas",
        perguntas: [
          { id: 5, texto: "Com o que você acabou de perceber, como você descreveria essa situação agora?", editado: false }
        ]
      }
    ],
    tecnicas: ["Registro de pensamentos ABC (ampliar para coluna D)", "Técnica do advogado de defesa", "Exposição gradual — nível 2 da hierarquia"],
    tarefa: "Usar o formulário ABCD em pelo menos 2 situações sociais, incluindo uma coluna de resposta racional",
    obs: "Sessão 18 mostrou boa consciência dos gatilhos. Momento propício para avançar para reestruturação ativa, não só identificação.",
    duracaoSugerida: "50 min",
    urgencia: "normal"
  },
  2: {
    objetivo: "Avançar no protocolo ERP — aumentar intervalo de prevenção de resposta e introduzir hierarquia de exposição",
    itensRevisar: [
      "Como foi a semana com a tarefa de esperar 15 minutos",
      "Nos 2 dias que não conseguiu, o que aconteceu diferente?",
      "Qual foi o nível de ansiedade máximo e como passou?"
    ],
    focoPrincipal: "Consolidar a experiência de que a ansiedade cede sem o ritual — evidência experiencial do ciclo do TOC",
    fluxoSocratico: [
      {
        eixo: "Mapeamento da experiência",
        descricao: "Explorar as sensações físicas e o que de fato aconteceu nos dias de prevenção de resposta",
        perguntas: [
          { id: 1, texto: "Nas vezes em que você esperou sem checar, o que você notou no seu corpo durante esse tempo?", editado: false },
          { id: 2, texto: "O que de fato aconteceu depois — o que você observou?", editado: false }
        ]
      },
      {
        eixo: "Relação com incerteza",
        descricao: "Explorar a relação com o não-saber sem criar pressão para resolver",
        perguntas: [
          { id: 3, texto: "O que seria diferente para você se a incerteza simplesmente ficasse sem resposta?", editado: false },
          { id: 4, texto: "Como você percebe que reage quando algo fica em aberto — o que acontece internamente?", editado: false }
        ]
      },
      {
        eixo: "Consolidação experiencial",
        descricao: "Integrar o aprendizado dos episódios em que a ansiedade cedeu",
        perguntas: [
          { id: 5, texto: "Pensando nas vezes em que a ansiedade passou por conta própria, o que isso diz sobre sua capacidade de atravessar esse desconforto?", editado: false }
        ]
      }
    ],
    tecnicas: ["ERP com hierarquia ampliada", "Registro de predições vs realidade", "Mindfulness da incerteza"],
    tarefa: "Aumentar intervalo para 30 minutos em e-mails e adicionar checagem de portas como nova exposição",
    obs: "Boa adesão ao ERP. Paciente demonstra insight sobre o ciclo. Introduzir conceito de habituação como psicoeducação.",
    duracaoSugerida: "50 min",
    urgencia: "normal"
  },
  3: {
    objetivo: "Avaliar profundidade da piora pós-promoção e ajustar plano de tratamento",
    itensRevisar: [
      "O que aconteceu nos dias em que não conseguiu fazer a atividade prazerosa",
      "Como está o sono e o apetite esta semana",
      "A ideação passiva mencionada na última sessão — explorar com cuidado"
    ],
    focoPrincipal: "Segurança e avaliação de risco antes de qualquer trabalho cognitivo",
    fluxoSocratico: [
      {
        eixo: "Acolhimento e presença",
        descricao: "Abrir espaço antes de qualquer avaliação ou intervenção",
        perguntas: [
          { id: 1, texto: "Como você está chegando hoje?", editado: false }
        ]
      },
      {
        eixo: "Avaliação de segurança",
        descricao: "Perguntas diretas sobre a ideação mencionada, sem alarmar",
        perguntas: [
          { id: 2, texto: "Aquele pensamento que você mencionou na última vez — ele voltou ou mudou de alguma forma?", editado: false },
          { id: 3, texto: "Você chegou a pensar em como ou quando isso aconteceria?", editado: false }
        ]
      },
      {
        eixo: "Vínculo terapêutico",
        descricao: "Ancorar no presente e no que trouxe a paciente até aqui",
        perguntas: [
          { id: 4, texto: "O que te fez vir hoje?", editado: false }
        ]
      }
    ],
    tecnicas: ["Avaliação de risco estruturada (BSS)", "Plano de segurança se necessário", "Ativação comportamental mínima"],
    tarefa: "Definir apenas UMA micro-atividade para a semana — algo de 5 minutos, sem pressão",
    obs: "⚠️ SESSÃO DE RISCO. Prioridade absoluta: avaliação de ideação. Considerar encaminhamento para psiquiatria. Não avançar em protocolo sem estabilização.",
    duracaoSugerida: "60 min",
    urgencia: "alto"
  }
};

// ─── ENGINE DE ANÁLISE DE PADRÕES ─────────────────────────────────────────────
const analisarPadroes = (sessoesList) => {
  if (!sessoesList || sessoesList.length < 2) return null;

  const freqDistorcoes = {};
  sessoesList.forEach(s => {
    (s.distorcoes || []).forEach(d => {
      freqDistorcoes[d] = (freqDistorcoes[d] || 0) + 1;
    });
  });
  const topDistorcoes = Object.entries(freqDistorcoes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nome, count]) => ({ nome, count, percentual: Math.round((count / sessoesList.length) * 100) }));

  const humores = sessoesList
    .filter(s => s.emocoes && s.emocoes.length)
    .map(s => ({ num: s.numero, media: Math.round(s.emocoes.reduce((acc, e) => acc + e.intensidade, 0) / s.emocoes.length) }));

  const tarefasConcluidas = sessoesList.filter(s => s.resultadoTarefa && s.resultadoTarefa.includes("completamente")).length;
  const tarefasParciais   = sessoesList.filter(s => s.resultadoTarefa && s.resultadoTarefa.includes("parcialmente")).length;
  const tarefasNaoFeitas  = sessoesList.filter(s => s.resultadoTarefa && s.resultadoTarefa.includes("Não realizou")).length;

  const alertas = [];
  const ultimasSessoes = sessoesList.slice(0, 3);
  const naoFezUltimas = ultimasSessoes.filter(s => s.resultadoTarefa && s.resultadoTarefa.includes("Não realizou")).length;
  if (naoFezUltimas >= 2) alertas.push({ tipo: "adesao", msg: "Não realizou tarefa em 2+ das últimas 3 sessões — reavaliar formato das tarefas" });

  const temAlertaRisco = sessoesList.slice(0, 2).some(s => s.alertas && s.alertas.length > 0);
  if (temAlertaRisco) alertas.push({ tipo: "risco", msg: "Alertas clínicos nas últimas 2 sessões — monitorar de perto" });

  const distorcaoRecorrente = topDistorcoes.find(d => d.percentual >= 60);
  if (distorcaoRecorrente) alertas.push({ tipo: "padrao", msg: `"${distorcaoRecorrente.nome}" presente em ${distorcaoRecorrente.percentual}% das sessões — considerar intervenção específica` });

  return { topDistorcoes, humores, tarefasConcluidas, tarefasParciais, tarefasNaoFeitas, alertas };
};

// ─── COMPONENTES AUXILIARES ────────────────────────────────────────────────────
const Badge = ({ children, tipo = "neutro" }) => {
  const estilos = {
    neutro: { bg: "#f1f5f9", cor: "#475569" },
    distorcao: { bg: "#fef3c7", cor: "#92400e" },
    alerta: { bg: "#fee2e2", cor: "#991b1b" },
    sucesso: { bg: "#d1fae5", cor: "#065f46" },
    tecnica: { bg: "#ede9fe", cor: "#5b21b6" },
    info: { bg: "#e0f2fe", cor: "#0c4a6e" },
  };
  const s = estilos[tipo] || estilos.neutro;
  return (
    <span style={{
      background: s.bg, color: s.cor,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
      whiteSpace: "nowrap"
    }}>{children}</span>
  );
};

const RiscoTag = ({ nivel }) => {
  const cfg = {
    baixo: { label: "Risco baixo", bg: "#d1fae5", cor: "#065f46", dot: "#10b981" },
    medio: { label: "Risco médio", bg: "#fef3c7", cor: "#92400e", dot: "#f59e0b" },
    alto: { label: "Risco alto", bg: "#fee2e2", cor: "#991b1b", dot: "#ef4444" },
  };
  const c = cfg[nivel];
  return (
    <span style={{ display:"flex", alignItems:"center", gap:5, background:c.bg, color:c.cor,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.dot, display:"inline-block" }}/>
      {c.label}
    </span>
  );
};

const BarraProgresso = ({ valor, cor = "#6366f1", altura = 6 }) => (
  <div style={{ background:"#f1f5f9", borderRadius:99, height:altura, overflow:"hidden" }}>
    <div style={{ width:`${valor}%`, background:cor, height:"100%", borderRadius:99,
      transition:"width 0.8s ease" }}/>
  </div>
);

const Avatar = ({ iniciais, cor, tamanho = 36 }) => (
  <div style={{ width:tamanho, height:tamanho, borderRadius:"50%", background:`${cor}18`,
    border:`2px solid ${cor}40`, display:"flex", alignItems:"center", justifyContent:"center",
    color:cor, fontWeight:700, fontSize:tamanho*0.33, flexShrink:0 }}>
    {iniciais}
  </div>
);

const HumorMini = ({ dados, cor }) => {
  const max = 10, w = 120, h = 36, pad = 4;
  const pts = dados.map((v, i) => {
    const x = pad + (i / (dados.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v / max) * (h - pad * 2));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.7}/>
      {dados.map((v, i) => {
        const x = pad + (i / (dados.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v / max) * (h - pad * 2));
        return <circle key={i} cx={x} cy={y} r={2.5} fill={cor} opacity={0.9}/>;
      })}
    </svg>
  );
};

const IntensidadeBar = ({ nome, valor, cor = "#6366f1" }) => (
  <div style={{ marginBottom:8 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
      <span style={{ fontSize:12, color:"#64748b" }}>{nome}</span>
      <span style={{ fontSize:12, fontWeight:700, color:cor }}>{valor}%</span>
    </div>
    <BarraProgresso valor={valor} cor={cor} />
  </div>
);

// ─── TELA: LISTA DE PACIENTES ─────────────────────────────────────────────────
const CORES_AVATAR = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ec4899","#8b5cf6"];

const gerarIniciais = (nome) =>
  nome.trim().split(/\s+/).slice(0,2).map(p => p[0].toUpperCase()).join("");

const TelaPacientes = ({ pacientes: pacientesProps, onSelect, onNovoPaciente, pacienteSelecionado, menuAberto, onClose, terapeutaId }) => {
  const [busca, setBusca] = useState("");
  const [novosPacientes, setNovosPacientes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formIdade, setFormIdade] = useState("");
  const [formQueixa, setFormQueixa] = useState("");
  const [formLinha, setFormLinha] = useState("tcc");
  const [formRisco, setFormRisco] = useState("baixo");
  const [secoesAbertas, setSecoesAbertas] = useState({ hoje: true, semana: false, semAgendamento: false });
  const [hoverPaciente, setHoverPaciente] = useState(null);
  const [hoverY, setHoverY] = useState(0);
  const hoverTimer = useRef(null);

  const iniciarHover = (p, e) => {
    clearTimeout(hoverTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = Math.min(rect.top, window.innerHeight - 230);
    setHoverY(y);
    setHoverPaciente(p);
  };

  const encerrarHover = () => {
    hoverTimer.current = setTimeout(() => setHoverPaciente(null), 150);
  };

  const base = pacientesProps ?? PACIENTES;
  const todos = [...base, ...novosPacientes];

  const filtrados = todos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.queixa.toLowerCase().includes(busca.toLowerCase())
  );

  const grupos = {
    hoje:           filtrados.filter(p => p.proximaSessao.includes("Hoje")),
    semana:         filtrados.filter(p => !p.proximaSessao.includes("Hoje") && !p.proximaSessao.includes("Não") && p.proximaSessao !== ""),
    semAgendamento: filtrados.filter(p => p.proximaSessao.includes("Não") || p.proximaSessao === ""),
  };

  const toggleSecao = (key) => setSecoesAbertas(prev => ({ ...prev, [key]: !prev[key] }));

  const renderLinha = (p) => {
    const ativo = pacienteSelecionado?.id === p.id;
    const analise = analisarPadroes(p.sessoesList);
    const numAlertas = analise ? analise.alertas.length : 0;
    const riscoLetra = { baixo:"B", medio:"M", alto:"A" }[p.risco];
    const riscoCor = { baixo:"#10b981", medio:"#f59e0b", alto:"#ef4444" }[p.risco];

    if (!menuAberto) return (
      <div key={p.id} onClick={() => onSelect(p)} title={p.nome}
        style={{ display:"flex", justifyContent:"center", alignItems:"center",
          height:40, cursor:"pointer", borderRadius:8, margin:"0 4px",
          background: ativo ? `${p.cor}12` : "transparent",
          border: ativo ? `1.5px solid ${p.cor}40` : "1.5px solid transparent",
          transition:"all 0.15s ease", position:"relative" }}>
        <Avatar iniciais={p.iniciais} cor={p.cor} tamanho={28} />
        {numAlertas > 0 && (
          <span style={{ position:"absolute", top:3, right:3, width:7, height:7,
            background:"#ef4444", borderRadius:"50%", border:"1.5px solid #fff" }}/>
        )}
      </div>
    );

    return (
      <div key={p.id} onClick={() => onSelect(p)}
        onMouseEnter={e => iniciarHover(p, e)}
        onMouseLeave={encerrarHover}
        style={{ display:"flex", alignItems:"center", gap:8, height:40,
          padding:"0 12px", cursor:"pointer", borderRadius:8, margin:"0 4px",
          background: ativo ? `${p.cor}10` : "transparent",
          borderLeft: ativo ? `3px solid ${p.cor}` : "3px solid transparent",
          transition:"all 0.12s ease" }}>
        <Avatar iniciais={p.iniciais} cor={p.cor} tamanho={28} />
        <div style={{ flex:1, minWidth:0, overflow:"hidden",
          whiteSpace:"nowrap", textOverflow:"ellipsis",
          fontSize:13, fontWeight:600, color:"#0f172a" }}>
          {p.nome}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          {numAlertas > 0 && (
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#ef4444", flexShrink:0 }}/>
          )}
          <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, fontWeight:700, color:riscoCor }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:riscoCor, display:"inline-block" }}/>
            {riscoLetra}
          </span>
          <span style={{ fontSize:11, color:"#94a3b8", minWidth:60, textAlign:"right" }}>
            {p.proximaSessao.includes("Hoje") ? (
              <span style={{ color:"#dc2626", fontWeight:600 }}>
                {p.proximaSessao.replace("Hoje, ","")}
              </span>
            ) : p.proximaSessao.includes("Não") ? "" : p.proximaSessao.split(", ")[1] || p.proximaSessao}
          </span>
        </div>
      </div>
    );
  };

  const criarPaciente = async () => {
    if (!formNome.trim()) return;
    const camposDB = {
      nome: formNome.trim(),
      iniciais: gerarIniciais(formNome),
      queixa: formQueixa.trim() || "Sem queixa registrada",
      linha: formLinha,
      risco: formRisco,
      sessoes: 0,
      sessoes_pagas: 0,
      inicio: new Date().toLocaleDateString("pt-BR", { month:"short", year:"numeric" }),
    };
    let pacienteId = Date.now();
    if (terapeutaId && terapeutaId !== "demo") {
      const { data } = await criarPacienteService(terapeutaId, camposDB);
      if (data?.id) pacienteId = data.id;
    }
    const novo = {
      ...camposDB,
      id: pacienteId,
      idade: Number(formIdade) || 0,
      cor: CORES_AVATAR[(novosPacientes.length + (pacientesProps?.length ?? 0)) % CORES_AVATAR.length],
      adesao: 0,
      humor: [5,5,5,5,5,5,5],
      crenças: [],
      distorcoesFrequentes: [],
      tarefaAtual: "",
      cumprimentoTarefas: 0,
      proximaSessao: "Não agendado",
      sessoesList: [],
    };
    if (onNovoPaciente) {
      onNovoPaciente(novo);
    } else {
      setNovosPacientes(prev => [...prev, novo]);
    }
    setModalAberto(false);
    setFormNome(""); setFormIdade(""); setFormQueixa("");
    setFormLinha("tcc"); setFormRisco("baixo");
    onSelect(novo);
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>

      {/* Header — oculto quando colapsado */}
      {menuAberto && (
        <div style={{ padding:"24px 24px 16px", borderBottom:"1px solid #f1f5f9" }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em",
            color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>
            Hoje — {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:20, fontWeight:700, color:"#0f172a" }}>
              Meus pacientes
            </div>
            {onClose && (
              <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:18, color:"#64748b" }}>✕</button>
            )}
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar paciente ou queixa…"
            style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
              borderRadius:10, fontSize:13, color:"#0f172a", background:"#f8fafc",
              outline:"none", boxSizing:"border-box" }}
          />
        </div>
      )}

      {/* Alertas rápidos — ocultos quando colapsado */}
      {menuAberto && todos.filter(p => p.risco === "alto").map(p => (
        <div key={p.id} style={{ margin:"12px 16px 0", padding:"10px 14px",
          background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10,
          display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <div>
            <span style={{ fontSize:12, fontWeight:700, color:"#9f1239" }}>Atenção: </span>
            <span style={{ fontSize:12, color:"#be123c" }}>{p.nome} — ideação passiva relatada. Monitorar hoje.</span>
          </div>
        </div>
      ))}

      {/* Lista agrupada */}
      <div style={{ flex:1, overflowY:"auto", padding: menuAberto ? "8px 0" : "8px 4px" }}>
        {[
          { key:"hoje",           label:"Hoje",           lista: grupos.hoje },
          { key:"semana",         label:"Esta semana",    lista: grupos.semana },
          { key:"semAgendamento", label:"Sem agendamento",lista: grupos.semAgendamento },
        ].filter(g => g.lista.length > 0).map(({ key, label, lista }) => {
          const aberta = secoesAbertas[key];
          return (
            <div key={key}>
              {/* Header da seção — oculto no modo colapsado */}
              {menuAberto && (
                <div onClick={() => toggleSecao(key)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"6px 16px", cursor:"pointer", userSelect:"none" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8",
                    textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    {label} ({lista.length})
                  </span>
                  <span style={{ fontSize:10, color:"#cbd5e1",
                    transform: aberta ? "rotate(180deg)" : "rotate(0deg)",
                    transition:"transform 0.2s ease", display:"inline-block" }}>
                    ▾
                  </span>
                </div>
              )}
              {/* Linhas dos pacientes */}
              {aberta && lista.map(p => renderLinha(p))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop:"1px solid #f1f5f9", flexShrink:0 }}>
        {/* Botão novo paciente */}
        {menuAberto ? (
          <div style={{ padding:"12px 16px 0" }}>
            <button onClick={() => setModalAberto(true)}
              style={{ width:"100%", padding:"9px 0", background:"#6366f1", color:"#fff",
                border:"none", borderRadius:10, fontSize:13, fontWeight:700,
                cursor:"pointer", letterSpacing:"0.02em" }}>
              + Novo paciente
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0" }}>
            <button onClick={() => setModalAberto(true)} title="Novo paciente"
              style={{ width:36, height:36, background:"#6366f1", color:"#fff",
                border:"none", borderRadius:8, fontSize:20, fontWeight:700,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              +
            </button>
          </div>
        )}

        {/* Stats — ocultos quando colapsado */}
        {menuAberto && (
          <div style={{ padding:"12px 24px 14px", display:"flex", gap:24 }}>
            {[
              { label:"Pacientes", val: todos.length },
              { label:"Sessões hoje", val: todos.filter(p=>p.proximaSessao.includes("Hoje")).length },
              { label:"Alertas", val: todos.filter(p=>p.risco==="alto").length },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize:18, fontWeight:800, color:"#0f172a" }}>{val}</div>
                <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase",
                  letterSpacing:"0.06em" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popover hover card */}
      {hoverPaciente && (
        <div
          onMouseEnter={() => clearTimeout(hoverTimer.current)}
          onMouseLeave={encerrarHover}
          style={{
            position:"fixed", zIndex:200,
            left: menuAberto ? 288 : 64,
            top: hoverY,
            width: 260,
            background:"#fff", borderRadius:14,
            boxShadow:"0 8px 32px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
            border:"1px solid #f1f5f9",
            padding:"16px",
            pointerEvents:"auto",
          }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Avatar iniciais={hoverPaciente.iniciais} cor={hoverPaciente.cor} tamanho={40} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#0f172a",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {hoverPaciente.nome}
              </div>
              <div style={{ fontSize:11, color:"#64748b", marginTop:1,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {hoverPaciente.queixa}
              </div>
            </div>
            <RiscoTag nivel={hoverPaciente.risco} />
          </div>

          {/* Humor */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8",
              textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
              Humor (7d)
            </div>
            <HumorMini dados={hoverPaciente.humor} cor={hoverPaciente.cor} />
          </div>

          {/* Adesão */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ fontSize:11, color:"#64748b" }}>Adesão terapêutica</span>
              <span style={{ fontSize:11, fontWeight:700, color:hoverPaciente.cor }}>
                {hoverPaciente.adesao}%
              </span>
            </div>
            <BarraProgresso valor={hoverPaciente.adesao} cor={hoverPaciente.cor} />
          </div>

          {/* Próxima sessão */}
          <div style={{ fontSize:12, fontWeight:600,
            color: hoverPaciente.proximaSessao.includes("Hoje") ? "#dc2626" : "#475569",
            background: hoverPaciente.proximaSessao.includes("Hoje") ? "#fff1f2" : "#f8fafc",
            padding:"5px 10px", borderRadius:8, marginBottom: 8 }}>
            {hoverPaciente.proximaSessao.includes("Hoje") ? "🔴 " : "📅 "}
            {hoverPaciente.proximaSessao}
          </div>

          {/* Último alerta */}
          {hoverPaciente.sessoesList?.[0]?.alertas?.length > 0 && (
            <div style={{ fontSize:11, color:"#be123c", background:"#fff1f2",
              padding:"5px 10px", borderRadius:8, borderLeft:"3px solid #fecdd3" }}>
              ⚠️ {hoverPaciente.sessoesList[0].alertas[0]}
            </div>
          )}
        </div>
      )}

      {/* Modal novo paciente */}
      {modalAberto && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => e.target === e.currentTarget && setModalAberto(false)}>
          <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px 24px",
            width:440, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#0f172a", marginBottom:20 }}>
              Novo paciente
            </div>

            {[
              { label:"Nome completo *", value:formNome, set:setFormNome, type:"text", placeholder:"Ex: Ana Souza" },
              { label:"Idade", value:formIdade, set:setFormIdade, type:"number", placeholder:"Ex: 34" },
              { label:"Queixa principal", value:formQueixa, set:setFormQueixa, type:"text", placeholder:"Ex: Ansiedade e insônia" },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label} style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:5 }}>{label}</div>
                <input type={type} value={value} onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                    borderRadius:8, fontSize:13, color:"#0f172a", outline:"none",
                    boxSizing:"border-box" }} />
              </div>
            ))}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:5 }}>Linha terapêutica</div>
                <select value={formLinha} onChange={e => setFormLinha(e.target.value)}
                  style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                    borderRadius:8, fontSize:13, color:"#0f172a", outline:"none",
                    background:"#fff", boxSizing:"border-box" }}>
                  {Object.entries(BANCO_PALAVRAS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:5 }}>Risco inicial</div>
                <select value={formRisco} onChange={e => setFormRisco(e.target.value)}
                  style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                    borderRadius:8, fontSize:13, color:"#0f172a", outline:"none",
                    background:"#fff", boxSizing:"border-box" }}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setModalAberto(false)}
                style={{ padding:"9px 20px", background:"#f1f5f9", color:"#475569",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={criarPaciente}
                style={{ padding:"9px 24px", background:"#6366f1", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Criar paciente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TELA: HISTÓRICO DO PACIENTE ───────────────────────────────────────────────
const TelaHistorico = ({ paciente, isMobile = false }) => {
  const [sessaoAtiva, setSessaoAtiva] = useState(paciente.sessoesList[0]);

  useEffect(() => {
    setSessaoAtiva(paciente.sessoesList[0]);
  }, [paciente.id]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflowY:"auto" }}>
      {/* Header do paciente */}
      <div style={{ padding: isMobile ? "16px" : "24px 28px 20px",
        background:`linear-gradient(135deg, ${paciente.cor}10, ${paciente.cor}05)`,
        borderBottom:"1px solid #f1f5f9" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
          <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={48} />
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>{paciente.nome}</div>
            <div style={{ fontSize:13, color:"#64748b" }}>{paciente.queixa}</div>
          </div>
          <div style={{ marginLeft:"auto" }}>
            <RiscoTag nivel={paciente.risco} />
          </div>
        </div>

        {/* Stats rápidos */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: isMobile ? 8 : 12 }}>
          {[
            { label:"Sessões", val: paciente.sessoes, sub:"realizadas" },
            { label:"Adesão", val: `${paciente.adesao}%`, sub:"tarefas de casa" },
            { label:"Tarefas", val: `${paciente.cumprimentoTarefas}%`, sub:"cumprimento" },
            { label:"Início", val: paciente.inicio, sub:"em acompanhamento" },
            { label:"Abordagem", val: BANCO_PALAVRAS[paciente.linha || "tcc"].label, sub:"linha terapêutica" },
          ].map(({ label, val, sub }) => (
            <div key={label} style={{ background:"#fff", borderRadius:10, padding:"10px 12px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>{val}</div>
              <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.05em" }}>{label}</div>
              <div style={{ fontSize:10, color:"#cbd5e1" }}>{sub}</div>
            </div>
          ))}
        </div>

      </div>

      <div style={{ display:"flex", flex:1, minHeight:0, flexDirection: isMobile ? "column" : "row" }}>
        {/* Mobile: dropdown seletor de sessão */}
        {isMobile && paciente.sessoesList.length > 0 && (
          <div style={{ padding:"10px 16px", borderBottom:"1px solid #f1f5f9", background:"#fff", flexShrink:0 }}>
            <select
              value={sessaoAtiva?.numero ?? ""}
              onChange={e => setSessaoAtiva(paciente.sessoesList.find(s => s.numero === parseInt(e.target.value)))}
              style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13 }}
            >
              {paciente.sessoesList.map(s => (
                <option key={s.numero} value={s.numero}>
                  Sessão {s.numero} — {s.data}{s.alertas?.length > 0 ? " ⚠️" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Desktop: lista de sessões */}
        {!isMobile && (
          <div style={{ width:200, borderRight:"1px solid #f1f5f9", overflowY:"auto", flexShrink:0 }}>
            <div style={{ padding:"12px 16px 8px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.08em" }}>Sessões</div>
            </div>
            {paciente.sessoesList.map(s => {
              const ativa = sessaoAtiva?.numero === s.numero;
              const temAlerta = s.alertas?.length > 0;
              return (
                <div key={s.numero} onClick={() => setSessaoAtiva(s)}
                  style={{ padding:"10px 16px", cursor:"pointer",
                    background: ativa ? `${paciente.cor}10` : "transparent",
                    borderLeft: ativa ? `3px solid ${paciente.cor}` : "3px solid transparent",
                    transition:"all 0.1s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>
                      Sessão {s.numero}
                    </span>
                    {temAlerta && <span style={{ fontSize:14 }}>🔴</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{s.data}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detalhe da sessão */}
        <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px" : "20px 24px" }}>
          {!sessaoAtiva && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              height:"100%", gap:12, color:"#94a3b8", textAlign:"center", padding:32 }}>
              <div style={{ fontSize:32 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#64748b" }}>Nenhuma sessão registrada</div>
              <div style={{ fontSize:13 }}>Use a aba "Importar" para registrar a primeira sessão deste paciente.</div>
            </div>
          )}
          {sessaoAtiva && sessaoAtiva.alertas.length > 0 && (
            <div style={{ background:"#fff1f2", border:"1px solid #fecdd3",
              borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#9f1239", marginBottom:6 }}>
                ⚠️ Alertas clínicos
              </div>
              {sessaoAtiva.alertas.map((a,i) => (
                <div key={i} style={{ fontSize:12, color:"#be123c" }}>• {a}</div>
              ))}
            </div>
          )}

          {sessaoAtiva && (
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16 }}>
            {/* Emoções */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Emoções</div>
              {sessaoAtiva.emocoes.map(e => {
                const cor = e.intensidade > 80 ? "#ef4444" : e.intensidade > 60 ? "#f59e0b" : "#10b981";
                return <IntensidadeBar key={e.nome} nome={e.nome} valor={e.intensidade} cor={cor}/>;
              })}
            </div>

            {/* Distorções */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Distorções cognitivas</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {sessaoAtiva.distorcoes.map(d => (
                  <Badge key={d} tipo="distorcao">{d}</Badge>
                ))}
              </div>
            </div>

            {/* Pensamentos */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9", gridColumn: isMobile ? "1" : "1/-1" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Pensamentos automáticos</div>
              {sessaoAtiva.pensamentos.map((p,i) => (
                <div key={i} style={{ fontSize:13, color:"#334155", padding:"8px 12px",
                  background:"#f8fafc", borderRadius:8, marginBottom:6,
                  borderLeft:"3px solid #e2e8f0" }}>
                  "{p}"
                </div>
              ))}
            </div>

            {/* Técnicas */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Técnicas aplicadas</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {sessaoAtiva.tecnicas.map(t => (
                  <Badge key={t} tipo="tecnica">{t}</Badge>
                ))}
              </div>
            </div>

            {/* Tarefa */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>Tarefa de casa</div>
              <div style={{ fontSize:12, color:"#334155", marginBottom:8 }}>{sessaoAtiva.tarefa}</div>
              <div style={{ fontSize:11, fontWeight:600,
                color: sessaoAtiva.resultadoTarefa?.includes("completamente") ? "#065f46" :
                       sessaoAtiva.resultadoTarefa?.includes("Não realizou") ? "#991b1b" : "#92400e",
                background: sessaoAtiva.resultadoTarefa?.includes("completamente") ? "#d1fae5" :
                            sessaoAtiva.resultadoTarefa?.includes("Não realizou") ? "#fee2e2" : "#fef3c7",
                padding:"6px 10px", borderRadius:6 }}>
                {sessaoAtiva.resultadoTarefa}
              </div>
            </div>

            {/* Evolução */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9", gridColumn: isMobile ? "1" : "1/-1" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>Evolução clínica</div>
              <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>{sessaoAtiva.evolucao}</div>
              {sessaoAtiva.obs && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"#f0f9ff",
                  borderRadius:8, fontSize:12, color:"#0c4a6e", borderLeft:"3px solid #0ea5e9" }}>
                  💡 {sessaoAtiva.obs}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── LABELS POR LINHA TEÓRICA ─────────────────────────────────────────────────
const LABELS_POR_LINHA = {
  tcc:           { perguntas: "Perguntas socráticas sugeridas", material: "Distorções a trabalhar" },
  psicanalise:   { perguntas: "Hipóteses interpretativas",      material: "Material a explorar" },
  gestalt:       { perguntas: "Perguntas fenomenológicas",       material: "Gestalts abertas" },
  junguiana:     { perguntas: "Perguntas simbólicas",            material: "Arquétipos emergentes" },
  humanista:     { perguntas: "Perguntas de escuta profunda",    material: "Temas de crescimento" },
  comportamental:{ perguntas: "Análise funcional sugerida",      material: "Comportamentos-alvo" },
};

const CAMPOS_POR_LINHA = {
  tcc: {
    campos: ["Pensamentos automáticos", "Crenças centrais", "Distorções cognitivas", "Técnicas aplicadas", "Tarefa de casa"],
    placeholder_evolucao: "Descreva mudanças cognitivas observadas, nível de engajamento com as técnicas…",
    placeholder_tarefa: "Ex: Registrar 3 situações usando formulário ABC…",
  },
  psicanalise: {
    campos: ["Conteúdo da associação livre", "Transferência observada", "Resistências", "Sonhos/atos falhos", "Hipóteses interpretativas"],
    placeholder_evolucao: "Descreva o material inconsciente emergente, movimentos transferenciais…",
    placeholder_tarefa: "Ex: Anotar sonhos ao acordar durante a semana…",
  },
  gestalt: {
    campos: ["Temas do aqui-agora", "Gestalts abertas", "Bloqueios de contato", "Experimentos realizados", "Awareness observada"],
    placeholder_evolucao: "Descreva qualidade do contato, polaridades exploradas, awareness emergente…",
    placeholder_tarefa: "Ex: Praticar awareness corporal por 5 minutos ao dia…",
  },
  junguiana: {
    campos: ["Sonhos e imagens", "Arquétipos emergentes", "Material simbólico", "Estágio da individuação", "Amplificações"],
    placeholder_evolucao: "Descreva o processo de individuação, símbolos e arquétipos ativados…",
    placeholder_tarefa: "Ex: Registrar sonhos com detalhes e sensações ao acordar…",
  },
  humanista: {
    campos: ["Experiência interna relatada", "Qualidade da congruência", "Barreiras à autoexpressão", "Insights do processo", "Relação terapêutica"],
    placeholder_evolucao: "Descreva mudanças na autenticidade, movimentos de crescimento observados…",
    placeholder_tarefa: "Ex: Reservar 10 minutos diários para diário de sentimentos…",
  },
  comportamental: {
    campos: ["Comportamentos-alvo", "Análise ABC (antecedentes/consequências)", "Reforçadores identificados", "Mudanças no repertório", "Treinos realizados"],
    placeholder_evolucao: "Descreva mudanças na frequência/intensidade dos comportamentos-alvo…",
    placeholder_tarefa: "Ex: Registrar frequência do comportamento-alvo em tabela diária…",
  },
};

// ─── MOLDES DE TÉCNICAS TCC ──────────────────────────────────────────────────────
const MOLDES_TECNICAS = {
  "Registro ABC": {
    descricao: "Analisar situação, crença automática e consequência emocional",
    campos: [
      { id: "situacao", label: "A — Situação (Antecedente)", placeholder: "Descreva a situação que gerou a emoção…", tipo: "textarea" },
      { id: "crenca",   label: "B — Crença / Pensamento automático", placeholder: "Que pensamento passou pela sua cabeça?", tipo: "textarea" },
      { id: "emocao",   label: "C — Emoção / Consequência", placeholder: "Que emoção sentiu? Com que intensidade (0–10)?", tipo: "textarea" },
    ],
  },
  "ABCD": {
    descricao: "Registro com disputa racional do pensamento automático",
    campos: [
      { id: "a", label: "A — Antecedente", placeholder: "Situação que desencadeou o pensamento…", tipo: "textarea" },
      { id: "b", label: "B — Crença / Pensamento", placeholder: "Pensamento automático…", tipo: "textarea" },
      { id: "c", label: "C — Consequência emocional", placeholder: "Emoção e intensidade…", tipo: "textarea" },
      { id: "d", label: "D — Disputa (questione a crença)", placeholder: "Quais as evidências? Que alternativa racional existe?", tipo: "textarea" },
    ],
  },
  "Advogado de Defesa": {
    descricao: "Buscar evidências a favor e contra o pensamento, como um advogado",
    campos: [
      { id: "pa",        label: "Pensamento automático", placeholder: "Escreva o pensamento a ser examinado…", tipo: "textarea" },
      { id: "pro",       label: "Evidências favoráveis ao pensamento", placeholder: "O que apoia este pensamento?", tipo: "textarea" },
      { id: "contra",    label: "Evidências contrárias ao pensamento", placeholder: "O que contradiz este pensamento?", tipo: "textarea" },
      { id: "conclusao", label: "Conclusão mais balanceada", placeholder: "Considerando as evidências, qual seria um pensamento mais equilibrado?", tipo: "textarea" },
    ],
  },
  "ERP": {
    descricao: "Exposição com prevenção de resposta — enfrentar o estímulo sem realizar o ritual",
    campos: [
      { id: "situacao",  label: "Situação de exposição", placeholder: "Descreva a situação de exposição planejada…", tipo: "textarea" },
      { id: "suds",      label: "Nível de ansiedade esperado (SUDS 0–100)", placeholder: "Ex: 70", tipo: "input" },
      { id: "tempo",     label: "Tempo planejado sem ritual (minutos)", placeholder: "Ex: 20", tipo: "input" },
      { id: "resultado", label: "Resultado observado após exposição", placeholder: "O que aconteceu? A ansiedade cedeu?", tipo: "textarea" },
    ],
  },
  "Hierarquia de Exposição": {
    descricao: "Lista graduada de situações temidas, do mais leve ao mais intenso",
    campos: [
      { id: "item1", label: "Degrau 1 — Situação mais leve (SUDS ~20)", placeholder: "Descreva…", tipo: "textarea" },
      { id: "item2", label: "Degrau 2 (SUDS ~40)", placeholder: "Descreva…", tipo: "textarea" },
      { id: "item3", label: "Degrau 3 (SUDS ~60)", placeholder: "Descreva…", tipo: "textarea" },
      { id: "item4", label: "Degrau 4 (SUDS ~80)", placeholder: "Descreva…", tipo: "textarea" },
      { id: "item5", label: "Degrau 5 — Situação mais intensa (SUDS ~100)", placeholder: "Descreva…", tipo: "textarea" },
    ],
  },
  "Ativação Comportamental": {
    descricao: "Planejar atividades prazerosas e registrar prazer real versus esperado",
    campos: [
      { id: "atividade",       label: "Atividade planejada", placeholder: "Que atividade o paciente vai realizar?", tipo: "textarea" },
      { id: "prazer_esperado", label: "Prazer esperado (0–10)", placeholder: "Ex: 3", tipo: "input" },
      { id: "prazer_real",     label: "Prazer real após realizar (0–10)", placeholder: "Preencher na próxima sessão", tipo: "input" },
      { id: "obs",             label: "Observações clínicas", placeholder: "Barreiras, motivação, engajamento…", tipo: "textarea" },
    ],
  },
  "Reestruturação de Crença Central": {
    descricao: "Trabalhar crenças nucleares profundas com evidências e perspectivas alternativas",
    campos: [
      { id: "crenca",           label: "Crença central identificada", placeholder: "Ex: Sou incapaz / Não sou amável…", tipo: "textarea" },
      { id: "evidencias_contra",label: "Evidências contrárias à crença", placeholder: "Quais fatos contradizem essa crença?", tipo: "textarea" },
      { id: "nova_crenca",      label: "Crença alternativa mais adaptativa", placeholder: "Reformulação positiva e realista…", tipo: "textarea" },
      { id: "nivel",            label: "Nível de crença na nova perspectiva (0–100%)", placeholder: "Ex: 60%", tipo: "input" },
    ],
  },
  "Questionamento Socrático": {
    descricao: "Usar perguntas guiadas para explorar e questionar o pensamento automático",
    campos: [
      { id: "pa",          label: "Pensamento automático", placeholder: "Qual o pensamento a examinar?", tipo: "textarea" },
      { id: "perguntas",   label: "Perguntas de investigação utilizadas", placeholder: "Quais perguntas foram feitas durante a sessão?", tipo: "textarea" },
      { id: "perspectiva", label: "Perspectiva alternativa alcançada", placeholder: "A que conclusão o paciente chegou?", tipo: "textarea" },
    ],
  },
};

// Categorias visuais fixas para o fluxo socrático (mapeadas por índice do eixo)
const CATEGORIAS_SOCRATICAS = [
  { label: "Investigação",                       cor: "#6366f1", descricaoCategoria: "Examinar a validade do pensamento" },
  { label: "Exploração de perspectiva",          cor: "#0ea5e9", descricaoCategoria: "Ampliar o ponto de vista" },
  { label: "Construção de resposta alternativa", cor: "#10b981", descricaoCategoria: "Gerar perspectiva adaptativa" },
];

// ─── HELPER: normaliza plano retornado pela IA para o formato de display ────────
const normalizeAIPlano = (ai, paciente) => {
  const pergs = ai.perguntas || [];
  const eixos = [
    { eixo: "Investigação", descricao: "Analisar e examinar o pensamento automático", perguntas: pergs.slice(0,2).map((t,i) => ({ id:i+1, texto:t })) },
    { eixo: "Exploração de perspectiva", descricao: "Ampliar o campo de visão", perguntas: pergs.slice(2,4).map((t,i) => ({ id:i+3, texto:t })) },
    { eixo: "Construção de resposta alternativa", descricao: "Gerar perspectiva adaptativa", perguntas: pergs.slice(4).map((t,i) => ({ id:i+5, texto:t })) },
  ].filter(e => e.perguntas.length > 0);
  const ult = paciente.sessoesList?.[0];
  return {
    objetivo: ai.objetivo,
    itensRevisar: ult
      ? [`Verificar tarefa: ${ult.tarefa || "—"}`, `Resultado: ${ult.resultadoTarefa || "—"}`]
      : ["Iniciar primeira revisão com o paciente"],
    focoPrincipal: ai.objetivo,
    fluxoSocratico: eixos,
    tecnicas: ai.tecnicas || [],
    tarefa: ai.tarefa || "",
    obs: ai.observacoes || "",
    duracaoSugerida: "50 min",
    urgencia: paciente.risco === "alto" ? "alto" : "normal",
  };
};

// ─── TELA: PLANO DA SESSÃO ──────────────────────────────────────────────────────
const TelaPlano = ({ paciente, isMobile = false, terapeutaId }) => {
  const planoMock = PLANOS_GERADOS[paciente.id];
  const labels = LABELS_POR_LINHA[paciente.linha || "tcc"];

  // ── todos os hooks antes de qualquer return condicional ──
  const [planoCurrent, setPlanoCurrent] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState("");
  const [providerIA, setProviderIA] = useState(null);
  const [editando, setEditando] = useState(null);
  const [tarefaCustom, setTarefaCustom] = useState("");
  const [obsCustom, setObsCustom] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [perguntasEditadas, setPerguntasEditadas] = useState({});
  const [editandoPergunta, setEditandoPergunta] = useState(null);
  const [tarefaEditada, setTarefaEditada] = useState(false);
  const [obsEditada, setObsEditada] = useState(false);
  const [moldeAberto, setMoldeAberto] = useState(null);
  const [moldesDados, setMoldesDados] = useState({});
  const [moldesCustom, setMoldesCustom] = useState({});

  const plano = planoMock ?? planoCurrent;

  // reset ao trocar de paciente
  useEffect(() => {
    setPlanoCurrent(null);
    setGerando(false);
    setErroIA("");
    setProviderIA(null);
    setEditando(null);
    setTarefaEditada(false);
    setObsEditada(false);
    setMoldeAberto(null);
  }, [paciente.id]);

  // carrega plano salvo do Supabase ao abrir (só para pacientes reais sem mock)
  useEffect(() => {
    const pid = paciente?.id;
    if (typeof pid !== "string" || planoMock) return;
    buscarPlano(pid).then(({ data }) => {
      if (data) setPlanoCurrent(normalizeAIPlano(data, paciente));
    });
  }, [paciente.id]);

  // sincroniza campos editáveis quando o plano muda (mock ou IA)
  useEffect(() => {
    if (!plano) return;
    setTarefaCustom(plano.tarefa ?? "");
    setObsCustom(plano.obs ?? "");
    const obj = {};
    (plano.tecnicas || []).forEach(t => { obj[t] = ""; });
    setMoldesCustom(obj);
    const mapa = {};
    (plano.fluxoSocratico || []).forEach(eixo => {
      (eixo.perguntas || []).forEach(p => { mapa[p.id] = p.texto; });
    });
    setPerguntasEditadas(mapa);
  }, [paciente.id, plano?.objetivo, plano?.tarefa]);

  const gerarPlano = async () => {
    const ultimaSessao = paciente.sessoesList?.[0];
    if (!ultimaSessao) return;
    setGerando(true);
    setErroIA("");
    setProviderIA(null);
    try {
      const { plano: ai, provider } = await gerarPlanoSessao(paciente, ultimaSessao, setProviderIA);
      const convertido = normalizeAIPlano(ai, paciente);
      setPlanoCurrent(convertido);
      if (terapeutaId && terapeutaId !== "demo") {
        await salvarPlano(terapeutaId, paciente.id, {
          numero_proxima: (paciente.sessoes || 0) + 1,
          objetivo: ai.objetivo,
          tecnicas: ai.tecnicas,
          perguntas: ai.perguntas,
          distorcoes_foco: ai.distorcoes_foco,
          tarefa: ai.tarefa,
          observacoes: ai.observacoes,
          gerado_por: provider,
        });
      }
    } catch (err) {
      setErroIA(`Erro ao gerar plano: ${err.message}`);
    } finally {
      setGerando(false);
    }
  };

  const getMoldeKey = (tecnica) => `${paciente.id}__${tecnica}`;
  const getMoldeDados = (tecnica) => moldesDados[getMoldeKey(tecnica)] || {};
  const setMoldeCampo = (tecnica, campoId, valor) => {
    const key = getMoldeKey(tecnica);
    setMoldesDados(prev => ({ ...prev, [key]: { ...prev[key], [campoId]: valor } }));
  };
  const temMoldeSalvo = (tecnica) => {
    const dados = getMoldeDados(tecnica);
    return Object.values(dados).some(v => v && v.trim && v.trim() !== "");
  };

  if (!plano) {
    const podeGerar = typeof paciente.id === "string" && (paciente.sessoesList?.length ?? 0) > 0;
    return (
      <div style={{ padding: isMobile ? "20px 16px" : "48px 28px", height:"100%", overflowY:"auto" }}>
        <div style={{ textAlign:"center", color:"#94a3b8", maxWidth:440, margin:"0 auto" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
          {podeGerar ? (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:8 }}>
                Nenhum plano gerado para esta sessão
              </div>
              <div style={{ fontSize:13, marginBottom:24 }}>
                Gere um plano personalizado com base nas últimas {Math.min(paciente.sessoesList.length, 3)} sessões registradas.
              </div>
              {erroIA && (
                <div style={{ marginBottom:16, padding:"10px 14px", background:"#fff1f2",
                  border:"1px solid #fecdd3", borderRadius:10, fontSize:12, color:"#dc2626", textAlign:"left" }}>
                  {erroIA}
                </div>
              )}
              <button onClick={gerarPlano} disabled={gerando}
                style={{ padding:"12px 32px", background: gerando ? "#a5b4fc" : "#6366f1",
                  color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700,
                  cursor: gerando ? "default" : "pointer" }}>
                {gerando ? "Gerando plano…" : "🤖 Gerar plano com IA"}
              </button>
              {providerIA && (
                <div style={{ marginTop:8, fontSize:11, color:"#94a3b8" }}>
                  Usando: {providerIA === "gemini" ? "Google Gemini" : "Claude"}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:6 }}>
                Plano não disponível
              </div>
              <div style={{ fontSize:13 }}>
                {typeof paciente.id === "string"
                  ? "Importe ao menos uma sessão para gerar o plano com IA."
                  : "Este paciente ainda não tem sessões registradas para gerar um plano sugerido."}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const copiarPlano = () => {
    const linhas = [
      `PLANO — ${paciente.nome} | Sessão ${paciente.sessoes + 1}`,
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      `🎯 OBJETIVO\n${plano.objetivo}`,
      "",
      `🔍 FOCO PRINCIPAL\n${plano.focoPrincipal}`,
      "",
      `📋 ITENS A REVISAR\n${(plano.itensRevisar || []).map((it, i) => `${i+1}. ${it}`).join("\n")}`,
      "",
      `💬 PERGUNTAS SUGERIDAS`,
      ...(plano.fluxoSocratico || []).flatMap(eixo => [
        `\n[${eixo.eixo}]`,
        ...(eixo.perguntas || []).map(p => `• ${perguntasEditadas[p.id] ?? p.texto}`),
      ]),
      "",
      `🛠 TÉCNICAS\n${(plano.tecnicas || []).map(t => `• ${t}`).join("\n")}`,
      "",
      `📝 TAREFA DE CASA\n${tarefaCustom}`,
      "",
      `📌 OBSERVAÇÕES\n${obsCustom}`,
    ];
    navigator.clipboard.writeText(linhas.join("\n")).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    );
  };

  const handleSalvarTarefa = () => {
    if (editando === "tarefa" && tarefaCustom !== plano.tarefa) {
      setTarefaEditada(true);
      console.log("[ESTILO] Tarefa editada:", { original: plano.tarefa, editada: tarefaCustom, pacienteId: paciente.id });
    }
    setEditando(null);
  };

  const handleSalvarObs = () => {
    if (editando === "obs" && obsCustom !== plano.obs) {
      setObsEditada(true);
      console.log("[ESTILO] Obs editada:", { original: plano.obs, editada: obsCustom, pacienteId: paciente.id });
    }
    setEditando(null);
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", padding: isMobile ? "16px" : "24px 28px" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:4 }}>Plano sugerido pela IA</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color:"#0f172a" }}>
            Sessão {paciente.sessoes + 1} — {paciente.nome.split(" ")[0]}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            {plano.duracaoSugerida} estimados
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {plano.urgencia === "alto" && (
            <div style={{ padding:"6px 14px", background:"#fff1f2", border:"1px solid #fecdd3",
              borderRadius:8, fontSize:12, fontWeight:700, color:"#9f1239" }}>
              ⚠️ Sessão de risco
            </div>
          )}
          <button onClick={copiarPlano}
            style={{ padding:"8px 18px", background: copiado ? "#d1fae5" : "#6366f1",
              color: copiado ? "#065f46" : "#fff", border:"none", borderRadius:8,
              fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.2s" }}>
            {copiado ? "✓ Copiado!" : "Copiar plano"}
          </button>
        </div>
      </div>

      {/* Aviso IA */}
      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10,
        padding:"12px 16px", marginBottom:20, display:"flex", gap:10, alignItems:"flex-start" }}>
        <span style={{ fontSize:16, marginTop:1 }}>🤖</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#0c4a6e", marginBottom:2 }}>
            Gerado com base no histórico das últimas {paciente.sessoes} sessões
          </div>
          <div style={{ fontSize:11, color:"#0369a1" }}>
            Sugestões baseadas em protocolos TCC e ACT. O fluxo socrático segue sequência clínica — siga a ordem dos eixos e edite cada pergunta conforme seu estilo. Você tem a palavra final.
          </div>
          {(tarefaEditada || obsEditada) && (
            <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6,
              fontSize:11, color:"#065f46", fontWeight:700 }}>
              <span>✦</span>
              <span>Aprendendo seu estilo — edições registradas para personalização futura</span>
            </div>
          )}
        </div>
      </div>

      {/* Objetivo */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:8 }}>🎯 Objetivo da sessão</div>
        <div style={{ fontSize:14, color:"#0f172a", fontWeight:600, lineHeight:1.6 }}>
          {plano.objetivo}
        </div>
      </div>

      {/* Grid: Itens a revisar + Foco */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:16 }}>
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
          padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:10 }}>📋 Itens a revisar</div>
          {plano.itensRevisar.map((item, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ color: paciente.cor, fontWeight:700, fontSize:13,
                flexShrink:0, marginTop:1 }}>{i+1}.</span>
              <span style={{ fontSize:13, color:"#334155", lineHeight:1.5 }}>{item}</span>
            </div>
          ))}
        </div>

        <div style={{ background:`${paciente.cor}08`, border:`1px solid ${paciente.cor}20`,
          borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:10 }}>🔍 Foco principal</div>
          <div style={{ fontSize:13, color:"#0f172a", lineHeight:1.7,
            borderLeft:`3px solid ${paciente.cor}`, paddingLeft:12 }}>
            {plano.focoPrincipal}
          </div>
        </div>
      </div>

      {/* Fluxo socrático */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:16 }}>

        {/* Header com label e tooltip explicativo */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.07em" }}>💬 {labels.perguntas}</div>
          <span style={{ fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>
            Siga a sequência — cada eixo prepara o próximo
          </span>
        </div>

        {/* Eixos em sequência */}
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {plano.fluxoSocratico.map((eixo, ei) => {
            const cat = CATEGORIAS_SOCRATICAS[ei] || CATEGORIAS_SOCRATICAS[0];
            return (
            <div key={ei}>

              {/* Conector visual entre eixos */}
              {ei > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                  <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
                  <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600,
                    textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                    então
                  </span>
                  <div style={{ flex:1, height:1, background:"#e2e8f0" }}/>
                </div>
              )}

              {/* Header do eixo com categoria visual */}
              <div style={{ marginBottom:10 }}>
                {/* Badge de categoria */}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6,
                    padding:"3px 10px 3px 6px", borderRadius:20,
                    background:`${cat.cor}12`, border:`1px solid ${cat.cor}30` }}>
                    <div style={{ width:18, height:18, borderRadius:"50%",
                      background: cat.cor, display:"flex", alignItems:"center",
                      justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>{ei + 1}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color: cat.cor }}>
                      {cat.label}
                    </span>
                  </div>
                  <span style={{ fontSize:10, color:"#94a3b8", fontStyle:"italic" }}>
                    {cat.descricaoCategoria}
                  </span>
                </div>
                {/* Nome do eixo específico */}
                <div style={{ paddingLeft:4, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{eixo.eixo}</span>
                </div>
                <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.5, paddingLeft:4 }}>
                  {eixo.descricao}
                </div>
              </div>

              {/* Perguntas do eixo */}
              <div style={{ display:"flex", flexDirection:"column", gap:8, paddingLeft:28 }}>
                {eixo.perguntas.map((pergunta) => {
                  const estaEditando = editandoPergunta === pergunta.id;
                  const textoAtual = perguntasEditadas[pergunta.id] ?? pergunta.texto;
                  const foiEditada = textoAtual !== pergunta.texto;

                  return (
                    <div key={pergunta.id} style={{
                      borderRadius:8, border: estaEditando
                        ? `1.5px solid ${paciente.cor}`
                        : "1px solid #e2e8f0",
                      background: estaEditando ? `${paciente.cor}05` : "#f8fafc",
                      overflow:"hidden",
                      transition:"border-color 0.15s"
                    }}>

                      {/* Visualização ou edição */}
                      {estaEditando ? (
                        <textarea
                          value={textoAtual}
                          onChange={e => setPerguntasEditadas(prev => ({
                            ...prev, [pergunta.id]: e.target.value
                          }))}
                          autoFocus
                          style={{
                            width:"100%", padding:"10px 14px",
                            border:"none", background:"transparent",
                            fontSize:13, color:"#334155", lineHeight:1.6,
                            resize:"none", outline:"none",
                            boxSizing:"border-box", minHeight:72,
                            fontFamily:"inherit"
                          }}
                        />
                      ) : (
                        <div style={{ padding:"10px 14px", fontSize:13,
                          color:"#334155", lineHeight:1.6,
                          borderLeft:`3px solid ${foiEditada ? paciente.cor : "#6366f1"}` }}>
                          {textoAtual}
                          {foiEditada && (
                            <span style={{ marginLeft:8, fontSize:10, fontWeight:600,
                              color: paciente.cor, verticalAlign:"middle" }}>
                              ✎ editada
                            </span>
                          )}
                        </div>
                      )}

                      {/* Barra de ação */}
                      <div style={{
                        display:"flex", justifyContent:"flex-end", alignItems:"center",
                        padding:"4px 10px 6px",
                        borderTop: estaEditando ? `1px solid ${paciente.cor}30` : "none",
                        gap:8
                      }}>
                        {estaEditando ? (
                          <>
                            <button
                              onClick={() => {
                                setPerguntasEditadas(prev => ({
                                  ...prev, [pergunta.id]: pergunta.texto
                                }));
                                setEditandoPergunta(null);
                              }}
                              style={{ fontSize:11, color:"#94a3b8", background:"none",
                                border:"none", cursor:"pointer", padding:"2px 6px" }}>
                              Restaurar original
                            </button>
                            <button
                              onClick={() => setEditandoPergunta(null)}
                              style={{ fontSize:11, color: paciente.cor, background:"none",
                                border:"none", cursor:"pointer", fontWeight:700,
                                padding:"2px 8px" }}>
                              Salvar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditandoPergunta(pergunta.id)}
                            style={{ fontSize:11, color:"#94a3b8", background:"none",
                              border:"none", cursor:"pointer", padding:"2px 6px",
                              transition:"color 0.1s" }}
                            onMouseEnter={e => e.target.style.color = paciente.cor}
                            onMouseLeave={e => e.target.style.color = "#94a3b8"}>
                            Editar pergunta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Técnicas com moldes */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.07em" }}>🛠 {labels.material}</div>
          <span style={{ fontSize:10, color:"#94a3b8", fontStyle:"italic" }}>clique em 📋 molde para abrir o formulário</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {plano.tecnicas.map(t => {
            const temMolde = !!MOLDES_TECNICAS[t];
            const salvo = temMolde && temMoldeSalvo(t);
            const aberto = moldeAberto === t;
            const molde = MOLDES_TECNICAS[t];
            const dados = getMoldeDados(t);
            return (
              <div key={t}>
                {/* Linha da técnica */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                    <Badge tipo="tecnica">{t}</Badge>
                    {salvo && (
                      <span style={{ position:"absolute", top:-3, right:-3, width:8, height:8,
                        borderRadius:"50%", background:"#10b981",
                        border:"1.5px solid #fff" }} />
                    )}
                    {moldesCustom[t] && (
                      <span style={{ position:"absolute", top:-3, left:-3, width:8, height:8,
                        borderRadius:"50%", background:"#6366f1",
                        border:"1.5px solid #fff" }} />
                    )}
                  </div>
                  <button
                    onClick={() => setEditando(editando === `tecnica-${t}` ? null : `tecnica-${t}`)}
                    style={{ fontSize:11, padding:"2px 8px", borderRadius:6, cursor:"pointer",
                      border: editando === `tecnica-${t}` ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                      background: editando === `tecnica-${t}` ? "#f0f0ff" : "#f8fafc",
                      color: editando === `tecnica-${t}` ? "#6366f1" : "#64748b",
                      fontWeight: editando === `tecnica-${t}` ? 700 : 500, transition:"all 0.12s" }}>
                    🖊 personalizar
                  </button>
                  {temMolde && (
                    <button
                      onClick={() => setMoldeAberto(aberto ? null : t)}
                      style={{ fontSize:11, padding:"2px 8px", borderRadius:6, cursor:"pointer",
                        border: aberto ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                        background: aberto ? "#f0f0ff" : "#f8fafc",
                        color: aberto ? "#6366f1" : "#64748b",
                        fontWeight: aberto ? 700 : 500, transition:"all 0.12s" }}>
                      📋 molde
                    </button>
                  )}
                </div>

                {/* Painel de personalização inline */}
                {editando === `tecnica-${t}` && (
                  <div style={{ marginTop:8, padding:"14px 16px",
                    background:"#f8fafc", border:"1.5px solid #e2e8f0",
                    borderRadius:10, borderTop:"3px solid #6366f1" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#475569",
                      textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>
                      Anotações para "{t}"
                    </div>
                    <textarea
                      autoFocus
                      value={moldesCustom[t] || ""}
                      onChange={e => setMoldesCustom(prev => ({ ...prev, [t]: e.target.value }))}
                      placeholder={`Personalize como aplicar esta técnica na sessão de hoje…`}
                      style={{ width:"100%", padding:"8px 10px",
                        border:"1.5px solid #e2e8f0", borderRadius:8,
                        fontSize:12, color:"#0f172a", lineHeight:1.6,
                        resize:"vertical", outline:"none",
                        boxSizing:"border-box", minHeight:64,
                        fontFamily:"inherit", background:"#fff" }}
                    />
                    <div style={{ marginTop:8, display:"flex", justifyContent:"flex-end", gap:8 }}>
                      <button
                        onClick={() => setEditando(null)}
                        style={{ fontSize:11, color:"#94a3b8", background:"none",
                          border:"none", cursor:"pointer", padding:"2px 8px" }}>
                        Cancelar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        style={{ fontSize:11, color:"#6366f1", background:"none",
                          border:"none", cursor:"pointer", fontWeight:700, padding:"2px 8px" }}>
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel do molde */}
                {aberto && molde && (
                  <div style={{ marginTop:8, marginLeft:0, padding:"16px",
                    background:"#f8fafc", border:"1.5px solid #e2e8f0",
                    borderRadius:10, borderTop:"3px solid #6366f1" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#0f172a", marginBottom:4 }}>
                      {t}
                    </div>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:14 }}>
                      {molde.descricao}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      {molde.campos.map(campo => (
                        <div key={campo.id}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#475569",
                            marginBottom:4, textTransform:"uppercase",
                            letterSpacing:"0.05em" }}>{campo.label}</div>
                          {campo.tipo === "textarea" ? (
                            <textarea
                              value={dados[campo.id] || ""}
                              onChange={e => setMoldeCampo(t, campo.id, e.target.value)}
                              placeholder={campo.placeholder}
                              style={{ width:"100%", padding:"8px 10px",
                                border:"1.5px solid #e2e8f0", borderRadius:8,
                                fontSize:12, color:"#0f172a", lineHeight:1.6,
                                resize:"vertical", outline:"none",
                                boxSizing:"border-box", minHeight:64,
                                fontFamily:"inherit", background:"#fff" }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={dados[campo.id] || ""}
                              onChange={e => setMoldeCampo(t, campo.id, e.target.value)}
                              placeholder={campo.placeholder}
                              style={{ width:"100%", padding:"7px 10px",
                                border:"1.5px solid #e2e8f0", borderRadius:8,
                                fontSize:12, color:"#0f172a", outline:"none",
                                boxSizing:"border-box", background:"#fff" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop:12, display:"flex", alignItems:"center",
                      justifyContent:"space-between" }}>
                      {salvo ? (
                        <span style={{ fontSize:11, color:"#10b981", fontWeight:700,
                          display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:6, height:6, borderRadius:"50%",
                            background:"#10b981", display:"inline-block" }}/>
                          Conteúdo salvo nesta sessão
                        </span>
                      ) : (
                        <span style={{ fontSize:11, color:"#94a3b8" }}>
                          Os campos são salvos automaticamente enquanto você digita
                        </span>
                      )}
                      <button onClick={() => setMoldeAberto(null)}
                        style={{ fontSize:11, color:"#64748b", background:"none",
                          border:"none", cursor:"pointer", padding:"2px 8px" }}>
                        Fechar ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tarefa (editável) */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.07em" }}>📝 Tarefa de casa sugerida</div>
          <div style={{ display:"flex", gap:8 }}>
            {editando === "tarefa" && (
              <button onClick={() => { setTarefaCustom(plano.tarefa); setEditando(null); }}
                style={{ fontSize:11, color:"#94a3b8", background:"none", border:"none",
                  cursor:"pointer", padding:"2px 6px" }}>
                Restaurar original
              </button>
            )}
            <button onClick={() => editando === "tarefa" ? handleSalvarTarefa() : setEditando("tarefa")}
              style={{ fontSize:11, color:"#6366f1", background:"none", border:"none",
                cursor:"pointer", fontWeight:700, padding:"2px 8px" }}>
              {editando === "tarefa" ? "Salvar" : "Editar"}
            </button>
          </div>
        </div>
        {editando === "tarefa" ? (
          <textarea value={tarefaCustom} onChange={e => setTarefaCustom(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #6366f1",
              borderRadius:8, fontSize:13, color:"#0f172a", lineHeight:1.6,
              resize:"vertical", outline:"none", boxSizing:"border-box", minHeight:80 }}/>
        ) : (
          <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>{tarefaCustom}</div>
        )}
      </div>

      {/* Observações (editável) */}
      <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12,
        padding:"18px 20px", marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#92400e", textTransform:"uppercase",
            letterSpacing:"0.07em" }}>📌 Observações clínicas</div>
          <div style={{ display:"flex", gap:8 }}>
            {editando === "obs" && (
              <button onClick={() => { setObsCustom(plano.obs); setEditando(null); }}
                style={{ fontSize:11, color:"#94a3b8", background:"none", border:"none",
                  cursor:"pointer", padding:"2px 6px" }}>
                Restaurar original
              </button>
            )}
            <button onClick={() => editando === "obs" ? handleSalvarObs() : setEditando("obs")}
              style={{ fontSize:11, color:"#d97706", background:"none", border:"none",
                cursor:"pointer", fontWeight:700, padding:"2px 8px" }}>
              {editando === "obs" ? "Salvar" : "Editar"}
            </button>
          </div>
        </div>
        {editando === "obs" ? (
          <textarea value={obsCustom} onChange={e => setObsCustom(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #f59e0b",
              borderRadius:8, fontSize:13, color:"#0f172a", lineHeight:1.6,
              resize:"vertical", outline:"none", boxSizing:"border-box", minHeight:80 }}/>
        ) : (
          <div style={{ fontSize:13, color:"#78350f", lineHeight:1.6 }}>{obsCustom}</div>
        )}
      </div>

      {/* Teaser fase 2 */}
      <div style={{ background:"#f5f3ff", border:"1px dashed #c4b5fd", borderRadius:12,
        padding:"16px 20px", marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:6 }}>🔜 Em breve — App do paciente</div>
        <div style={{ fontSize:12, color:"#6d28d9" }}>
          Envie esta tarefa diretamente para o app de {paciente.nome.split(" ")[0]}.
          Ela receberá notificações de lembrete e poderá registrar o cumprimento em tempo real.
          <span style={{ fontWeight:700 }}> (Fase 2 — lista de espera aberta)</span>
        </div>
      </div>

      {/* Stub personalização adaptativa */}
      <div style={{ background:"#f8fafc", border:"1px dashed #e2e8f0", borderRadius:12,
        padding:"14px 18px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:6 }}>
          🧠 Personalização adaptativa
        </div>
        <div style={{ fontSize:12, color:"#94a3b8" }}>
          {tarefaEditada || obsEditada
            ? "Edições registradas. Nas próximas sessões, os planos já virão alinhados ao seu estilo."
            : "Edite os campos acima para ensinar o sistema o seu estilo clínico."}
        </div>
      </div>
    </div>
  );
};

// ─── TELA: IMPORTAR RELATÓRIO ──────────────────────────────────────────────────
const TelaImportar = ({ paciente, isMobile = false, terapeutaId, onSessaoSalva }) => {
  const [fase, setFase] = useState("upload"); // upload | processando | revisao | salvando
  const [drag, setDrag] = useState(false);
  const [textoManual, setTextoManual] = useState("");
  const [extraido, setExtraido] = useState(null);
  const [provider, setProvider] = useState(null);
  const [erroIA, setErroIA] = useState("");
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef(null);
  const cfg = CAMPOS_POR_LINHA[paciente.linha || "tcc"];

  const processarTexto = async (texto) => {
    if (!texto.trim()) { setErroIA("Cole ou carregue algum texto antes de continuar."); return; }
    setErroIA("");
    setFase("processando");
    try {
      const { sessao, provider: p } = await extrairSessaoDeTexto(texto, paciente.linha || "tcc", setProvider);
      setExtraido(sessao);
      setProvider(p);
      setFase("revisao");
    } catch (err) {
      console.error('[IA] Erro ao processar sessão:', err);
      setErroIA(`Erro: ${err.message}`);
      setFase("upload");
    }
  };

  const lerArquivo = (file) => {
    if (!file) return;
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = e => processarTexto(e.target.result);
      reader.readAsText(file, "utf-8");
    } else {
      setErroIA("Para PDF e Word: copie o texto e cole no campo abaixo.");
    }
  };

  const handleSalvar = async () => {
    if (!extraido) return;
    setSalvando(true);
    const proximoNumero = (paciente.sessoes || 0) + 1;
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    const novaSessao = {
      numero: proximoNumero,
      data: hoje,
      temas: extraido.temas || [],
      emocoes: extraido.emocoes || [],
      pensamentos: [],
      distorcoes: extraido.distorcoes || [],
      tecnicas: extraido.tecnicas || [],
      tarefa: extraido.tarefa_proxima || "",
      resultadoTarefa: extraido.resultado_tarefa || "",
      evolucao: extraido.resumo || "",
      alertas: extraido.alertas || [],
      obs: "",
      humor_inicio: extraido.humor_inicio,
      humor_fim: extraido.humor_fim,
    };
    // só persiste no Supabase quando o paciente for real (UUID string, não mock numérico)
    const pacienteReal = terapeutaId && terapeutaId !== "demo" && typeof paciente.id === "string";
    try {
      if (pacienteReal) {
        await criarSessao(terapeutaId, paciente.id, {
          numero: proximoNumero,
          data: hoje,
          resumo: extraido.resumo,
          temas: extraido.temas,
          distorcoes: extraido.distorcoes,
          tecnicas: extraido.tecnicas,
          emocoes: extraido.emocoes,
          alertas: extraido.alertas,
          resultado_tarefa: extraido.resultado_tarefa,
          tarefa_proxima: extraido.tarefa_proxima,
          humor_inicio: extraido.humor_inicio,
          humor_fim: extraido.humor_fim,
          notas_raw: textoManual,
        });
        await atualizarPaciente(paciente.id, { sessoes: proximoNumero });
      }
    } finally {
      setSalvando(false);
      onSessaoSalva?.(novaSessao);
    }
  };

  if (fase === "upload") return (
    <div style={{ padding: isMobile ? "16px" : "28px", height:"100%", overflowY:"auto" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
        letterSpacing:"0.08em", marginBottom:4 }}>Importar relatório</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#0f172a", marginBottom:6 }}>
        Nova sessão — {paciente.nome.split(" ")[0]}
      </div>
      <div style={{ fontSize:13, color:"#64748b", marginBottom:28 }}>
        Importe suas anotações e o sistema extrai automaticamente as informações clínicas via IA.
      </div>

      {erroIA && (
        <div style={{ marginBottom:16, padding:"10px 14px", background:"#fff1f2",
          border:"1px solid #fecdd3", borderRadius:10, fontSize:12, color:"#dc2626" }}>
          {erroIA}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); lerArquivo(e.dataTransfer.files[0]); }}
        onClick={() => fileInputRef.current?.click()}
        style={{ border: drag ? "2px solid #6366f1" : "2px dashed #cbd5e1",
          borderRadius:16, padding:"48px 24px", textAlign:"center",
          cursor:"pointer", background: drag ? "#f0f0ff" : "#fafafa",
          transition:"all 0.2s", marginBottom:20 }}>
        <input ref={fileInputRef} type="file" accept=".txt"
          style={{ display:"none" }} onChange={e => lerArquivo(e.target.files[0])} />
        <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:6 }}>
          Arraste um arquivo .txt ou clique para selecionar
        </div>
        <div style={{ fontSize:12, color:"#94a3b8" }}>Para PDF/Word: copie e cole o texto abaixo</div>
      </div>

      {/* Colar texto */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:8 }}>
          Ou cole suas anotações aqui:
        </div>
        <textarea
          value={textoManual}
          onChange={e => setTextoManual(e.target.value)}
          placeholder="Cole o texto das suas anotações da sessão…"
          style={{ width:"100%", height:120, padding:"12px", border:"1.5px solid #e2e8f0",
            borderRadius:10, fontSize:13, color:"#0f172a", resize:"none",
            outline:"none", boxSizing:"border-box", lineHeight:1.6, fontFamily:"inherit" }}/>
        <button onClick={() => processarTexto(textoManual)}
          style={{ marginTop:8, padding:"10px 24px", background:"#6366f1",
            color:"#fff", border:"none", borderRadius:8, fontSize:13,
            fontWeight:700, cursor:"pointer" }}>
          🤖 Gerar rascunho com IA
        </button>
        <div style={{ marginTop:6, fontSize:11, color:"#94a3b8", lineHeight:1.5 }}>
          Gera um rascunho editável — você revisa e ajusta antes de salvar
        </div>
      </div>

      {/* Formatos */}
      <div style={{ display:"flex", gap:10 }}>
        {["TXT", "Colar texto"].map(f => (
          <div key={f} style={{ padding:"4px 12px", background:"#f1f5f9", borderRadius:20,
            fontSize:11, color:"#64748b", fontWeight:600 }}>{f}</div>
        ))}
        <div style={{ padding:"4px 12px", background:"#f8f8f8", borderRadius:20,
          fontSize:11, color:"#cbd5e1", fontWeight:600 }}>PDF (em breve)</div>
      </div>
    </div>
  );

  if (fase === "processando") return (
    <div style={{ padding:"28px", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", height:"60%", textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:20 }}>🧠</div>
      <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginBottom:8 }}>
        Analisando com IA…
      </div>
      <div style={{ fontSize:13, color:"#64748b", marginBottom:28, maxWidth:300 }}>
        Extraindo emoções, pensamentos automáticos, distorções cognitivas e evolução clínica
      </div>
      {provider && (
        <div style={{ fontSize:11, color:"#94a3b8", marginBottom:8 }}>
          Usando: {provider === "gemini" ? "Google Gemini" : "Claude (fallback)"}
        </div>
      )}
      <div style={{ width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#6366f1",
        borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "16px" : "24px 28px", height:"100%", overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:20 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#10b981", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:4 }}>
            ✎ Rascunho gerado via {provider === "gemini" ? "Gemini" : "Claude"}
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:"#0f172a" }}>
            Rascunho gerado — Revise e edite antes de salvar
          </div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>
            Todos os campos são editáveis
          </div>
        </div>
      </div>

      {extraido && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:14 }}>
          {/* Temas */}
          <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
              letterSpacing:"0.07em", marginBottom:10 }}>{cfg.campos[0]}</div>
            {(extraido.temas || []).map((t,i) => (
              <div key={i} style={{ fontSize:13, color:"#334155", padding:"6px 0",
                borderBottom: i < (extraido.temas.length-1) ? "1px solid #f1f5f9" : "none" }}>
                {t}
              </div>
            ))}
          </div>

          {/* Emoções */}
          <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
              letterSpacing:"0.07em", marginBottom:10 }}>{cfg.campos[1]}</div>
            {(extraido.emocoes || []).map(e => {
              const cor = e.intensidade > 75 ? "#ef4444" : "#f59e0b";
              return <IntensidadeBar key={e.nome} nome={e.nome} valor={e.intensidade} cor={cor}/>;
            })}
          </div>

          {/* Resumo / Evolução */}
          <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
            padding:"16px", gridColumn: isMobile ? "1" : "1/-1" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
              letterSpacing:"0.07em", marginBottom:10 }}>{cfg.campos[2]}</div>
            <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>
              {extraido.resumo}
            </div>
          </div>

          {/* Distorções */}
          <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
              letterSpacing:"0.07em", marginBottom:10 }}>{cfg.campos[3]}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {(extraido.distorcoes || []).map(d => <Badge key={d} tipo="distorcao">{d}</Badge>)}
            </div>
          </div>

          {/* Alertas */}
          {(extraido.alertas || []).length > 0 && (
            <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:12,
              padding:"16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#be123c", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>⚠️ Alertas clínicos</div>
              {extraido.alertas.map((a,i) => (
                <div key={i} style={{ fontSize:13, color:"#be123c", lineHeight:1.5 }}>{a}</div>
              ))}
            </div>
          )}

          {/* Tarefa próxima */}
          {extraido.tarefa_proxima && (
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#166534", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>{cfg.campos[4]}</div>
              <div style={{ fontSize:13, color:"#166534", lineHeight:1.6 }}>
                {extraido.tarefa_proxima}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:20, display:"flex", gap:10 }}>
        <button onClick={() => { setFase("upload"); setExtraido(null); setErroIA(""); }}
          style={{ padding:"10px 20px", background:"#f1f5f9",
            color:"#475569", border:"none", borderRadius:8, fontSize:13,
            fontWeight:700, cursor:"pointer" }}>
          Refazer importação
        </button>
        <button onClick={handleSalvar} disabled={salvando}
          style={{ padding:"10px 24px", background: salvando ? "#a5b4fc" : "#6366f1",
            color:"#fff", border:"none", borderRadius:8, fontSize:13,
            fontWeight:700, cursor: salvando ? "default" : "pointer", flex:1 }}>
          {salvando ? "Salvando…" : "✓ Confirmar e salvar no histórico"}
        </button>
      </div>
    </div>
  );
};

// ─── TELA: PERFIL DO PACIENTE ─────────────────────────────────────────────────
const TelaPerfil = ({ paciente, isMobile = false, onAtualizar, onExcluir }) => {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const [excluirHistorico, setExcluirHistorico] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  const inicialForm = (p) => ({
    nome: p.nome || "",
    iniciais: p.iniciais || "",
    idade: p.idade || "",
    email: p.email || "",
    telefone: p.telefone || "",
    queixa: p.queixa || "",
    diagnostico: p.diagnostico || "",
    meta: p.meta || "",
    linha: p.linha || "tcc",
    risco: p.risco || "baixo",
    inicio: p.inicio || "",
    convenio: p.convenio || "",
    sessoes_pagas: p.sessoes_pagas ?? 0,
  });

  const [form, setForm] = useState(() => inicialForm(paciente));

  useEffect(() => {
    setForm(inicialForm(paciente));
    setEditando(false);
    setConfirmandoExcluir(false);
  }, [paciente.id]);

  const campo = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const atualizado = { ...paciente, ...form, iniciais: form.iniciais || gerarIniciais(form.nome) };
      await onAtualizar?.(atualizado);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    try { await onExcluir?.(paciente.id, excluirHistorico); }
    finally { setExcluindo(false); }
  };

  const corRisco = { baixo: "#10b981", medio: "#f59e0b", alto: "#ef4444" };
  const cor = corRisco[paciente.risco] || "#10b981";

  const inp = (ativo = true) => ({
    width: "100%", padding: "9px 12px", fontSize: 13, color: "#0f172a",
    border: `1.5px solid ${editando && ativo ? "#e2e8f0" : "#f1f5f9"}`,
    borderRadius: 8, background: editando && ativo ? "#fff" : "#f8fafc",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  });

  const Secao = ({ titulo }) => (
    <div style={{ gridColumn: "1/-1", paddingBottom: 8, marginBottom: 4, marginTop: 8,
      borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 700,
      color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {titulo}
    </div>
  );

  const Campo = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? "16px" : "20px 28px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={46} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
              {editando ? (form.nome || paciente.nome) : paciente.nome}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cor,
                background: `${cor}15`, padding: "2px 10px", borderRadius: 20,
                border: `1px solid ${cor}30` }}>
                {paciente.risco === "alto" ? "⚠️ " : ""}Risco {paciente.risco}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{paciente.sessoes} sessões</span>
              <span style={{ fontSize: 12, color: BANCO_PALAVRAS[paciente.linha]?.cor || "#6366f1",
                fontWeight: 600 }}>
                {BANCO_PALAVRAS[paciente.linha]?.label || "TCC"}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {editando ? (
            <>
              <button onClick={() => { setEditando(false); setForm(inicialForm(paciente)); }}
                style={{ padding: "7px 16px", background: "#f1f5f9", border: "none",
                  borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{ padding: "7px 16px", background: salvando ? "#a5b4fc" : "#6366f1",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  color: "#fff", cursor: salvando ? "default" : "pointer" }}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditando(true)}
              style={{ padding: "7px 16px", background: "#f0f0ff", border: "1.5px solid #e0e0ff",
                borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#4f46e5", cursor: "pointer" }}>
              ✎ Editar
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 24px" }}>

        <Secao titulo="Identificação" />
        <Campo label="Nome completo">
          <input value={form.nome} onChange={campo("nome")} readOnly={!editando} style={inp()} />
        </Campo>
        <Campo label="Iniciais">
          <input value={form.iniciais} onChange={campo("iniciais")} readOnly={!editando}
            placeholder={gerarIniciais(form.nome)} style={inp()} />
        </Campo>
        <Campo label="Idade">
          <input type="number" value={form.idade} onChange={campo("idade")} readOnly={!editando} style={inp()} />
        </Campo>
        <Campo label="Convênio / Plano">
          <input value={form.convenio} onChange={campo("convenio")} readOnly={!editando}
            placeholder="Particular" style={inp()} />
        </Campo>

        <Secao titulo="Contato" />
        <Campo label="E-mail">
          <input type="email" value={form.email} onChange={campo("email")} readOnly={!editando} style={inp()} />
        </Campo>
        <Campo label="Telefone / WhatsApp">
          <input type="tel" value={form.telefone} onChange={campo("telefone")} readOnly={!editando} style={inp()} />
        </Campo>

        <Secao titulo="Dados clínicos" />
        <div style={{ gridColumn: "1/-1" }}>
          <Campo label="Queixa principal">
            <textarea value={form.queixa} onChange={campo("queixa")} readOnly={!editando} rows={2}
              style={{ ...inp(), resize: "vertical" }} />
          </Campo>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <Campo label="Diagnóstico (CID)">
            <input value={form.diagnostico} onChange={campo("diagnostico")} readOnly={!editando} style={inp()} />
          </Campo>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <Campo label="Meta terapêutica">
            <textarea value={form.meta} onChange={campo("meta")} readOnly={!editando} rows={2}
              style={{ ...inp(), resize: "vertical" }} />
          </Campo>
        </div>
        <Campo label="Linha terapêutica">
          {editando ? (
            <select value={form.linha} onChange={campo("linha")}
              style={{ ...inp(), cursor: "pointer" }}>
              {Object.entries(BANCO_PALAVRAS).map(([v, cfg]) => (
                <option key={v} value={v}>{cfg.label}</option>
              ))}
            </select>
          ) : (
            <input value={BANCO_PALAVRAS[form.linha]?.label || form.linha} readOnly style={inp(false)} />
          )}
        </Campo>
        <Campo label="Nível de risco">
          {editando ? (
            <select value={form.risco} onChange={campo("risco")}
              style={{ ...inp(), cursor: "pointer" }}>
              <option value="baixo">Baixo</option>
              <option value="medio">Médio</option>
              <option value="alto">Alto</option>
            </select>
          ) : (
            <input value={form.risco.charAt(0).toUpperCase() + form.risco.slice(1)} readOnly style={inp(false)} />
          )}
        </Campo>
        <Campo label="Início do tratamento">
          <input value={form.inicio} onChange={campo("inicio")} readOnly={!editando}
            placeholder="Ex: Mar 2024" style={inp()} />
        </Campo>
        <Campo label="Sessões pagas">
          <input type="number" value={form.sessoes_pagas} onChange={campo("sessoes_pagas")}
            readOnly={!editando} style={inp()} />
        </Campo>

      </div>

      {/* Estatísticas (somente leitura) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
        margin: "20px 0", padding: "16px", background: "#f8fafc",
        borderRadius: 12, border: "1px solid #f1f5f9" }}>
        {[
          { l: "Sessões realizadas", v: paciente.sessoes },
          { l: "Adesão a tarefas", v: `${paciente.cumprimentoTarefas || paciente.adesao || 0}%` },
          { l: "Próxima sessão", v: paciente.proximaSessao || "Não agendada" },
        ].map(s => (
          <div key={s.l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Zona de perigo */}
      {!editando && (
        <div style={{ border: "1.5px solid #fecdd3", borderRadius: 12,
          padding: "16px 20px", background: confirmandoExcluir ? "#fff8f8" : "#fff",
          marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            Zona de perigo
          </div>
          {!confirmandoExcluir ? (
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                  Excluir paciente
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Remove o cadastro e opcionalmente todo o histórico de sessões.
                </div>
              </div>
              <button onClick={() => setConfirmandoExcluir(true)}
                style={{ padding: "8px 18px", background: "#fff1f2",
                  border: "1.5px solid #fecdd3", borderRadius: 8, fontSize: 12,
                  fontWeight: 700, color: "#dc2626", cursor: "pointer", flexShrink: 0 }}>
                Excluir paciente
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                ⚠️ Excluir {paciente.nome}?
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
                Esta ação não pode ser desfeita. O cadastro será removido permanentemente.
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10,
                marginBottom: 16, cursor: "pointer" }}>
                <input type="checkbox" checked={excluirHistorico}
                  onChange={e => setExcluirHistorico(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#dc2626", cursor: "pointer" }} />
                <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>
                  Excluir também o histórico de sessões&nbsp;
                  <span style={{ color: "#94a3b8" }}>
                    ({paciente.sessoes} {paciente.sessoes === 1 ? "sessão" : "sessões"})
                  </span>
                </span>
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmandoExcluir(false)}
                  style={{ padding: "8px 18px", background: "#f1f5f9", border: "none",
                    borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={excluir} disabled={excluindo}
                  style={{ padding: "8px 22px", background: excluindo ? "#fca5a5" : "#dc2626",
                    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    color: "#fff", cursor: excluindo ? "default" : "pointer" }}>
                  {excluindo ? "Excluindo…" : "Sim, excluir permanentemente"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── TELA: MURAL DE PALAVRAS-CHAVE ────────────────────────────────────────────
const TelaMural = ({ paciente }) => {
  const [linhaSelecionada, setLinhaSelecionada] = useState(paciente.linha || "tcc");
  const [palavrasSelecionadas, setPalavrasSelecionadas] = useState([]);
  const [inputCustom, setInputCustom] = useState("");
  const [busca, setBusca] = useState("");
  const [agrupado, setAgrupado] = useState(null);
  const [modo, setModo] = useState("mural");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const buscaRef = useRef(null);

  useEffect(() => {
    setLinhaSelecionada(paciente.linha || "tcc");
    setPalavrasSelecionadas([]);
    setAgrupado(null);
  }, [paciente.id]);

  const cfg = BANCO_PALAVRAS[linhaSelecionada];

  const todasPalavras = Object.values(cfg.categorias).flat();

  const sugestoes = busca.length >= 2
    ? todasPalavras.filter(p => p.toLowerCase().includes(busca.toLowerCase())).slice(0, 8)
    : [];

  const toggle = (palavra) => {
    setPalavrasSelecionadas(prev =>
      prev.includes(palavra) ? prev.filter(p => p !== palavra) : [...prev, palavra]
    );
    setAgrupado(null);
  };

  const trocarLinha = (linha) => {
    setLinhaSelecionada(linha);
    setPalavrasSelecionadas([]);
    setAgrupado(null);
    setBusca("");
  };

  const adicionarCustom = () => {
    const palavra = inputCustom.trim();
    if (!palavra) return;
    if (!palavrasSelecionadas.includes(palavra)) {
      setPalavrasSelecionadas(prev => [...prev, palavra]);
      setAgrupado(null);
    }
    setInputCustom("");
  };

  const organizar = () => {
    const res = {};
    palavrasSelecionadas.forEach(p => {
      let cat = "Outras";
      Object.entries(cfg.categorias).forEach(([c, lista]) => {
        if (lista.includes(p)) cat = c;
      });
      if (!res[cat]) res[cat] = [];
      res[cat].push(p);
    });
    if (linhaSelecionada === "tcc") {
      const dist = palavrasSelecionadas.filter(p => DISTORCOES_TCC.includes(p));
      if (dist.length) res["Distorções identificadas"] = dist;
    }
    setAgrupado(res);
  };

  const pillStyle = (ativa) => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
    border: ativa ? `1.5px solid ${cfg.cor}` : "1.5px solid #e2e8f0",
    background: ativa ? `${cfg.cor}12` : "#fff",
    color: ativa ? cfg.cor : "#475569",
    fontWeight: ativa ? 700 : 500,
    transition: "all 0.12s",
    userSelect: "none",
  });

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>

      {/* ── Coluna esquerda ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", borderRight: "1px solid #f1f5f9" }}>

        {/* Header */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          Mural de palavras-chave
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>
          {paciente.nome.split(" ")[0]}
        </div>

        {/* Seletor de linha teórica */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {Object.entries(BANCO_PALAVRAS).map(([key, val]) => {
            const ativa = linhaSelecionada === key;
            return (
              <button key={key} onClick={() => trocarLinha(key)}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: ativa ? `1.5px solid ${val.cor}` : "1.5px solid #e2e8f0",
                  background: ativa ? `${val.cor}15` : "#fff",
                  color: ativa ? val.cor : "#64748b",
                  fontWeight: ativa ? 700 : 500, transition: "all 0.12s",
                }}>
                {val.label}
              </button>
            );
          })}
        </div>

        {/* Busca com autocomplete */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            ref={buscaRef}
            value={busca}
            onChange={e => { setBusca(e.target.value); setDropdownAberto(true); }}
            onFocus={() => setDropdownAberto(true)}
            onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
            placeholder="Buscar palavra…"
            style={{
              width: "100%", padding: "8px 12px", border: "1.5px solid #e2e8f0",
              borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#f8fafc",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {dropdownAberto && sugestoes.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginTop: 4, overflow: "hidden",
            }}>
              {sugestoes.map(p => (
                <div key={p}
                  onMouseDown={() => { toggle(p); setBusca(""); setDropdownAberto(false); }}
                  style={{
                    padding: "8px 14px", fontSize: 13, cursor: "pointer",
                    color: palavrasSelecionadas.includes(p) ? cfg.cor : "#334155",
                    fontWeight: palavrasSelecionadas.includes(p) ? 700 : 400,
                    background: palavrasSelecionadas.includes(p) ? `${cfg.cor}08` : "#fff",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = palavrasSelecionadas.includes(p) ? `${cfg.cor}08` : "#fff"}
                >
                  {palavrasSelecionadas.includes(p) ? "✓ " : ""}{p}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toggle de modo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["mural", "Mural livre"], ["categorias", "Por categorias"]].map(([id, label]) => (
            <button key={id} onClick={() => setModo(id)}
              style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: "none",
                background: modo === id ? cfg.cor : "#f1f5f9",
                color: modo === id ? "#fff" : "#64748b",
                fontWeight: modo === id ? 700 : 500, transition: "all 0.12s",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Palavras — modo mural */}
        {modo === "mural" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {todasPalavras.map(p => {
              const ativa = palavrasSelecionadas.includes(p);
              return (
                <span key={p} onClick={() => toggle(p)} style={pillStyle(ativa)}>
                  {ativa ? "✓ " : ""}{p}
                </span>
              );
            })}
          </div>
        )}

        {/* Palavras — modo categorias */}
        {modo === "categorias" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
            {Object.entries(cfg.categorias).map(([cat, lista]) => (
              <div key={cat}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  color: cfg.cor, marginBottom: 8,
                }}>
                  {cat}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {lista.map(p => {
                    const ativa = palavrasSelecionadas.includes(p);
                    return (
                      <span key={p} onClick={() => toggle(p)} style={pillStyle(ativa)}>
                        {ativa ? "✓ " : ""}{p}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input de palavra personalizada */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={inputCustom}
            onChange={e => setInputCustom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && adicionarCustom()}
            placeholder="Adicionar palavra personalizada…"
            style={{
              flex: 1, padding: "8px 12px", border: "1.5px solid #e2e8f0",
              borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#f8fafc",
              outline: "none",
            }}
          />
          <button onClick={adicionarCustom}
            style={{
              padding: "8px 14px", background: cfg.cor, color: "#fff",
              border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* ── Coluna direita ── */}
      <div style={{ width: 300, flexShrink: 0, overflowY: "auto", padding: "24px 20px", background: "#fafafa" }}>

        {/* Contador */}
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: cfg.cor, lineHeight: 1 }}>
            {palavrasSelecionadas.length}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>
            palavras selecionadas
          </div>
        </div>

        {/* Pills das selecionadas */}
        {palavrasSelecionadas.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {palavrasSelecionadas.map(p => (
              <span key={p} onClick={() => toggle(p)}
                style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  border: `1.5px solid ${cfg.cor}`, background: `${cfg.cor}12`,
                  color: cfg.cor, fontWeight: 700,
                }}>
                {p} ×
              </span>
            ))}
          </div>
        )}

        {/* Botão organizar */}
        {palavrasSelecionadas.length > 0 && agrupado === null && (
          <button onClick={organizar}
            style={{
              width: "100%", padding: "10px 0", background: cfg.cor, color: "#fff",
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: "pointer", marginBottom: 16,
            }}>
            🔀 Organizar
          </button>
        )}

        {/* Resultado do agrupamento */}
        {agrupado !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {Object.entries(agrupado).map(([cat, lista]) => {
              const isDistorcao = cat === "Distorções identificadas";
              return (
                <div key={cat} style={{
                  background: isDistorcao ? "#fff1f2" : "#fff",
                  border: isDistorcao ? "1px solid #fecdd3" : "1px solid #f1f5f9",
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 8,
                    color: isDistorcao ? "#be123c" : cfg.cor,
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {lista.map(p => (
                      <span key={p} style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: isDistorcao ? "#fecdd3" : `${cfg.cor}12`,
                        color: isDistorcao ? "#9f1239" : cfg.cor,
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Botões pós-agrupamento */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAgrupado(null)}
                style={{
                  flex: 1, padding: "8px 0", background: "#f1f5f9", color: "#475569",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                Refazer
              </button>
              <button onClick={() => {
                  const linhas = Object.entries(agrupado).map(([cat, palavras]) =>
                    `[${cat}]\n${palavras.map(p => `• ${p}`).join("\n")}`
                  );
                  const texto = `MURAL — ${paciente.nome}\n${new Date().toLocaleDateString("pt-BR")}\n\n${linhas.join("\n\n")}`;
                  navigator.clipboard.writeText(texto).catch(() => {});
                }}
                style={{
                  flex: 2, padding: "8px 0", background: cfg.cor, color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                Copiar para relatório ✓
              </button>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {palavrasSelecionadas.length === 0 && (
          <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 12, marginTop: 24 }}>
            Clique nas palavras do banco para adicioná-las aqui.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TELA: INSIGHTS LONGITUDINAIS ─────────────────────────────────────────────
const TelaInsights = ({ paciente, analise }) => {
  if (!analise) return (
    <div style={{ padding:"48px 28px", textAlign:"center", color:"#94a3b8" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
      <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:6 }}>Dados insuficientes</div>
      <div style={{ fontSize:13 }}>São necessárias pelo menos 2 sessões registradas para gerar insights.</div>
    </div>
  );

  const { topDistorcoes, humores, tarefasConcluidas, tarefasParciais, tarefasNaoFeitas, alertas } = analise;
  const totalSessoes = paciente.sessoesList.length;
  const totalComTarefa = tarefasConcluidas + tarefasParciais + tarefasNaoFeitas;
  const pctCompletas = totalComTarefa > 0 ? Math.round((tarefasConcluidas / totalComTarefa) * 100) : 0;
  const ultimaSessaoAlerta = paciente.sessoesList.find(s => s.alertas && s.alertas.length > 0);

  const exportarRelatorio = () => {
    const linhas = [
      `RELATÓRIO DE INSIGHTS — ${paciente.nome}`,
      `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      `Total de sessões analisadas: ${totalSessoes}`,
      `Tarefas completas: ${pctCompletas}%`,
      "",
      "TOP DISTORÇÕES:",
      ...topDistorcoes.map(d => `  • ${d.nome} — ${d.count}x (${d.percentual}% das sessões)`),
      "",
      "ALERTAS AUTOMÁTICOS:",
      ...(alertas.length ? alertas.map(a => `  ⚠️ ${a.msg}`) : ["  Nenhum alerta identificado."]),
    ];
    const texto = linhas.join("\n");
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insights-${paciente.nome.replace(/\s+/g, "-").toLowerCase()}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG da linha do tempo emocional
  const svgW = 480, svgH = 80, padX = 32, padY = 10;
  const hPoints = humores.slice().reverse();
  const svgPts = hPoints.map((h, i) => {
    const x = padX + (i / Math.max(hPoints.length - 1, 1)) * (svgW - padX * 2);
    const y = padY + ((h.media / 100) * (svgH - padY * 2));
    return { x, y, ...h };
  });
  const polyline = svgPts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"24px 28px" }}>

      {/* ── Seção 1: Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:4 }}>Análise longitudinal</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>
            Insights — {paciente.nome.split(" ")[0]}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            Baseado em {totalSessoes} sessão{totalSessoes !== 1 ? "s" : ""} registrada{totalSessoes !== 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={exportarRelatorio}
          style={{ padding:"8px 18px", background:"#0f172a", color:"#fff", border:"none",
            borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          Exportar relatório
        </button>
      </div>

      {/* ── Seção 2: Cards de métricas ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total de sessões", val: totalSessoes, sub:"registradas", cor:"#6366f1" },
          { label:"Tarefas completas", val: `${pctCompletas}%`, sub:`${tarefasConcluidas} de ${totalComTarefa}`, cor:"#10b981" },
          { label:"Distorção principal", val: topDistorcoes[0]?.nome ?? "—", sub: topDistorcoes[0] ? `${topDistorcoes[0].percentual}% das sessões` : "dados insuficientes", cor:"#f59e0b" },
          { label:"Última sessão c/ alerta", val: ultimaSessaoAlerta ? `Sessão ${ultimaSessaoAlerta.numero}` : "Nenhuma", sub: ultimaSessaoAlerta ? ultimaSessaoAlerta.data : "sem alertas recentes", cor:"#ef4444" },
        ].map(({ label, val, sub, cor }) => (
          <div key={label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px",
            border:"1px solid #f1f5f9", borderTop:`3px solid ${cor}` }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#0f172a", marginBottom:2, lineHeight:1.3 }}>{val}</div>
            <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
              letterSpacing:"0.05em", marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:11, color:"#cbd5e1" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Seção 3: Alertas automáticos ── */}
      {alertas.length > 0 && (
        <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:12,
          padding:"14px 18px", marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#9f1239", marginBottom:10 }}>
            ⚠️ Alertas automáticos
          </div>
          {alertas.map((a, i) => (
            <div key={i} style={{ fontSize:13, color:"#be123c", marginBottom: i < alertas.length - 1 ? 6 : 0 }}>
              • {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── Seção 4: Top distorções ── */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:14 }}>Top distorções cognitivas</div>
        {topDistorcoes.length === 0 && (
          <div style={{ fontSize:13, color:"#94a3b8" }}>Nenhuma distorção registrada nas sessões.</div>
        )}
        {topDistorcoes.map(d => (
          <div key={d.nome} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:13, color:"#334155", fontWeight:600 }}>{d.nome}</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#f59e0b" }}>{d.percentual}% · {d.count}x</span>
            </div>
            <div style={{ background:"#f1f5f9", borderRadius:99, height:6, overflow:"hidden" }}>
              <div style={{ width:`${d.percentual}%`, background:"#f59e0b", height:"100%",
                borderRadius:99, transition:"width 0.8s ease" }}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Seção 5: Linha do tempo emocional ── */}
      <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12,
        padding:"18px 20px", marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:14 }}>Intensidade emocional média por sessão</div>
        {hPoints.length < 2 ? (
          <div style={{ fontSize:13, color:"#94a3b8" }}>Dados insuficientes para o gráfico.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <svg width={svgW} height={svgH + 24} style={{ display:"block" }}>
              <polyline points={polyline} fill="none" stroke={paciente.cor}
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}/>
              {svgPts.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={4} fill={paciente.cor} opacity={0.9}/>
                  <text x={p.x} y={svgH + 20} textAnchor="middle"
                    style={{ fontSize:10, fill:"#94a3b8", fontFamily:"inherit" }}>
                    S{p.num}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

    </div>
  );
};

// ─── APP PRINCIPAL ──────────────────────────────────────────────────────────────
export default function App() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isCompact = bp === "mobile" || bp === "tablet";
  const [pacientesLista, setPacientesLista] = useState(PACIENTES);
  const [paciente, setPaciente] = useState(PACIENTES[0]);
  const [aba, setAba] = useState("historico");
  const [menuAberto, setMenuAberto] = useState(true);
  const [mostrarPacientes, setMostrarPacientes] = useState(false);
  const [sessaoAuth, setSessaoAuth] = useState(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  const mapearPaciente = (p, idx) => ({
    ...p,
    cor: CORES_AVATAR[idx % CORES_AVATAR.length],
    adesao: p.adesao ?? 0,
    humor: p.humor ?? [5,5,5,5,5,5,5],
    crenças: p.crenças ?? [],
    distorcoesFrequentes: p.distorcoesFrequentes ?? [],
    tarefaAtual: p.tarefaAtual ?? "",
    cumprimentoTarefas: p.cumprimentoTarefas ?? 0,
    proximaSessao: p.proximaSessao ?? "Não agendado",
    sessoesList: p.sessoesList ?? [],
  });

  useEffect(() => {
    if (hasSupabase) testarConexao();
    if (import.meta.env.VITE_GEMINI_API_KEY) testarChavesIA();
    const { data } = onAuthStateChange(async (evento, sessao) => {
      setSessaoAuth(sessao);
      setCarregandoAuth(false);
      if (sessao?.user?.id && sessao.user.id !== "demo") {
        const { data: lista } = await listarPacientes(sessao.user.id);
        if (lista && lista.length > 0) {
          const mapeados = lista.map(mapearPaciente);
          setPacientesLista(mapeados);
          setPaciente(mapeados[0]);
        }
        // lista vazia → mantém PACIENTES demo já no estado inicial
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  // normaliza registro do Supabase para o formato de UI usado em sessoesList
  const mapearSessao = (s) => ({
    numero: s.numero,
    data: s.data,
    temas: s.temas || [],
    emocoes: s.emocoes || [],
    pensamentos: [],
    distorcoes: s.distorcoes || [],
    tecnicas: s.tecnicas || [],
    tarefa: s.tarefa_proxima || "",
    resultadoTarefa: s.resultado_tarefa || "",
    evolucao: s.resumo || "",
    alertas: s.alertas || [],
    obs: "",
    humor_inicio: s.humor_inicio,
    humor_fim: s.humor_fim,
  });

  // auto-carrega sessões do Supabase sempre que o paciente selecionado mudar
  useEffect(() => {
    const pid = paciente?.id;
    if (typeof pid !== "string") return; // mock (número) → skip
    listarSessoes(pid).then(({ data }) => {
      if (!data || data.length === 0) return;
      const mapeadas = data.map(mapearSessao);
      setPaciente(prev => prev.id === pid ? { ...prev, sessoesList: mapeadas } : prev);
    });
  }, [paciente?.id]);

  const handleSessaoSalva = (novaSessao) => {
    setPaciente(prev => ({
      ...prev,
      sessoes: prev.sessoes + 1,
      sessoesList: [novaSessao, ...prev.sessoesList],
    }));
    setAba("historico");
  };

  const handleNovoPaciente = (novo) => {
    setPacientesLista(prev => [...prev, novo]);
  };

  const handleAtualizarPaciente = async (atualizado) => {
    setPacientesLista(prev => prev.map(p => p.id === atualizado.id ? atualizado : p));
    setPaciente(atualizado);
    const tid = sessaoAuth?.user?.id;
    if (typeof atualizado.id === "string" && tid && tid !== "demo") {
      await atualizarPaciente(atualizado.id, {
        nome: atualizado.nome,
        iniciais: atualizado.iniciais,
        queixa: atualizado.queixa,
        diagnostico: atualizado.diagnostico,
        meta: atualizado.meta,
        linha: atualizado.linha,
        risco: atualizado.risco,
        inicio: atualizado.inicio,
        sessoes_pagas: Number(atualizado.sessoes_pagas) || 0,
      });
    }
  };

  const handleExcluirPaciente = async (id) => {
    const restantes = pacientesLista.filter(p => p.id !== id);
    setPacientesLista(restantes);
    if (paciente.id === id) {
      setPaciente(restantes[0] ?? null);
      setAba("historico");
    }
    const tid = sessaoAuth?.user?.id;
    if (typeof id === "string" && tid && tid !== "demo") {
      await excluirPaciente(id);
    }
  };

  if (carregandoAuth) return <TelaCarregando />;
  if (!sessaoAuth) return <TelaLogin onAuth={setSessaoAuth} />;

  const terapeutaId = sessaoAuth?.user?.id;

  const abas = [
    { id:"historico", label:"Histórico", icon:"📋" },
    { id:"mural", label:"Mural", icon:"🏷️" },
    { id:"plano", label:"Próx. sessão", icon:"🎯" },
    { id:"importar", label:"Importar", icon:"📥" },
    { id:"insights", label:"Insights", icon:"📊" },
    { id:"perfil", label:"Perfil", icon:"🪪" },
  ];

  if (isCompact) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", position:"relative", fontFamily:"'DM Sans', system-ui, sans-serif", background:"#f8fafc", color:"#0f172a", fontSize:14 }}>

        {/* Header topo */}
        <div style={{ background:"#fff", borderBottom:"1px solid #f1f5f9", padding:"0 16px", display:"flex", alignItems:"center", height:52, gap:10, flexShrink:0 }}>
          <div style={{ width:28, height:28, background:"#6366f1", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:14 }}>C</div>
          <button onClick={() => setMostrarPacientes(true)}
            style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"6px 10px", cursor:"pointer" }}>
            <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={24} />
            <span style={{ fontSize:13, fontWeight:700, color:"#0f172a", flex:1, textAlign:"left", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{paciente.nome}</span>
            <span style={{ fontSize:12, color:"#94a3b8" }}>▾</span>
          </button>
          <div style={{ padding:"4px 10px", background: paciente.proximaSessao.includes("Hoje") ? "#fff1f2" : "#f1f5f9", borderRadius:8, fontSize:11, fontWeight:700, color: paciente.proximaSessao.includes("Hoje") ? "#dc2626" : "#475569", flexShrink:0 }}>
            {paciente.proximaSessao.includes("Hoje") ? "🔴 Hoje" : paciente.proximaSessao}
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {aba === "historico" && <TelaHistorico paciente={paciente} isMobile={isMobile} />}
          {aba === "mural" && <TelaMural paciente={paciente} />}
          {aba === "plano" && <TelaPlano paciente={paciente} isMobile={isMobile} terapeutaId={terapeutaId} />}
          {aba === "importar" && <TelaImportar paciente={paciente} isMobile={isMobile} terapeutaId={terapeutaId} onSessaoSalva={handleSessaoSalva} />}
          {aba === "insights" && <TelaInsights paciente={paciente} analise={analisarPadroes(paciente.sessoesList)} />}
          {aba === "perfil" && <TelaPerfil paciente={paciente} isMobile={isMobile} onAtualizar={handleAtualizarPaciente} onExcluir={handleExcluirPaciente} />}
        </div>

        {/* Nav bottom */}
        <div style={{ background:"#fff", borderTop:"1px solid #f1f5f9", display:"flex", height:60, flexShrink:0 }}>
          {[
            { id:"historico", label:"Histórico", icon:"📋" },
            { id:"plano", label:"Plano", icon:"🎯" },
            { id:"importar", label:"Importar", icon:"📥" },
            { id:"perfil", label:"Perfil", icon:"🪪" },
          ].map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, border:"none", background:"transparent", cursor:"pointer", borderTop: aba === a.id ? "2px solid #6366f1" : "2px solid transparent" }}>
              <span style={{ fontSize:20 }}>{a.icon}</span>
              <span style={{ fontSize:10, fontWeight: aba === a.id ? 700 : 500, color: aba === a.id ? "#4f46e5" : "#94a3b8" }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer bottom-sheet de pacientes */}
        {mostrarPacientes && (
          <>
            <div onClick={() => setMostrarPacientes(false)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:40 }} />
            <div style={{ position:"fixed", bottom:0, left:0, right:0, height:"85vh", background:"#fff", borderRadius:"20px 20px 0 0", zIndex:50, overflow:"hidden", boxShadow:"0 -4px 24px rgba(0,0,0,0.12)" }}>
              <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
                <div style={{ width:36, height:4, background:"#e2e8f0", borderRadius:99 }} />
              </div>
              <div style={{ height:"calc(100% - 28px)", overflow:"hidden" }}>
                <TelaPacientes
                  pacientes={pacientesLista}
                  onSelect={p => { setPaciente(p); setAba("historico"); setMostrarPacientes(false); }}
                  pacienteSelecionado={paciente}
                  onClose={() => setMostrarPacientes(false)}
                  onNovoPaciente={handleNovoPaciente}
                  terapeutaId={terapeutaId}
                  menuAberto={true}
                />
              </div>
            </div>
          </>
        )}

        {/* Carrega fonte */}
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'DM Sans', system-ui, sans-serif",
      background:"#f8fafc", color:"#0f172a", fontSize:14, overflow:"hidden" }}>

      {/* Sidebar esquerda — lista de pacientes */}
      <div style={{ width: menuAberto ? 280 : 56, flexShrink:0, background:"#fff",
        borderRight:"1px solid #f1f5f9", display:"flex", flexDirection:"column",
        height:"100vh", overflow:"hidden", transition:"width 0.25s ease" }}>

        {/* Logo + hamburguer */}
        <div style={{ padding:"0 12px", borderBottom:"1px solid #f1f5f9",
          display:"flex", alignItems:"center", height:68, flexShrink:0,
          justifyContent: menuAberto ? "flex-start" : "center", gap:10 }}>
          {menuAberto && (
            <>
              <div style={{ width:32, height:32, background:"#6366f1", borderRadius:8, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", fontWeight:900, fontSize:16 }}>C</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#0f172a" }}>Copiloto</div>
                <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600,
                  textTransform:"uppercase", letterSpacing:"0.06em" }}>TCC · MVP</div>
              </div>
            </>
          )}
          <button onClick={() => setMenuAberto(v => !v)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:6,
              color:"#64748b", fontSize:20, lineHeight:1, flexShrink:0,
              borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ☰
          </button>
        </div>

        <div style={{ flex:1, overflow:"hidden" }}>
          <TelaPacientes
            pacientes={pacientesLista}
            onSelect={p => { setPaciente(p); setAba("historico"); }}
            pacienteSelecionado={paciente}
            onNovoPaciente={handleNovoPaciente}
            terapeutaId={terapeutaId}
            menuAberto={menuAberto} />
        </div>
      </div>

      {/* Área principal */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Barra de navegação superior */}
        <div style={{ background:"#fff", borderBottom:"1px solid #f1f5f9",
          padding:"0 28px", display:"flex", alignItems:"center",
          height:56, flexShrink:0, gap:4 }}>

          {/* Breadcrumb */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:24 }}>
            <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={28} />
            <span style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>{paciente.nome}</span>
            <span style={{ fontSize:12, color:"#cbd5e1" }}>·</span>
            <span style={{ fontSize:12, color:"#94a3b8" }}>Sessão {paciente.sessoes}</span>
          </div>

          {/* Abas */}
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ padding:"6px 16px", border:"none", borderRadius:8, cursor:"pointer",
                background: aba === a.id ? "#f0f0ff" : "transparent",
                color: aba === a.id ? "#4f46e5" : "#64748b",
                fontWeight: aba === a.id ? 700 : 500, fontSize:13,
                transition:"all 0.15s" }}>
              {a.icon} {a.label}
            </button>
          ))}

          {/* Próxima sessão destaque */}
          <div style={{ marginLeft:"auto", padding:"5px 14px",
            background: paciente.proximaSessao.includes("Hoje") ? "#fff1f2" : "#f1f5f9",
            borderRadius:8, fontSize:12, fontWeight:700,
            color: paciente.proximaSessao.includes("Hoje") ? "#dc2626" : "#475569" }}>
            {paciente.proximaSessao.includes("Hoje") ? "🔴 " : "📅 "}
            {paciente.proximaSessao}
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {aba === "historico" && <TelaHistorico paciente={paciente} />}
          {aba === "mural" && <TelaMural paciente={paciente} />}
          {aba === "plano" && <TelaPlano key={paciente.id} paciente={paciente} terapeutaId={terapeutaId} />}
          {aba === "importar" && <TelaImportar paciente={paciente} terapeutaId={terapeutaId} onSessaoSalva={handleSessaoSalva} />}
          {aba === "insights" && <TelaInsights paciente={paciente} analise={analisarPadroes(paciente.sessoesList)} />}
          {aba === "perfil" && <TelaPerfil paciente={paciente} onAtualizar={handleAtualizarPaciente} onExcluir={handleExcluirPaciente} />}
        </div>
      </div>

      {/* Carrega fonte */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    </div>
  );
}
