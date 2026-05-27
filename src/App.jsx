import { useState, useRef, useEffect } from "react";
import { onAuthStateChange, signOut } from "./services/auth.js";
import { supabase, hasSupabase, testarConexao } from "./services/supabase.js";
import TelaLogin from "./components/TelaLogin.jsx";
import TelaCarregando from "./components/TelaCarregando.jsx";
import { extrairSessaoDeTexto, gerarPlanoSessao } from "./services/ia.js";
import { salvarPlano, buscarPlano, atualizarPlano, buscarPlanoDaSessao, buscarPlanosEditados } from "./services/planos.js";
import { testarChavesIA } from "./services/testarIA.js";
import { listarSessoes, criarSessao } from "./services/sessoes.js";
import { listarPacientes, atualizarPaciente, deletarPaciente, restaurarPaciente, listarPacientesArquivados, criarPaciente as criarPacienteService } from "./services/pacientes.js";
import { listarAgendamentos, criarAgendamento, atualizarAgendamento, cancelarAgendamento } from "./services/agendamentos.js";
import { criarTarefa, listarTarefas } from "./services/tarefas.js";
import { criarConvite, gerarLinkConvite, listarConvitesPaciente, revogarConvite } from "./services/convites.js";
import { listarRegistrosDoPaciente } from "./services/registros.js";
import { buscarAuditLogPaciente, formatarEntradaLog } from "./services/auditoria.js";
import { exportarJSON, exportarCSV } from "./services/exportacao.js";
import { listarHumorPaciente, buscarUltimoHumorPorPacientes } from "./services/humor_service.js";
import { buscarTerapeuta, atualizarTerapeuta, marcarOnboardingConcluido } from "./services/terapeutas.js";

// ─── IDENTIDADE VINCULI ───────────────────────────────────────────────────────
// Paleta de marca
const VINCULI = {
  laranja:  "#E28743",
  dourado:  "#EAB852",
  rosa:     "#F1A7A6",
  grafite:  "#2C302E",
  branco:   "#FFFFFF",
  laranjaHover: "#C97535",
  rosaClaro: "#FDF0EF",
};

// Ícone isolado — duas formas orgânicas em abraço
const VinculiIcon = ({ size = 32, dark = false }) => {
  const c1 = dark ? "#FFFFFF" : VINCULI.laranja;
  const c2 = dark ? "#FFFFFF" : VINCULI.dourado;
  const c3 = dark ? "#FFFFFF" : VINCULI.rosa;
  const op2 = dark ? 0.6 : 0.85;
  return (
    <svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 44 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink:0 }}>
      {/* Forma 1 — Laranja Suave */}
      <ellipse cx="18" cy="18" rx="14" ry="8.5" transform="rotate(-32 18 18)" fill={c1} opacity="0.92"/>
      {/* Forma 2 — Amarelo Dourado */}
      <ellipse cx="26" cy="18" rx="14" ry="8.5" transform="rotate(32 26 18)" fill={c2} opacity={op2}/>
      {/* Centro — espaço terapêutico (Rosa Sereno) */}
      <circle cx="22" cy="18" r="3.8" fill={c3} opacity="0.96"/>
    </svg>
  );
};

// Assinatura Preferencial — horizontal: ícone + wordmark
const VinculiAssinatura = ({ size = "md", dark = false }) => {
  const textColor = dark ? "#FFFFFF" : VINCULI.grafite;
  const sizes = { sm: { icon: 22, font: 15, gap: 7 }, md: { icon: 30, font: 20, gap: 9 }, lg: { icon: 42, font: 28, gap: 12 } };
  const s = sizes[size] || sizes.md;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:s.gap, userSelect:"none" }}>
      <VinculiIcon size={s.icon} dark={dark} />
      <span style={{
        fontFamily:"'Playfair Display', 'Lora', Georgia, serif",
        fontSize:s.font, fontWeight:400, color:textColor,
        letterSpacing:"0.04em", lineHeight:1,
      }}>Vinculi</span>
    </div>
  );
};

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
    label: "TCC", cor: "#E28743",
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
    tecnica: { bg: "#FEF3E2", cor: "#C47535" },
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

const BarraProgresso = ({ valor, cor = "#E28743", altura = 6 }) => (
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

const IntensidadeBar = ({ nome, valor, cor = "#E28743" }) => (
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

const TelaPacientes = ({ pacientes: pacientesProps, onSelect, onNovoPaciente, pacienteSelecionado, menuAberto, onClose, terapeutaId, modo = "pacientes", onAbrirAgendamento, onRestaurar, humorAlerta = new Map(), abrirModal = false, onAbrirModalConsumed, onIrParaImportar }) => {
  const [busca, setBusca] = useState("");
  const [novosPacientes, setNovosPacientes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalArquivadosAberto, setModalArquivadosAberto] = useState(false);
  const [arquivados, setArquivados] = useState([]);
  const [carregandoArquivados, setCarregandoArquivados] = useState(false);
  const [erroRestaurar, setErroRestaurar] = useState("");
  const [passoCriar, setPassoCriar] = useState(null);
  const [pacienteCriadoTemp, setPacienteCriadoTemp] = useState(null);
  const [formNome, setFormNome] = useState("");
  const [formIdade, setFormIdade] = useState("");
  const [formQueixa, setFormQueixa] = useState("");
  const [formLinha, setFormLinha] = useState("tcc");
  const [formRisco, setFormRisco] = useState("baixo");
  const [formHistorico, setFormHistorico] = useState("primeira");
  const [secoesAbertas, setSecoesAbertas] = useState({ hoje: true, semana: false, semAgendamento: false });
  const [hoverPaciente, setHoverPaciente] = useState(null);
  const [hoverY, setHoverY] = useState(0);
  const [erroCriar, setErroCriar] = useState("");
  const [criando, setCriando] = useState(false);
  const hoverTimer = useRef(null);

  useEffect(() => {
    if (abrirModal) { setModalAberto(true); onAbrirModalConsumed?.(); }
  }, [abrirModal]);

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

  const base = pacientesProps ?? [];
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
        <div style={{ flex:1, minWidth:0, overflow:"hidden", display:"flex", flexDirection:"column", gap:1 }}>
          <div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            fontSize:13, fontWeight:600, color:"#2C302E" }}>
            {p.nome}
          </div>
          {(() => {
            const dias = humorAlerta.get(p.id);
            if (dias === undefined || dias < 3) return null;
            const label = dias >= 999 ? "sem registros" : `${dias} dias sem humor`;
            return (
              <span style={{ fontSize:10, fontWeight:600, color:"#f59e0b",
                background:"#fffbeb", border:"1px solid #fde68a",
                borderRadius:4, padding:"0px 5px", lineHeight:"14px",
                display:"inline-block", width:"fit-content" }}>
                ⚠️ {label}
              </span>
            );
          })()}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          {numAlertas > 0 && (
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#ef4444", flexShrink:0 }}/>
          )}
          <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, fontWeight:700, color:riscoCor }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:riscoCor, display:"inline-block" }}/>
            {riscoLetra}
          </span>
          {modo === "agenda" ? (
            <span style={{ fontSize:11, color:"#94a3b8", minWidth:60, textAlign:"right" }}>
              {p.proximaSessao.includes("Hoje") ? (
                <span style={{ color:"#dc2626", fontWeight:600 }}>
                  {p.proximaSessao.replace("Hoje, ","")}
                </span>
              ) : p.proximaSessao.includes("Não") ? "" : p.proximaSessao.split(", ")[1] || p.proximaSessao}
            </span>
          ) : (
            <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>
              {p.sessoes > 0 ? `${p.sessoes}s` : ""}
            </span>
          )}
        </div>
      </div>
    );
  };

  const criarPaciente = async () => {
    if (!formNome.trim()) return;
    setErroCriar("");
    setCriando(true);
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
      const { data, error } = await criarPacienteService(terapeutaId, camposDB);
      if (error) {
        setErroCriar(error.message || "Erro ao salvar paciente. Verifique a conexão e tente novamente.");
        setCriando(false);
        return;
      }
      if (data?.id) pacienteId = data.id;
    }
    setCriando(false);
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
    setFormNome(""); setFormIdade(""); setFormQueixa("");
    setFormLinha("tcc"); setFormRisco("baixo"); setFormHistorico("primeira");
    if (formHistorico === "historico") {
      setPacienteCriadoTemp(novo);
      setPassoCriar("importar");
    } else if (onAbrirAgendamento) {
      setPacienteCriadoTemp(novo);
      setPassoCriar("sucesso");
    } else {
      setModalAberto(false);
      onSelect(novo);
    }
  };

  return (
    <div style={{ height: menuAberto ? "auto" : "100%", display:"flex", flexDirection:"column" }}>

      {/* Campo de busca — visível apenas em modo pacientes expandido */}
      {menuAberto && modo === "pacientes" && (
        <div style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9" }}>
          {onClose && (
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:6 }}>
              <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:8,
                padding:"4px 10px", cursor:"pointer", fontSize:16, color:"#64748b" }}>✕</button>
            </div>
          )}
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar paciente ou queixa…"
            style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
              borderRadius:10, fontSize:13, color:"#2C302E", background:"#f8fafc",
              outline:"none", boxSizing:"border-box" }}
          />
        </div>
      )}

      {/* Alertas rápidos — visíveis apenas em modo pacientes */}
      {menuAberto && modo === "pacientes" && todos.filter(p => p.risco === "alto").map(p => (
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

      {/* Lista de pacientes */}
      <div style={{ flex:1, overflowY:"auto", padding: menuAberto ? "8px 0" : "8px 4px" }}>
        {modo === "pacientes" ? (
          /* Modo pacientes: lista plana ordenada por nome, sem agrupamento por data */
          [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(p => renderLinha(p))
        ) : (
          /* Modo agenda: agrupado por data da próxima sessão */
          [
            { key:"hoje",           label:"Hoje",            lista: grupos.hoje },
            { key:"semana",         label:"Esta semana",     lista: grupos.semana },
            { key:"semAgendamento", label:"Sem agendamento", lista: grupos.semAgendamento },
          ].filter(g => g.lista.length > 0).map(({ key, label, lista }) => {
            const aberta = secoesAbertas[key];
            return (
              <div key={key}>
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
                {aberta && lista.map(p => renderLinha(p))}
              </div>
            );
          })
        )}
      </div>

      {/* Footer — visível apenas em modo pacientes */}
      {modo === "pacientes" && (
        <div style={{ borderTop:"1px solid #f1f5f9", flexShrink:0 }}>
          {/* Botão novo paciente */}
          {menuAberto ? (
            <div style={{ padding:"12px 16px 0" }}>
              <button onClick={() => setModalAberto(true)}
                style={{ width:"100%", padding:"9px 0", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:"pointer", letterSpacing:"0.02em" }}>
                + Novo paciente
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"center", padding:"10px 0" }}>
              <button onClick={() => setModalAberto(true)} title="Novo paciente"
                style={{ width:36, height:36, background:"#E28743", color:"#fff",
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
                  <div style={{ fontSize:18, fontWeight:800, color:"#2C302E" }}>{val}</div>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase",
                    letterSpacing:"0.06em" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Botão arquivados — apenas modo expandido */}
          {menuAberto && (
            <div style={{ padding:"0 16px 14px" }}>
              <button
                onClick={async () => {
                  setModalArquivadosAberto(true);
                  setErroRestaurar("");
                  setCarregandoArquivados(true);
                  const { data } = await listarPacientesArquivados(terapeutaId);
                  setArquivados(data ?? []);
                  setCarregandoArquivados(false);
                }}
                style={{ width:"100%", padding:"7px 0", background:"transparent",
                  border:"1px solid #e2e8f0", borderRadius:8, fontSize:12,
                  fontWeight:600, color:"#94a3b8", cursor:"pointer" }}>
                Pacientes arquivados
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de pacientes arquivados */}
      {modalArquivadosAberto && (
        <div style={{ position:"fixed", inset:0, zIndex:300,
          background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setModalArquivadosAberto(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:420, maxWidth:"90vw",
            maxHeight:"70vh", display:"flex", flexDirection:"column",
            boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#2C302E" }}>
                Pacientes arquivados
              </div>
              <button onClick={() => setModalArquivadosAberto(false)}
                style={{ background:"none", border:"none", fontSize:18, color:"#94a3b8",
                  cursor:"pointer", lineHeight:1 }}>✕</button>
            </div>
            <div style={{ padding:"14px 20px", overflowY:"auto", flex:1 }}>
              {erroRestaurar && (
                <div style={{ fontSize:12, color:"#dc2626", background:"#fff1f2",
                  border:"1px solid #fecdd3", borderRadius:8, padding:"8px 12px", marginBottom:12 }}>
                  {erroRestaurar}
                </div>
              )}
              {carregandoArquivados ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:"20px 0" }}>
                  Carregando…
                </div>
              ) : arquivados.length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:"20px 0" }}>
                  Nenhum paciente arquivado nos últimos 30 dias.
                </div>
              ) : arquivados.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", gap:12, padding:"10px 0",
                  borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C302E",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {p.nome}
                    </div>
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
                      Arquivado em {new Date(p.deleted_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setErroRestaurar("");
                      const result = await onRestaurar?.(p.id);
                      if (result?.ok === false) {
                        setErroRestaurar(result.message || "Erro ao restaurar paciente");
                        return;
                      }
                      setArquivados(prev => prev.filter(a => a.id !== p.id));
                    }}
                    style={{ padding:"5px 14px", background:"#f0fdf4",
                      border:"1px solid #bbf7d0", borderRadius:8, fontSize:12,
                      fontWeight:700, color:"#16a34a", cursor:"pointer", flexShrink:0 }}>
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div style={{ fontSize:14, fontWeight:700, color:"#2C302E",
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

      {/* Modal novo paciente — Passo 2a: ir para importar histórico */}
      {modo === "pacientes" && modalAberto && passoCriar === "importar" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px 28px",
            width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#2C302E", marginBottom:8 }}>
              Paciente criado com sucesso!
            </div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:28 }}>
              Use a aba <strong>Importar</strong> para registrar o histórico anterior de{" "}
              <strong style={{ color:"#2C302E" }}>{pacienteCriadoTemp?.nome}</strong>.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button
                onClick={() => { setModalAberto(false); setPassoCriar(null); onSelect(pacienteCriadoTemp); setPacienteCriadoTemp(null); }}
                style={{ padding:"9px 20px", background:"#f1f5f9", color:"#475569",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Fazer isso depois
              </button>
              <button
                onClick={() => { const p = pacienteCriadoTemp; setModalAberto(false); setPassoCriar(null); setPacienteCriadoTemp(null); onIrParaImportar?.(p); }}
                style={{ padding:"9px 20px", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                📥 Ir para Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo paciente — Passo 2b: confirmar agendamento */}
      {modo === "pacientes" && modalAberto && passoCriar === "sucesso" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px 28px",
            width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#2C302E", marginBottom:8 }}>
              Paciente criado com sucesso!
            </div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:28 }}>
              Deseja agendar a primeira sessão de{" "}
              <strong style={{ color:"#2C302E" }}>{pacienteCriadoTemp?.nome}</strong> agora?
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button
                onClick={() => {
                  setModalAberto(false);
                  setPassoCriar(null);
                  onSelect(pacienteCriadoTemp);
                  setPacienteCriadoTemp(null);
                }}
                style={{ padding:"9px 20px", background:"#f1f5f9", color:"#475569",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Fazer isso depois
              </button>
              <button
                onClick={() => {
                  const p = pacienteCriadoTemp;
                  setModalAberto(false);
                  setPassoCriar(null);
                  setPacienteCriadoTemp(null);
                  onSelect(p);
                  onAbrirAgendamento(p);
                }}
                style={{ padding:"9px 20px", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                📅 Agendar primeira sessão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo paciente — Passo 1: formulário */}
      {modo === "pacientes" && modalAberto && !passoCriar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => e.target === e.currentTarget && setModalAberto(false)}>
          <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px 24px",
            width:440, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#2C302E", marginBottom:20 }}>
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
                    borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                    boxSizing:"border-box" }} />
              </div>
            ))}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:5 }}>Linha terapêutica</div>
                <select value={formLinha} onChange={e => setFormLinha(e.target.value)}
                  style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                    borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
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
                    borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                    background:"#fff", boxSizing:"border-box" }}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                letterSpacing:"0.06em", marginBottom:10 }}>Histórico de sessões</div>
              {[
                { val:"primeira", label:"Primeira sessão", desc:"Começar do zero" },
                { val:"historico", label:"Já possui histórico", desc:"Importar sessões após cadastro" },
              ].map(({ val, label, desc }) => (
                <label key={val} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, cursor:"pointer" }}>
                  <input type="radio" name="formHistorico" value={val}
                    checked={formHistorico === val} onChange={() => setFormHistorico(val)}
                    style={{ accentColor:"#E28743", width:15, height:15, cursor:"pointer", flexShrink:0 }} />
                  <div>
                    <span style={{ fontSize:13, fontWeight:600, color:"#2C302E" }}>{label}</span>
                    <span style={{ fontSize:12, color:"#94a3b8", marginLeft:6 }}>— {desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {erroCriar && (
              <div style={{ marginBottom:14, padding:"9px 12px", background:"#fff1f2",
                border:"1px solid #fecdd3", borderRadius:8, fontSize:12, color:"#dc2626" }}>
                {erroCriar}
              </div>
            )}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => { setModalAberto(false); setErroCriar(""); }}
                style={{ padding:"9px 20px", background:"#f1f5f9", color:"#475569",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={criarPaciente} disabled={criando}
                style={{ padding:"9px 24px", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                  opacity: criando ? 0.7 : 1 }}>
                {criando ? "Criando…" : "Criar paciente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TELA: HISTÓRICO DO PACIENTE ───────────────────────────────────────────────
const TelaHistorico = ({ paciente, isMobile = false, onAgendar, proximaSessao }) => {
  const [sessaoAtiva, setSessaoAtiva] = useState(paciente.sessoesList[0] ?? null);
  const [subAba, setSubAba] = useState("historico"); // "historico" | "plano"
  const [planoSessao, setPlanoSessao] = useState(null);
  const [carregandoPlano, setCarregandoPlano] = useState(false);
  const [registrosApp, setRegistrosApp] = useState([]);
  const [humorApp, setHumorApp] = useState([]);
  const [mostrarRegistros, setMostrarRegistros] = useState(true);
  const [viewPrincipal, setViewPrincipal] = useState("sessoes"); // "sessoes" | "registros_app"
  const [registroExpandido, setRegistroExpandido] = useState(null);
  const [sidebarColapsada, setSidebarColapsada] = useState(false);

  useEffect(() => {
    setSessaoAtiva(paciente.sessoesList[0] ?? null);
    setSubAba("historico");
    setPlanoSessao(null);
    setRegistrosApp([]);
    setHumorApp([]);
    setMostrarRegistros(true);
    setViewPrincipal("sessoes");
    setRegistroExpandido(null);
    setSidebarColapsada(false);
  }, [paciente.id]);

  // Atualiza sessaoAtiva quando sessões chegam depois da montagem
  useEffect(() => {
    if (!sessaoAtiva && paciente.sessoesList.length > 0) {
      setSessaoAtiva(paciente.sessoesList[0]);
    }
  }, [paciente.sessoesList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao trocar de sessão, reseta sub-aba e plano carregado
  const selecionarSessao = (s) => {
    setSessaoAtiva(s);
    setSubAba("historico");
    setPlanoSessao(null);
  };

  // Carrega plano ao trocar para a sub-aba "plano"
  useEffect(() => {
    if (subAba !== "plano" || !sessaoAtiva || typeof paciente.id !== "string") return;
    setCarregandoPlano(true);
    buscarPlanoDaSessao(paciente.id, sessaoAtiva.id, sessaoAtiva.numero).then(({ data }) => {
      setPlanoSessao(data);
      setCarregandoPlano(false);
    });
  }, [subAba, sessaoAtiva?.numero, paciente.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sessão a exibir: usa sessaoAtiva ou fallback para a primeira disponível
  const sessaoMostrar = sessaoAtiva ?? paciente.sessoesList[0] ?? null;

  // Carrega registros do app de forma antecipada — auto-expande se houver dados
  useEffect(() => {
    if (typeof paciente.id !== "string") return;
    listarRegistrosDoPaciente(paciente.id).then(({ data }) => {
      const lista = data ?? [];
      setRegistrosApp(lista);
      if (lista.length > 0) setMostrarRegistros(true);
    });
    listarHumorPaciente(paciente.id, 30).then(({ data }) => {
      const lista = data ?? [];
      setHumorApp(lista);
      if (lista.length > 0) setMostrarRegistros(true);
    });
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
            <div style={{ fontSize:20, fontWeight:800, color:"#2C302E" }}>{paciente.nome}</div>
            <div style={{ fontSize:13, color:"#64748b" }}>{paciente.queixa}</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <RiscoTag nivel={paciente.risco} />
            {onAgendar && (
              <button onClick={() => onAgendar()}
                style={{ padding:"5px 12px", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap" }}>
                📅 Agendar
              </button>
            )}
          </div>
        </div>

        {/* Stats rápidos */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: isMobile ? 8 : 12 }}>
          {[
            { label:"Sessões", val: paciente.sessoes, sub:"realizadas" },
            { label:"Adesão", val: `${paciente.adesao}%`, sub:"tarefas de casa" },
            { label:"Tarefas", val: `${paciente.cumprimentoTarefas}%`, sub:"cumprimento" },
            { label:"Próxima", val: proximaSessao || "Não agendado", sub:"sessão", destaque: proximaSessao?.includes("Hoje") },
            { label:"Abordagem", val: BANCO_PALAVRAS[paciente.linha || "tcc"].label, sub:"linha terapêutica" },
          ].map(({ label, val, sub, destaque }) => (
            <div key={label} style={{ background: destaque ? "#fff1f2" : "#fff", borderRadius:10, padding:"10px 12px",
              border: destaque ? "1px solid #fecdd3" : "1px solid #f1f5f9" }}>
              <div style={{ fontSize:destaque ? 12 : 16, fontWeight:800, color: destaque ? "#dc2626" : "#2C302E",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val}</div>
              <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.05em" }}>{label}</div>
              <div style={{ fontSize:10, color:"#cbd5e1" }}>{sub}</div>
            </div>
          ))}
        </div>

      </div>

      {/* Toggle principal: Sessões / Registros do app */}
      <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", background:"#fff",
        padding:"0 24px", flexShrink:0 }}>
        {[
          { id:"sessoes",       label:"📋 Sessões" },
          { id:"registros_app", label:"📱 Registros do app" },
        ].map(t => (
          <button key={t.id} onClick={() => setViewPrincipal(t.id)}
            style={{ padding:"10px 16px", border:"none", background:"none", cursor:"pointer",
              fontSize:13, fontWeight:700, transition:"all 0.15s", marginRight:4,
              borderBottom: `2px solid ${viewPrincipal === t.id ? "#E28743" : "transparent"}`,
              color: viewPrincipal === t.id ? "#E28743" : "#94a3b8" }}>
            {t.label}
            {t.id === "registros_app" && (registrosApp.length > 0 || humorApp.length > 0) && (
              <span style={{ marginLeft:6, fontSize:10, fontWeight:700,
                background:"#FEF3E2", color:"#C47535",
                padding:"1px 6px", borderRadius:10 }}>
                {registrosApp.length + humorApp.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: viewPrincipal === "sessoes" ? "flex" : "none", flex:1, minHeight:0, flexDirection: isMobile ? "column" : "row" }}>
        {/* Mobile: dropdown seletor de sessão */}
        {isMobile && paciente.sessoesList.length > 0 && (
          <div style={{ padding:"10px 16px", borderBottom:"1px solid #f1f5f9", background:"#fff", flexShrink:0 }}>
            <select
              value={sessaoAtiva?.numero ?? ""}
              onChange={e => selecionarSessao(paciente.sessoesList.find(s => s.numero === parseInt(e.target.value)))}
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
          <div style={{ width: sidebarColapsada ? 44 : 200, borderRight:"1px solid #f1f5f9",
            flexShrink:0, display:"flex", flexDirection:"column",
            transition:"width 0.2s ease", overflow:"hidden" }}>
            {/* Header com botão sanduíche */}
            <div style={{ display:"flex", alignItems:"center", justifyContent: sidebarColapsada ? "center" : "space-between",
              padding: sidebarColapsada ? "10px 0" : "10px 12px 8px 16px", flexShrink:0 }}>
              {!sidebarColapsada && (
                <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                  letterSpacing:"0.08em" }}>Sessões</div>
              )}
              <button onClick={() => setSidebarColapsada(v => !v)}
                title={sidebarColapsada ? "Expandir painel" : "Recolher painel"}
                style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px",
                  borderRadius:6, color:"#94a3b8", fontSize:15, lineHeight:1,
                  flexShrink:0, transition:"color 0.15s" }}>
                ☰
              </button>
            </div>

            {/* Lista de sessões (oculta quando colapsada) */}
            {!sidebarColapsada && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {paciente.sessoesList.length === 0 && (
                  <div style={{ padding:"16px", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>📋</div>
                    <div style={{ fontSize:11, lineHeight:1.5 }}>
                      Nenhuma sessão.<br/>Use "Importar" para registrar.
                    </div>
                  </div>
                )}
                {paciente.sessoesList.map(s => {
                  const ativa = sessaoAtiva?.numero === s.numero;
                  const temAlerta = s.alertas?.length > 0;
                  return (
                    <div key={s.numero} onClick={() => selecionarSessao(s)}
                      style={{ padding:"10px 16px", cursor:"pointer",
                        background: ativa ? `${paciente.cor}10` : "transparent",
                        borderLeft: ativa ? `3px solid ${paciente.cor}` : "3px solid transparent",
                        transition:"all 0.1s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#2C302E" }}>
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

            {/* Quando colapsada: mini-lista com número da sessão ativa */}
            {sidebarColapsada && sessaoMostrar && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {paciente.sessoesList.map(s => {
                  const ativa = sessaoAtiva?.numero === s.numero;
                  return (
                    <div key={s.numero} onClick={() => selecionarSessao(s)}
                      title={`Sessão ${s.numero} — ${s.data}`}
                      style={{ padding:"6px 0", textAlign:"center", cursor:"pointer",
                        borderLeft: ativa ? `3px solid ${paciente.cor}` : "3px solid transparent",
                        background: ativa ? `${paciente.cor}10` : "transparent" }}>
                      <span style={{ fontSize:11, fontWeight:700,
                        color: ativa ? paciente.cor : "#94a3b8" }}>
                        {s.numero}
                      </span>
                      {s.alertas?.length > 0 && (
                        <div style={{ fontSize:8 }}>🔴</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Detalhe da sessão */}
        <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px" : "20px 24px" }}>
          {!sessaoMostrar && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
              gap:12, color:"#94a3b8", textAlign:"center", padding:"32px 32px 24px" }}>
              <div style={{ fontSize:32 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#64748b" }}>Nenhuma sessão registrada</div>
              <div style={{ fontSize:13 }}>Use a aba "Importar" para registrar a primeira sessão deste paciente.</div>
            </div>
          )}

          {/* Sub-tabs: Histórico da sessão / Plano da sessão */}
          {sessaoMostrar && (
            <div style={{ display:"flex", gap:4, marginBottom:20, background:"#f1f5f9",
              borderRadius:10, padding:4 }}>
              {[
                { id:"historico", label:"📋 Histórico da sessão" },
                { id:"plano",     label:"🎯 Plano da sessão" },
              ].map(t => (
                <button key={t.id} onClick={() => setSubAba(t.id)}
                  style={{ flex:1, padding:"7px 12px", border:"none", borderRadius:7, cursor:"pointer",
                    fontSize:12, fontWeight:700, transition:"all 0.15s",
                    background: subAba === t.id ? "#fff" : "transparent",
                    color: subAba === t.id ? "#2C302E" : "#94a3b8",
                    boxShadow: subAba === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* ── VIEW: PLANO DA SESSÃO ── */}
          {sessaoMostrar && subAba === "plano" && (
            <div>
              {carregandoPlano ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#94a3b8", fontSize:13 }}>
                  Carregando plano…
                </div>
              ) : !planoSessao ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#94a3b8" }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>🎯</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#64748b", marginBottom:6 }}>
                    Nenhum plano encontrado para a Sessão {sessaoMostrar.numero}
                  </div>
                  <div style={{ fontSize:12 }}>
                    O plano é gerado na aba "Próx. sessão" após importar a sessão anterior.
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Cabeçalho do plano */}
                  <div style={{ background:"#FEF3E2", border:"1px solid #F0D4B0",
                    borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center",
                    justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:"#C47535",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>
                        Plano gerado para a Sessão {sessaoMostrar.numero}
                      </div>
                      <div style={{ fontSize:12, color:"#8A4020" }}>
                        {planoSessao.editado ? "Editado pelo terapeuta" : `Gerado por ${planoSessao.gerado_por ?? "IA"}`}
                        {planoSessao.status === "confirmado" && " · ✓ Confirmado"}
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:"#94a3b8" }}>
                      {new Date(planoSessao.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  {/* Objetivo */}
                  {planoSessao.objetivo && (
                    <div style={{ background:"#fff", border:"1px solid #f1f5f9",
                      borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                        Objetivo da sessão
                      </div>
                      <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>
                        {planoSessao.objetivo}
                      </div>
                    </div>
                  )}

                  {/* Técnicas */}
                  {planoSessao.tecnicas?.length > 0 && (
                    <div style={{ background:"#fff", border:"1px solid #f1f5f9",
                      borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                        Técnicas sugeridas
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {planoSessao.tecnicas.map(t => (
                          <Badge key={t} tipo="tecnica">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Perguntas */}
                  {planoSessao.perguntas?.length > 0 && (
                    <div style={{ background:"#fff", border:"1px solid #f1f5f9",
                      borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                        {LABELS_POR_LINHA[paciente.linha || "tcc"].perguntas}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {planoSessao.perguntas.map((p, i) => (
                          <div key={i} style={{ fontSize:13, color:"#334155", padding:"8px 12px",
                            background:"#f8fafc", borderRadius:8,
                            borderLeft:"3px solid #E28743" }}>
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Distorções foco */}
                  {planoSessao.distorcoes_foco?.length > 0 && (
                    <div style={{ background:"#fff", border:"1px solid #f1f5f9",
                      borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                        {LABELS_POR_LINHA[paciente.linha || "tcc"].material}
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {planoSessao.distorcoes_foco.map(d => (
                          <Badge key={d} tipo="distorcao">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tarefa planejada */}
                  {planoSessao.tarefa && (
                    <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0",
                      borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#166534",
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
                        Tarefa planejada
                      </div>
                      <div style={{ fontSize:13, color:"#166534", lineHeight:1.6 }}>
                        {planoSessao.tarefa}
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  {planoSessao.observacoes && (
                    <div style={{ padding:"10px 14px", background:"#f0f9ff",
                      borderRadius:10, fontSize:12, color:"#0c4a6e",
                      borderLeft:"3px solid #0ea5e9" }}>
                      💡 {planoSessao.observacoes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── VIEW: HISTÓRICO DA SESSÃO ── */}
          {sessaoMostrar && subAba !== "plano" && (
          <div>

          {/* Status da tarefa de casa */}
          {sessaoMostrar.tarefa && (() => {
            const resultado = sessaoMostrar.resultadoTarefa ?? "";
            const concluiu    = resultado.toLowerCase().includes("completamente");
            const parcial     = resultado.toLowerCase().includes("parcialmente");
            const naoConcluiu = resultado.toLowerCase().includes("não realizou") || resultado.toLowerCase().includes("nao realizou");
            const semInfo     = !resultado;
            const cor    = concluiu ? "#15803d" : parcial ? "#92400e" : naoConcluiu ? "#991b1b" : "#64748b";
            const bg     = concluiu ? "#f0fdf4" : parcial ? "#fefce8" : naoConcluiu ? "#fff1f2" : "#f8fafc";
            const borda  = concluiu ? "#bbf7d0" : parcial ? "#fde68a" : naoConcluiu ? "#fecdd3" : "#e2e8f0";
            const icone  = concluiu ? "✓" : parcial ? "~" : naoConcluiu ? "✗" : "—";
            const label  = concluiu ? "Realizou" : parcial ? "Realizou parcialmente" : naoConcluiu ? "Não realizou" : "Sem retorno";
            return (
              <div style={{ background:bg, border:`1px solid ${borda}`, borderRadius:12,
                padding:"12px 16px", marginBottom:20,
                display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:borda,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0, fontSize:16, fontWeight:800, color:cor }}>
                  {icone}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                      textTransform:"uppercase", letterSpacing:"0.07em" }}>
                      Tarefa de casa
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, color:cor,
                      background:"#fff", border:`1px solid ${borda}`,
                      padding:"1px 8px", borderRadius:20 }}>
                      {label}
                    </span>
                    {semInfo && (
                      <span style={{ fontSize:11, color:"#94a3b8" }}>
                        a confirmar na próxima sessão
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:cor, lineHeight:1.5 }}>
                    {sessaoMostrar.tarefa}
                  </div>
                </div>
              </div>
            );
          })()}

          {sessaoMostrar && subAba !== "plano" && sessaoMostrar.alertas.length > 0 && (
            <div style={{ background:"#fff1f2", border:"1px solid #fecdd3",
              borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#9f1239", marginBottom:6 }}>
                ⚠️ Alertas clínicos
              </div>
              {sessaoMostrar.alertas.map((a,i) => (
                <div key={i} style={{ fontSize:12, color:"#be123c" }}>• {a}</div>
              ))}
            </div>
          )}

          {sessaoMostrar && subAba !== "plano" && (
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16 }}>
            {/* Emoções */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Emoções</div>
              {sessaoMostrar.emocoes.map(e => {
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
                {sessaoMostrar.distorcoes.map(d => (
                  <Badge key={d} tipo="distorcao">{d}</Badge>
                ))}
              </div>
            </div>

            {/* Pensamentos */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9", gridColumn: isMobile ? "1" : "1/-1" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:12 }}>Pensamentos automáticos</div>
              {sessaoMostrar.pensamentos.map((p,i) => (
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
                {sessaoMostrar.tecnicas.map(t => (
                  <Badge key={t} tipo="tecnica">{t}</Badge>
                ))}
              </div>
            </div>

            {/* Tarefa */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>Tarefa de casa</div>
              <div style={{ fontSize:12, color:"#334155", marginBottom:8 }}>{sessaoMostrar.tarefa}</div>
              <div style={{ fontSize:11, fontWeight:600,
                color: sessaoMostrar.resultadoTarefa?.includes("completamente") ? "#065f46" :
                       sessaoMostrar.resultadoTarefa?.includes("Não realizou") ? "#991b1b" : "#92400e",
                background: sessaoMostrar.resultadoTarefa?.includes("completamente") ? "#d1fae5" :
                            sessaoMostrar.resultadoTarefa?.includes("Não realizou") ? "#fee2e2" : "#fef3c7",
                padding:"6px 10px", borderRadius:6 }}>
                {sessaoMostrar.resultadoTarefa}
              </div>
            </div>

            {/* Evolução */}
            <div style={{ background:"#fff", borderRadius:12, padding:"16px",
              border:"1px solid #f1f5f9", gridColumn: isMobile ? "1" : "1/-1" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:8 }}>Evolução clínica</div>
              <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>{sessaoMostrar.evolucao}</div>
              {sessaoMostrar.obs && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"#f0f9ff",
                  borderRadius:8, fontSize:12, color:"#0c4a6e", borderLeft:"3px solid #0ea5e9" }}>
                  💡 {sessaoMostrar.obs}
                </div>
              )}
            </div>
          </div>
          )}
          </div>
          )}

        </div>
      </div>

      {/* ── VIEW: REGISTROS DO APP ── */}
      {viewPrincipal === "registros_app" && (() => {
        const totalHumor = humorApp.length;
        const mediaHumor = totalHumor > 0
          ? (humorApp.reduce((a, h) => a + h.valor, 0) / totalHumor).toFixed(1)
          : null;
        const registrosComInt = registrosApp.filter(r => r.intensidade_antes != null && r.intensidade_depois != null);
        const mediaReducao = registrosComInt.length > 0
          ? Math.round(registrosComInt.reduce((a, r) => a + (r.intensidade_antes - r.intensidade_depois), 0) / registrosComInt.length)
          : null;
        const corHumor = mediaHumor >= 7 ? "#10b981" : mediaHumor >= 5 ? "#f59e0b" : "#ef4444";

        return (
          <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "16px" : "20px 28px" }}>

            {/* Cards de resumo */}
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
              gap:12, marginBottom:24 }}>
              {[
                { label:"Humor registrado", val: totalHumor > 0 ? `${totalHumor} dias` : "—", sub:"últimos 30 dias", cor:"#E28743" },
                { label:"Média de humor",   val: mediaHumor ? `${mediaHumor}/10` : "—",    sub:"escala de 1 a 10", cor: mediaHumor ? corHumor : "#94a3b8" },
                { label:"Registros ABCD",   val: registrosApp.length > 0 ? registrosApp.length : "—", sub:"formulários enviados", cor:"#6366f1" },
                { label:"Redução média",    val: mediaReducao != null ? `↓${mediaReducao}pts` : "—", sub:"intensidade emocional", cor: mediaReducao > 0 ? "#10b981" : "#94a3b8" },
              ].map(c => (
                <div key={c.label} style={{ background:"#fff", border:"1px solid #f1f5f9",
                  borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:c.cor }}>{c.val}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8",
                    textTransform:"uppercase", letterSpacing:"0.05em" }}>{c.label}</div>
                  <div style={{ fontSize:10, color:"#cbd5e1" }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Gráfico de humor */}
            {humorApp.length > 0 && (
              <div style={{ background:"#fff", border:"1px solid #f1f5f9",
                borderRadius:12, padding:"16px 18px", marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>
                  Humor diário — últimos 30 dias
                </div>
                <div style={{ overflowX:"auto", paddingBottom:4 }}>
                  <div style={{ display:"flex", gap:5, alignItems:"flex-end",
                    minWidth: humorApp.length * 36 }}>
                    {humorApp.map(h => {
                      const cor = h.valor >= 7 ? "#10b981" : h.valor >= 5 ? "#f59e0b" : "#ef4444";
                      const dt = new Date(h.data + "T12:00:00");
                      const diaSemana = dt.toLocaleDateString("pt-BR", { weekday:"short" });
                      const diaMes = dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
                      return (
                        <div key={h.data} style={{ display:"flex", flexDirection:"column",
                          alignItems:"center", gap:4, flex:"0 0 32px" }}>
                          <div style={{ fontSize:9, fontWeight:700, color:"#64748b" }}>{h.valor}</div>
                          <div title={`${diaMes}: ${h.valor}/10`}
                            style={{ width:24, background:cor, borderRadius:4,
                              height: Math.max(8, h.valor * 8), transition:"height 0.2s" }} />
                          <div style={{ fontSize:8, color:"#94a3b8", textAlign:"center",
                            lineHeight:1.2 }}>
                            <div>{diaSemana.replace(".", "")}</div>
                            <div>{diaMes}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, marginTop:12, flexWrap:"wrap" }}>
                  {[["#10b981","≥ 7 — Bom"], ["#f59e0b","5–6 — Neutro"], ["#ef4444","≤ 4 — Difícil"]].map(([cor, txt]) => (
                    <div key={txt} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:cor }} />
                      <span style={{ fontSize:11, color:"#64748b" }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de registros ABCD */}
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
                Registros ABCD — {registrosApp.length} {registrosApp.length === 1 ? "registro" : "registros"}
              </div>

              {registrosApp.length === 0 && (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#94a3b8" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✏️</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#64748b" }}>
                    Nenhum registro enviado ainda
                  </div>
                  <div style={{ fontSize:12, marginTop:4 }}>
                    O paciente pode enviar pela aba "Registrar" no app.
                  </div>
                </div>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {registrosApp.map(r => {
                  const expandido = registroExpandido === r.id;
                  const reducao = r.intensidade_antes != null && r.intensidade_depois != null
                    ? r.intensidade_antes - r.intensidade_depois : null;
                  const corReducao = reducao > 0 ? "#15803d" : reducao < 0 ? "#dc2626" : "#94a3b8";
                  return (
                    <div key={r.id} style={{ background:"#fff", border:"1px solid #f1f5f9",
                      borderRadius:12, overflow:"hidden" }}>
                      {/* Cabeçalho clicável */}
                      <button onClick={() => setRegistroExpandido(expandido ? null : r.id)}
                        style={{ width:"100%", display:"flex", alignItems:"flex-start",
                          justifyContent:"space-between", padding:"12px 16px",
                          background:"none", border:"none", cursor:"pointer", textAlign:"left",
                          gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4,
                            flexWrap:"wrap" }}>
                            {r.emocao && (
                              <span style={{ fontSize:11, fontWeight:700, color:"#7c3aed",
                                background:"#f3e8ff", padding:"2px 8px", borderRadius:10 }}>
                                {r.emocao}
                              </span>
                            )}
                            {r.intensidade_antes != null && (
                              <span style={{ fontSize:11, color:"#64748b" }}>
                                {r.intensidade_antes}%
                                {r.intensidade_depois != null && (
                                  <span style={{ color:corReducao, fontWeight:700 }}>
                                    {" → "}{r.intensidade_depois}%
                                    {reducao > 0 ? ` (↓${reducao}pts)` : reducao < 0 ? ` (↑${Math.abs(reducao)}pts)` : ""}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:13, color:"#334155", lineHeight:1.4,
                            overflow:"hidden", textOverflow:"ellipsis",
                            whiteSpace: expandido ? "normal" : "nowrap" }}>
                            {r.situacao || "Registro sem situação"}
                          </div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end",
                          gap:4, flexShrink:0 }}>
                          <span style={{ fontSize:10, color:"#94a3b8" }}>
                            {new Date(r.criado_em).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit" })}
                          </span>
                          <span style={{ fontSize:12, color:"#94a3b8" }}>{expandido ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {/* Detalhe expandido */}
                      {expandido && (
                        <div style={{ padding:"0 16px 14px",
                          borderTop:"1px solid #f1f5f9" }}>
                          {r.situacao && (
                            <div style={{ marginTop:10 }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"#E28743",
                                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
                                A — Situação
                              </div>
                              <div style={{ fontSize:13, color:"#334155", lineHeight:1.5 }}>{r.situacao}</div>
                            </div>
                          )}
                          {r.emocao && (
                            <div style={{ marginTop:10 }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"#E28743",
                                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
                                B — Emoção
                              </div>
                              <div style={{ fontSize:13, color:"#334155" }}>
                                {r.emocao}
                                {r.intensidade_antes != null && ` — ${r.intensidade_antes}% de intensidade`}
                              </div>
                            </div>
                          )}
                          {r.pensamento && (
                            <div style={{ marginTop:10 }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"#E28743",
                                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
                                C — Pensamento automático
                              </div>
                              <div style={{ fontSize:13, color:"#334155", lineHeight:1.5,
                                background:"#f8fafc", borderRadius:8, padding:"8px 10px",
                                borderLeft:"3px solid #e2e8f0" }}>
                                "{r.pensamento}"
                              </div>
                            </div>
                          )}
                          {r.resposta_racional && (
                            <div style={{ marginTop:10 }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"#E28743",
                                textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
                                D — Resposta racional
                              </div>
                              <div style={{ fontSize:13, color:"#334155", lineHeight:1.5,
                                background:"#f0fdf4", borderRadius:8, padding:"8px 10px",
                                borderLeft:"3px solid #bbf7d0" }}>
                                "{r.resposta_racional}"
                              </div>
                            </div>
                          )}
                          {r.intensidade_depois != null && (
                            <div style={{ marginTop:10, display:"flex", gap:16, alignItems:"center" }}>
                              <div>
                                <div style={{ fontSize:10, color:"#94a3b8" }}>Antes</div>
                                <div style={{ fontSize:16, fontWeight:800, color:"#ef4444" }}>
                                  {r.intensidade_antes}%
                                </div>
                              </div>
                              <div style={{ fontSize:14, color:"#94a3b8" }}>→</div>
                              <div>
                                <div style={{ fontSize:10, color:"#94a3b8" }}>Depois</div>
                                <div style={{ fontSize:16, fontWeight:800, color:corReducao }}>
                                  {r.intensidade_depois}%
                                </div>
                              </div>
                              {reducao != null && (
                                <div style={{ fontSize:12, fontWeight:700, color:corReducao,
                                  background: reducao > 0 ? "#f0fdf4" : "#fff1f2",
                                  padding:"3px 10px", borderRadius:20 }}>
                                  {reducao > 0 ? `↓ ${reducao} pts` : `↑ ${Math.abs(reducao)} pts`}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {humorApp.length === 0 && registrosApp.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 0", color:"#94a3b8" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📱</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#64748b", marginBottom:6 }}>
                  Nenhum dado do app ainda
                </div>
                <div style={{ fontSize:13, lineHeight:1.6 }}>
                  O paciente ainda não enviou humor ou registros pelo app.
                </div>
              </div>
            )}

          </div>
        );
      })()}

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
  { label: "Investigação",                       cor: "#E28743", descricaoCategoria: "Examinar a validade do pensamento" },
  { label: "Exploração de perspectiva",          cor: "#0ea5e9", descricaoCategoria: "Ampliar o ponto de vista" },
  { label: "Construção de resposta alternativa", cor: "#10b981", descricaoCategoria: "Gerar perspectiva adaptativa" },
];

// ─── HELPER: normaliza plano retornado pela IA para o formato de display ────────
const normalizeAIPlano = (ai, paciente) => {
  // Novo formato: IA retorna fluxoSocratico + itensRevisar + focoPrincipal + obs
  if (ai.fluxoSocratico) {
    return {
      id: ai.id,
      objetivo: ai.objetivo,
      itensRevisar: ai.itensRevisar || ["Revisar atividades entre sessões"],
      focoPrincipal: ai.focoPrincipal || ai.objetivo,
      fluxoSocratico: ai.fluxoSocratico,
      tecnicas: ai.tecnicas || [],
      tarefa: ai.tarefa || "",
      obs: ai.obs || ai.observacoes || "",
      duracaoSugerida: ai.duracaoSugerida || "50 min",
      urgencia: ai.urgencia || (paciente.risco === "alto" ? "alto" : "normal"),
      contextoUtilizado: ai.contextoUtilizado || ai.sessoes_contexto || 1,
    };
  }
  // Formato legado: array flat de perguntas (DB antigo ou IA anterior)
  const pergs = ai.perguntas || [];
  const eixos = [
    { eixo: "Investigação", descricao: "Analisar e examinar o pensamento automático", perguntas: pergs.slice(0,2).map((t,i) => ({ id:i+1, texto:t })) },
    { eixo: "Exploração de perspectiva", descricao: "Ampliar o campo de visão", perguntas: pergs.slice(2,4).map((t,i) => ({ id:i+3, texto:t })) },
    { eixo: "Construção de resposta alternativa", descricao: "Gerar perspectiva adaptativa", perguntas: pergs.slice(4).map((t,i) => ({ id:i+5, texto:t })) },
  ].filter(e => e.perguntas.length > 0);
  const ult = paciente.sessoesList?.[0];
  return {
    id: ai.id,
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
    contextoUtilizado: ai.sessoes_contexto || 1,
  };
};

// ─── TELA: PLANO DA SESSÃO ──────────────────────────────────────────────────────
const TelaPlano = ({ paciente, isMobile = false, terapeutaId, onAgendar, proximaSessao, terapeutaPerfil }) => {
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
  const [enviandoTarefa, setEnviandoTarefa] = useState(false);
  const [tarefaEnviada, setTarefaEnviada] = useState(null); // null | { id, descricao }
  const [erroEnvioTarefa, setErroEnvioTarefa] = useState("");
  const [planoConfirmado, setPlanoConfirmado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

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
    setTarefaEnviada(null);
    setErroEnvioTarefa("");
    setPlanoConfirmado(false);
    setConfirmando(false);
  }, [paciente.id]);

  // carrega plano salvo do Supabase ao abrir (só para pacientes reais sem mock)
  useEffect(() => {
    const pid = paciente?.id;
    if (typeof pid !== "string" || planoMock) return;
    const proximoNumero = (paciente.sessoes || 0) + 1;
    buscarPlano(pid).then(({ data }) => {
      if (data && data.numero_proxima === proximoNumero) {
        setPlanoCurrent(normalizeAIPlano(data, paciente));
        if (data.status === 'confirmado') setPlanoConfirmado(true);
      }
    });
  }, [paciente.id]);

  // carrega tarefa pendente do Supabase para persistir estado entre abas
  // só considera tarefas criadas após a última sessão (evita mostrar tarefa de ciclos anteriores)
  useEffect(() => {
    const pid = paciente?.id;
    if (typeof pid !== "string") return;
    const ultimaSessao = paciente.sessoesList?.[0];
    const corteISO = ultimaSessao?.created_at ?? null;
    listarTarefas(pid).then(({ data }) => {
      if (!data || data.length === 0) return;
      const ativa = data.find(t =>
        t.status !== 'concluida' &&
        (!corteISO || new Date(t.created_at) > new Date(corteISO))
      );
      if (ativa) setTarefaEnviada({ id: ativa.id, descricao: ativa.descricao });
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
    if (!(paciente.sessoesList?.length > 0)) return;
    const janela = terapeutaPerfil?.janela_contexto || 3;
    const sessoesContexto = (paciente.sessoesList || []).slice(0, janela);
    setGerando(true);
    setErroIA("");
    setProviderIA(null);
    try {
      const { plano: ai, provider } = await gerarPlanoSessao(paciente, sessoesContexto, janela, setProviderIA);
      const convertido = normalizeAIPlano(ai, paciente);
      setPlanoCurrent(convertido);
      if (terapeutaId && terapeutaId !== "demo") {
        const perguntasParaSalvar = ai.fluxoSocratico
          ? ai.fluxoSocratico.flatMap(e => (e.perguntas || []).map(p => p.texto || p))
          : (ai.perguntas || []);
        const { data: planoSalvo } = await salvarPlano(terapeutaId, paciente.id, {
          sessao_origem_id: sessoesContexto[0]?.id ?? null,
          numero_proxima: (paciente.sessoes || 0) + 1,
          objetivo: ai.objetivo,
          tecnicas: ai.tecnicas,
          perguntas: perguntasParaSalvar,
          distorcoes_foco: ai.distorcoes_foco || [],
          tarefa: ai.tarefa,
          observacoes: ai.obs || ai.observacoes || "",
          gerado_por: provider,
          contextoUtilizado: convertido.contextoUtilizado || 1,
        });
        if (planoSalvo?.id) setPlanoCurrent(prev => prev ? { ...prev, id: planoSalvo.id } : prev);
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
              <div style={{ fontSize:15, fontWeight:700, color:"#2C302E", marginBottom:8 }}>
                Nenhum plano gerado para esta sessão
              </div>
              <div style={{ fontSize:13, marginBottom:24 }}>
                Gere um plano personalizado com base nas últimas {Math.min(paciente.sessoesList.length, terapeutaPerfil?.janela_contexto || 3)} sessões registradas.
              </div>
              {erroIA && (
                <div style={{ marginBottom:16, padding:"10px 14px", background:"#fff1f2",
                  border:"1px solid #fecdd3", borderRadius:10, fontSize:12, color:"#dc2626", textAlign:"left" }}>
                  {erroIA}
                </div>
              )}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:4 }}>
                <button onClick={gerarPlano} disabled={gerando}
                  style={{ padding:"12px 32px", background: gerando ? "#F0C08A" : "#E28743",
                    color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700,
                    cursor: gerando ? "default" : "pointer" }}>
                  {gerando ? "Gerando plano…" : "🤖 Gerar plano com IA"}
                </button>
                {(() => {
                  const janela = terapeutaPerfil?.janela_contexto || 3;
                  const n = Math.min((paciente.sessoesList || []).length, janela);
                  if (n === 0) return null;
                  return (
                    <span style={{ fontSize:11, fontWeight:600, color:"#6366f1", background:"#eef2ff",
                      border:"1px solid #c7d2fe", borderRadius:10, padding:"2px 9px", whiteSpace:"nowrap" }}>
                      {n === 1 ? "1 sessão no contexto" : `${n} sessões no contexto`}
                    </span>
                  );
                })()}
              </div>
              {providerIA && (
                <div style={{ marginTop:8, fontSize:11, color:"#94a3b8" }}>
                  Usando: {providerIA === "gemini" ? "Google Gemini" : "Claude"}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:"#2C302E", marginBottom:6 }}>
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
    <div style={{ height:"100%", overflowY:"auto", padding: isMobile ? "16px" : "24px 28px", background:"rgba(241,167,166,0.05)" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:4 }}>Plano sugerido pela IA</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color:"#2C302E" }}>
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
            style={{ padding:"8px 18px", background: copiado ? "#d1fae5" : "#E28743",
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
            Gerado com base nas últimas {plano.contextoUtilizado || 1} {(plano.contextoUtilizado || 1) === 1 ? "sessão" : "sessões"} do histórico
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
        <div style={{ fontSize:14, color:"#2C302E", fontWeight:600, lineHeight:1.6 }}>
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
          <div style={{ fontSize:13, color:"#2C302E", lineHeight:1.7,
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
                  <span style={{ fontSize:12, fontWeight:700, color:"#2C302E" }}>{eixo.eixo}</span>
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
                          borderLeft:`3px solid ${foiEditada ? paciente.cor : "#E28743"}` }}>
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
                        borderRadius:"50%", background:"#E28743",
                        border:"1.5px solid #fff" }} />
                    )}
                  </div>
                  <button
                    onClick={() => setEditando(editando === `tecnica-${t}` ? null : `tecnica-${t}`)}
                    style={{ fontSize:11, padding:"2px 8px", borderRadius:6, cursor:"pointer",
                      border: editando === `tecnica-${t}` ? "1.5px solid #E28743" : "1px solid #e2e8f0",
                      background: editando === `tecnica-${t}` ? "#FEF3E2" : "#f8fafc",
                      color: editando === `tecnica-${t}` ? "#E28743" : "#64748b",
                      fontWeight: editando === `tecnica-${t}` ? 700 : 500, transition:"all 0.12s" }}>
                    🖊 personalizar
                  </button>
                  {temMolde && (
                    <button
                      onClick={() => setMoldeAberto(aberto ? null : t)}
                      style={{ fontSize:11, padding:"2px 8px", borderRadius:6, cursor:"pointer",
                        border: aberto ? "1.5px solid #E28743" : "1px solid #e2e8f0",
                        background: aberto ? "#FEF3E2" : "#f8fafc",
                        color: aberto ? "#E28743" : "#64748b",
                        fontWeight: aberto ? 700 : 500, transition:"all 0.12s" }}>
                      📋 molde
                    </button>
                  )}
                </div>

                {/* Painel de personalização inline */}
                {editando === `tecnica-${t}` && (
                  <div style={{ marginTop:8, padding:"14px 16px",
                    background:"#f8fafc", border:"1.5px solid #e2e8f0",
                    borderRadius:10, borderTop:"3px solid #E28743" }}>
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
                        fontSize:12, color:"#2C302E", lineHeight:1.6,
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
                        style={{ fontSize:11, color:"#E28743", background:"none",
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
                    borderRadius:10, borderTop:"3px solid #E28743" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#2C302E", marginBottom:4 }}>
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
                                fontSize:12, color:"#2C302E", lineHeight:1.6,
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
                                fontSize:12, color:"#2C302E", outline:"none",
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
              style={{ fontSize:11, color:"#E28743", background:"none", border:"none",
                cursor:"pointer", fontWeight:700, padding:"2px 8px" }}>
              {editando === "tarefa" ? "Salvar" : "Editar"}
            </button>
          </div>
        </div>
        {editando === "tarefa" ? (
          <textarea value={tarefaCustom} onChange={e => setTarefaCustom(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #E28743",
              borderRadius:8, fontSize:13, color:"#2C302E", lineHeight:1.6,
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
              borderRadius:8, fontSize:13, color:"#2C302E", lineHeight:1.6,
              resize:"vertical", outline:"none", boxSizing:"border-box", minHeight:80 }}/>
        ) : (
          <div style={{ fontSize:13, color:"#78350f", lineHeight:1.6 }}>{obsCustom}</div>
        )}
      </div>

      {/* Confirmar plano */}
      {plano && planoCurrent?.id && terapeutaId && terapeutaId !== "demo" && (
        <div style={{ marginBottom:12 }}>
          {planoConfirmado ? (
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12,
              padding:"12px 20px", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16 }}>✅</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#166534" }}>Plano confirmado</div>
                <div style={{ fontSize:11, color:"#15803d" }}>Revisão concluída e plano aprovado</div>
              </div>
              <button onClick={() => setPlanoConfirmado(false)}
                style={{ marginLeft:"auto", fontSize:11, color:"#16a34a", background:"none",
                  border:"none", cursor:"pointer", textDecoration:"underline" }}>
                Reabrir
              </button>
            </div>
          ) : (
            <button
              disabled={confirmando}
              onClick={async () => {
                setConfirmando(true);
                await atualizarPlano(planoCurrent.id, { status: 'confirmado' });
                setConfirmando(false);
                setPlanoConfirmado(true);
              }}
              style={{ width:"100%", padding:"12px 20px",
                background: confirmando ? "#F0C08A" : "#E28743",
                color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:700,
                cursor: confirmando ? "default" : "pointer", display:"flex",
                alignItems:"center", justifyContent:"center", gap:8 }}>
              {confirmando ? "Confirmando…" : "✓ Salvar e confirmar plano"}
            </button>
          )}
        </div>
      )}

      {/* Agendar próxima sessão — só aparece se não há sessão agendada */}
      {onAgendar && proximaSessao && proximaSessao !== "Não agendado" && (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12,
          padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>✅</span>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#166534" }}>Próxima sessão agendada</div>
            <div style={{ fontSize:11, color:"#15803d" }}>{proximaSessao}</div>
          </div>
          <button onClick={() => onAgendar()}
            style={{ marginLeft:"auto", padding:"5px 12px", background:"#fff", color:"#16a34a",
              border:"1px solid #86efac", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Alterar
          </button>
        </div>
      )}
      {onAgendar && (!proximaSessao || proximaSessao === "Não agendado") && (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12,
          padding:"16px 20px", marginBottom:12, display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#166534", marginBottom:2 }}>
              Agendar próxima sessão
            </div>
            <div style={{ fontSize:11, color:"#15803d" }}>
              Data, horário e recorrência para {paciente.nome.split(" ")[0]}
            </div>
          </div>
          <button onClick={() => onAgendar()}
            style={{ padding:"8px 18px", background:"#16a34a", color:"#fff",
              border:"none", borderRadius:10, fontSize:12, fontWeight:700,
              cursor:"pointer", flexShrink:0 }}>
            📅 Agendar
          </button>
        </div>
      )}

      {/* Enviar tarefa para o app do paciente */}
      <div style={{ background:"#FEF3E2", border:"1px solid #F0D4B0", borderRadius:12,
        padding:"16px 20px", marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#C47535", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:10 }}>📱 App do paciente</div>
        {tarefaEnviada ? (
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#15803d", marginBottom:3 }}>
                ✅ Tarefa enviada para {paciente.nome.split(" ")[0]}
              </div>
              <div style={{ fontSize:12, color:"#166534", lineHeight:1.5 }}>
                {tarefaEnviada.descricao}
              </div>
            </div>
            <button onClick={() => setTarefaEnviada(null)}
              style={{ fontSize:11, color:"#C47535", background:"none", border:"none",
                cursor:"pointer", textDecoration:"underline", flexShrink:0 }}>
              Reenviar
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:12, color:"#8A4020", marginBottom:12, lineHeight:1.5 }}>
              Envie a tarefa de casa para {paciente.nome.split(" ")[0]} acompanhar no app.
              O paciente poderá registrar o cumprimento e você receberá os relatórios aqui.
            </div>
            {erroEnvioTarefa && (
              <div style={{ fontSize:12, color:"#dc2626", background:"#fff1f2",
                border:"1px solid #fecdd3", borderRadius:8, padding:"8px 12px", marginBottom:10 }}>
                {erroEnvioTarefa}
              </div>
            )}
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ fontSize:12, color:"#8A4020", background:"#FEF3E2",
                border:"1px solid #F0D4B0", borderRadius:8, padding:"7px 12px", flex:1,
                minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {tarefaCustom || plano?.tarefa || "Nenhuma tarefa definida"}
              </div>
              <button
                disabled={enviandoTarefa || !plano || !(tarefaCustom || plano?.tarefa)}
                onClick={async () => {
                  const desc = tarefaCustom || plano?.tarefa;
                  if (!desc) return;
                  setEnviandoTarefa(true);
                  setErroEnvioTarefa("");
                  const { data, error } = await criarTarefa({
                    paciente_id: paciente.id,
                    terapeuta_id: terapeutaId,
                    sessao_id: null,
                    descricao: desc,
                    tipo_formulario: "abcd",
                  });
                  setEnviandoTarefa(false);
                  if (error) {
                    setErroEnvioTarefa("Erro ao enviar: " + (error.message || "tente novamente"));
                  } else {
                    setTarefaEnviada({ id: data?.id, descricao: desc });
                  }
                }}
                style={{ padding:"8px 16px", background: enviandoTarefa ? "#F0C08A" : "#E28743",
                  color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700,
                  cursor: enviandoTarefa ? "default" : "pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                {enviandoTarefa ? "Enviando…" : "📤 Enviar tarefa"}
              </button>
            </div>
          </div>
        )}
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
const TelaImportar = ({ paciente, isMobile = false, terapeutaId, onSessaoSalva, agendamentos = [], onAgendamentoRealizado }) => {
  const [fase, setFase] = useState("upload"); // upload | processando | revisao
  const [drag, setDrag] = useState(false);
  const [textoManual, setTextoManual] = useState("");
  const [extraido, setExtraido] = useState(null);
  const [provider, setProvider] = useState(null);
  const [erroIA, setErroIA] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [agendamentoVinculadoId, setAgendamentoVinculadoId] = useState(null);
  const fileInputRef = useRef(null);
  const cfg = CAMPOS_POR_LINHA[paciente.linha || "tcc"];

  // Agendamentos recentes deste paciente (últimos 30 dias + próximas 4h), não cancelados/realizados
  const agendamentosVinculaveis = agendamentos.filter(a => {
    if (String(a.paciente_id) !== String(paciente.id)) return false;
    if (a.status === "cancelado" || a.status === "realizado") return false;
    const ini = new Date(a.inicio);
    const agora = new Date();
    const ha30dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const em4h = new Date(agora.getTime() + 4 * 60 * 60 * 1000);
    return ini >= ha30dias && ini <= em4h;
  }).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

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
    setErroIA("");
    const proximoNumero = (paciente.sessoes || 0) + 1;
    const dataStr = agendamentoVinculadoId
      ? new Date(agendamentosVinculaveis.find(a => a.id === agendamentoVinculadoId)?.inicio || Date.now())
          .toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" })
      : new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
    const novaSessao = {
      numero: proximoNumero,
      data: dataStr,
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
      humor_inicio: Number.isInteger(extraido.humor_inicio) ? extraido.humor_inicio : null,
      humor_fim: Number.isInteger(extraido.humor_fim) ? extraido.humor_fim : null,
    };
    const pacienteReal = terapeutaId && terapeutaId !== "demo" && typeof paciente.id === "string";
    if (terapeutaId && terapeutaId !== "demo" && !pacienteReal) {
      setSalvando(false);
      setErroIA("Paciente não encontrado no banco de dados. Recarregue a página e tente novamente.");
      return;
    }
    let sessaoCriada = null;
    try {
      if (pacienteReal) {
        const { data, error: erroSessao } = await criarSessao(terapeutaId, paciente.id, {
          numero: proximoNumero,
          data: dataStr,
          resumo: extraido.resumo,
          temas: extraido.temas,
          distorcoes: extraido.distorcoes,
          tecnicas: extraido.tecnicas,
          emocoes: extraido.emocoes,
          alertas: extraido.alertas,
          resultado_tarefa: extraido.resultado_tarefa,
          tarefa_proxima: extraido.tarefa_proxima,
          humor_inicio: Number.isInteger(extraido.humor_inicio) ? extraido.humor_inicio : null,
          humor_fim: Number.isInteger(extraido.humor_fim) ? extraido.humor_fim : null,
          notas_raw: textoManual,
          ...(agendamentoVinculadoId ? { agendamento_id: agendamentoVinculadoId } : {}),
        });
        if (erroSessao) throw new Error(erroSessao.message || JSON.stringify(erroSessao));
        sessaoCriada = data;
        await atualizarPaciente(paciente.id, { sessoes: proximoNumero });
        if (agendamentoVinculadoId) {
          await atualizarAgendamento(agendamentoVinculadoId, { status: "realizado" });
          onAgendamentoRealizado?.(agendamentoVinculadoId);
        }
      }
      setSalvando(false);
      onSessaoSalva?.({ ...novaSessao, id: sessaoCriada?.id ?? null });
    } catch (err) {
      setSalvando(false);
      setErroIA(`Erro ao salvar sessão: ${err.message}`);
    }
  };

  if (fase === "upload") return (
    <div style={{ padding: isMobile ? "16px" : "28px", height:"100%", overflowY:"auto" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
        letterSpacing:"0.08em", marginBottom:4 }}>Importar relatório</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#2C302E", marginBottom:6 }}>
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
        style={{ border: drag ? "2px solid #E28743" : "2px dashed #cbd5e1",
          borderRadius:16, padding:"48px 24px", textAlign:"center",
          cursor:"pointer", background: drag ? "#FEF3E2" : "#fafafa",
          transition:"all 0.2s", marginBottom:20 }}>
        <input ref={fileInputRef} type="file" accept=".txt"
          style={{ display:"none" }} onChange={e => lerArquivo(e.target.files[0])} />
        <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
        <div style={{ fontSize:15, fontWeight:700, color:"#2C302E", marginBottom:6 }}>
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
            borderRadius:10, fontSize:13, color:"#2C302E", resize:"none",
            outline:"none", boxSizing:"border-box", lineHeight:1.6, fontFamily:"inherit" }}/>
        <button onClick={() => processarTexto(textoManual)}
          style={{ marginTop:8, padding:"10px 24px", background:"#E28743",
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
      <div style={{ fontSize:18, fontWeight:800, color:"#2C302E", marginBottom:8 }}>
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
      <div style={{ width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#E28743",
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
          <div style={{ fontSize:18, fontWeight:800, color:"#2C302E" }}>
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

      {/* ─── Vínculo com agendamento ─── */}
      <div style={{ marginTop:20, background:"#f8fafc", border:"1px solid #e2e8f0",
        borderRadius:12, padding:"16px 18px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:10 }}>
          📅 Vincular a sessão agendada
        </div>
        {agendamentosVinculaveis.length === 0 ? (
          <div style={{ fontSize:12, color:"#94a3b8", fontStyle:"italic" }}>
            Nenhum agendamento recente encontrado para {paciente.nome.split(" ")[0]}. A sessão será salva sem vínculo.
          </div>
        ) : (
          <>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:10 }}>
              Selecione o agendamento correspondente a esta sessão:
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {/* Opção "sem vínculo" */}
              <div onClick={() => setAgendamentoVinculadoId(null)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                  borderRadius:8, cursor:"pointer",
                  border: agendamentoVinculadoId === null ? "1.5px solid #E28743" : "1.5px solid #e2e8f0",
                  background: agendamentoVinculadoId === null ? "#FEF3E2" : "#fff" }}>
                <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid",
                  borderColor: agendamentoVinculadoId === null ? "#E28743" : "#cbd5e1",
                  background: agendamentoVinculadoId === null ? "#E28743" : "transparent",
                  flexShrink:0 }} />
                <span style={{ fontSize:12, color:"#64748b", fontStyle:"italic" }}>
                  Sem vínculo
                </span>
              </div>
              {agendamentosVinculaveis.map(a => {
                const sel = agendamentoVinculadoId === a.id;
                const d = new Date(a.inicio);
                const label = d.toLocaleDateString("pt-BR", { weekday:"short", day:"numeric", month:"short" });
                const hora = d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
                return (
                  <div key={a.id} onClick={() => setAgendamentoVinculadoId(a.id)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                      borderRadius:8, cursor:"pointer",
                      border: sel ? "1.5px solid #E28743" : "1.5px solid #e2e8f0",
                      background: sel ? "#FEF3E2" : "#fff" }}>
                    <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid",
                      borderColor: sel ? "#E28743" : "#cbd5e1",
                      background: sel ? "#E28743" : "transparent",
                      flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:13, fontWeight:700, color: sel ? "#C47535" : "#2C302E" }}>
                        {label} · {hora}
                      </span>
                      <span style={{ fontSize:11, color:"#94a3b8", marginLeft:8 }}>
                        {_CAL_TIPO_LABEL[a.tipo] ?? a.tipo}
                      </span>
                    </div>
                    {sel && <span style={{ fontSize:11, color:"#E28743", fontWeight:700 }}>✓</span>}
                  </div>
                );
              })}
            </div>
            {agendamentoVinculadoId && (
              <div style={{ marginTop:8, fontSize:11, color:"#10b981", fontWeight:600 }}>
                ✓ Ao salvar, o agendamento será marcado como realizado no calendário.
              </div>
            )}
          </>
        )}
      </div>

      {erroIA && (
        <div style={{ marginTop:16, padding:"10px 14px", background:"#fff1f2",
          border:"1px solid #fecdd3", borderRadius:10, fontSize:12, color:"#dc2626" }}>
          {erroIA}
        </div>
      )}

      <div style={{ marginTop:12, display:"flex", gap:10 }}>
        <button onClick={() => { setFase("upload"); setExtraido(null); setErroIA(""); setAgendamentoVinculadoId(null); }}
          style={{ padding:"10px 20px", background:"#f1f5f9",
            color:"#475569", border:"none", borderRadius:8, fontSize:13,
            fontWeight:700, cursor:"pointer" }}>
          Refazer importação
        </button>
        <button onClick={handleSalvar} disabled={salvando}
          style={{ padding:"10px 24px", background: salvando ? "#F0C08A" : "#E28743",
            color:"#fff", border:"none", borderRadius:8, fontSize:13,
            fontWeight:700, cursor: salvando ? "default" : "pointer", flex:1 }}>
          {salvando ? "Salvando…" : "✓ Confirmar e salvar no histórico"}
        </button>
      </div>
    </div>
  );
};

// ─── COMPONENTES AUXILIARES DE FORMULÁRIO (fora do TelaPerfil p/ evitar remount) ─
const PerfilSecao = ({ titulo }) => (
  <div style={{ gridColumn: "1/-1", paddingBottom: 8, marginBottom: 4, marginTop: 8,
    borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 700,
    color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
    {titulo}
  </div>
);

const PerfilCampo = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 5 }}>{label}</div>
    {children}
  </div>
);

// ─── COMPONENTE: ENTRADA DO HISTÓRICO DE AUDITORIA ───────────────────────────
const LABELS_CAMPO = {
  resumo: 'Resumo', objetivo: 'Objetivo', tarefa: 'Tarefa',
  status: 'Status', deleted_at: 'Arquivamento',
  temas: 'Temas', distorcoes: 'Distorções', tecnicas: 'Técnicas',
  emocoes: 'Emoções', alertas: 'Alertas', observacoes: 'Observações',
  nome: 'Nome', queixa: 'Queixa', meta: 'Meta',
};

const ICONE_OPERACAO = { INSERT: '➕', UPDATE: '✏️', DELETE: '🗑️' };

const camposAlterados = (ant, nov) => {
  if (!ant || !nov) return [];
  return Object.keys(nov).filter(
    k => JSON.stringify(nov[k]) !== JSON.stringify(ant[k])
  );
};

const EntradaAuditoria = ({ entrada }) => {
  const campos = entrada.operacao === 'UPDATE'
    ? camposAlterados(entrada.dados_anteriores, entrada.dados_novos)
    : [];

  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 16px",
      borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
        {ICONE_OPERACAO[entrada.operacao] ?? '•'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2C302E" }}>
            {entrada.tabelaLabel} · {entrada.operacaoLabel}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {entrada.criadoEmFormatado}
          </span>
        </div>
        {campos.length > 0 && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
            {campos.map((c, i) => (
              <span key={c}>
                {i > 0 && ", "}
                {LABELS_CAMPO[c]
                  ? <span>{LABELS_CAMPO[c]} atualizado</span>
                  : <em>{c}</em>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TELA: PERFIL DO PACIENTE ─────────────────────────────────────────────────
const TelaPerfil = ({ paciente, isMobile = false, onAtualizar, onExcluir, terapeutaId, terapeutaNome, terapeutaEmail }) => {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroArquivar, setErroArquivar] = useState("");

  // App do paciente
  const [convites, setConvites] = useState([]);
  const [carregandoConvites, setCarregandoConvites] = useState(false);
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoEntradas, setHistoricoEntradas] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [emailConvite, setEmailConvite] = useState(paciente.email || "");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [erroConvite, setErroConvite] = useState("");
  const [exportandoJSON, setExportandoJSON] = useState(false);
  const [exportandoCSV, setExportandoCSV] = useState(false);

  const handleExportarJSON = async () => {
    setExportandoJSON(true);
    const [{ data: sessoesData }, { data: planosData }, { data: tarefasData }] = await Promise.all([
      supabase.from('sessoes').select('*').eq('paciente_id', paciente.id).order('data', { ascending: false }),
      supabase.from('planos').select('*').eq('paciente_id', paciente.id).order('criado_em', { ascending: false }),
      supabase.from('tarefas').select('*').eq('paciente_id', paciente.id).order('criado_em', { ascending: false }),
    ]);
    exportarJSON(paciente, sessoesData ?? [], planosData ?? [], tarefasData ?? []);
    setExportandoJSON(false);
  };

  const handleExportarCSV = async () => {
    setExportandoCSV(true);
    const { data: sessoesData } = await supabase.from('sessoes').select('*').eq('paciente_id', paciente.id).order('data', { ascending: false });
    exportarCSV(paciente, sessoesData ?? []);
    setExportandoCSV(false);
  };

  useEffect(() => {
    if (!paciente?.id || typeof paciente.id !== "string") return;
    setCarregandoConvites(true);
    listarConvitesPaciente(paciente.id).then(({ data }) => {
      setConvites(data ?? []);
      setCarregandoConvites(false);
    });
  }, [paciente.id]);

  const conviteAtivo = convites.find(c => c.status === "usado") ?? convites.find(c => c.status === "pendente");

  const handleGerarConvite = async () => {
    const emailParaUsar = paciente.email?.trim() || emailConvite.trim();
    if (!emailParaUsar) {
      setErroConvite("Informe o e-mail do paciente para gerar o convite.");
      return;
    }
    setGerandoConvite(true);
    setErroConvite("");
    const { data, error } = await criarConvite(paciente.id, terapeutaId, emailParaUsar);
    setGerandoConvite(false);
    if (error) {
      setErroConvite("Erro ao gerar convite: " + (error.message || "tente novamente"));
    } else {
      setConvites(prev => [data, ...prev]);
    }
  };

  const abrirEmailConvite = (token) => {
    const link = gerarLinkConvite(token);
    const nomeProf = terapeutaNome || terapeutaEmail || "seu terapeuta";
    const nomePac = paciente.nome.split(" ")[0];
    const emailDestino = paciente.email?.trim() || emailConvite.trim();
    const assunto = encodeURIComponent("Convite para acompanhamento terapêutico");
    const corpo = encodeURIComponent(
`Olá, ${nomePac}!

Você está recebendo este convite de ${nomeProf} para acessar o app de acompanhamento terapêutico.

O app permite que você:
• Acompanhe as tarefas de casa definidas nas sessões
• Registre seus pensamentos e emoções com o formulário ABCD
• Registre seu humor diário

Para começar, acesse o link abaixo e crie sua conta:

${link}

Este link é pessoal e intransferível. Caso tenha dúvidas, entre em contato diretamente com ${nomeProf}.

Atenciosamente,
${nomeProf}`
    );
    window.open(`mailto:${emailDestino}?subject=${assunto}&body=${corpo}`, "_blank");
  };

  const handleRevogar = async (id) => {
    if (!window.confirm("Revogar este convite?")) return;
    await revogarConvite(id);
    setConvites(prev => prev.map(c => c.id === id ? { ...c, status: "revogado" } : c));
  };

  const copiarLink = (token) => {
    navigator.clipboard.writeText(gerarLinkConvite(token)).then(() => {
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    });
  };

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
    setEmailConvite(paciente.email || "");
    setConvites([]);
    setErroConvite("");
    setHistoricoAberto(false);
    setHistoricoEntradas([]);
    setHistoricoCarregado(false);
  }, [paciente.id]);

  const campo = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const salvar = async () => {
    setSalvando(true);
    setErroSalvar("");
    try {
      const atualizado = { ...paciente, ...form, iniciais: form.iniciais || gerarIniciais(form.nome) };
      await onAtualizar?.(atualizado);
      setEditando(false);
    } catch (err) {
      setErroSalvar(err.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    setExcluindo(true);
    setErroArquivar("");
    try { await onExcluir?.(paciente.id); }
    catch (e) { setErroArquivar(e.message || "Erro ao arquivar paciente"); }
    finally { setExcluindo(false); }
  };

  const corRisco = { baixo: "#10b981", medio: "#f59e0b", alto: "#ef4444" };
  const cor = corRisco[paciente.risco] || "#10b981";

  const inp = (ativo = true) => ({
    width: "100%", padding: "9px 12px", fontSize: 13, color: "#2C302E",
    border: `1.5px solid ${editando && ativo ? "#e2e8f0" : "#f1f5f9"}`,
    borderRadius: 8, background: editando && ativo ? "#fff" : "#f8fafc",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  });

  const Secao = PerfilSecao;
  const Campo = PerfilCampo;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: isMobile ? "16px" : "20px 28px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={46} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#2C302E", lineHeight: 1.2 }}>
              {editando ? (form.nome || paciente.nome) : paciente.nome}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cor,
                background: `${cor}15`, padding: "2px 10px", borderRadius: 20,
                border: `1px solid ${cor}30` }}>
                {paciente.risco === "alto" ? "⚠️ " : ""}Risco {paciente.risco}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{paciente.sessoes} sessões</span>
              <span style={{ fontSize: 12, color: BANCO_PALAVRAS[paciente.linha]?.cor || "#E28743",
                fontWeight: 600 }}>
                {BANCO_PALAVRAS[paciente.linha]?.label || "TCC"}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {editando ? (
            <>
              <button onClick={() => { setEditando(false); setErroSalvar(""); setForm(inicialForm(paciente)); }}
                style={{ padding: "7px 16px", background: "#f1f5f9", border: "none",
                  borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{ padding: "7px 16px", background: salvando ? "#F0C08A" : "#E28743",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  color: "#fff", cursor: salvando ? "default" : "pointer" }}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditando(true)}
              style={{ padding: "7px 16px", background: "#FEF3E2", border: "1.5px solid #F0D4B0",
                borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#C47535", cursor: "pointer" }}>
              ✎ Editar
            </button>
          )}
        </div>
        {erroSalvar && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fff1f2",
            border: "1px solid #fecdd3", borderRadius: 8, fontSize: 12, color: "#dc2626" }}>
            ⚠️ {erroSalvar}
          </div>
        )}
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
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2C302E" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* App do paciente */}
      {!editando && (
        <div style={{ border: "1px solid #c4b5fd", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20, background: "#faf5ff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            📱 App do paciente
          </div>

          {carregandoConvites ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Carregando…</div>
          ) : conviteAtivo ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                  background: conviteAtivo.status === "usado" ? "#f0fdf4" : "#fff7ed",
                  color: conviteAtivo.status === "usado" ? "#166534" : "#92400e",
                  border: `1px solid ${conviteAtivo.status === "usado" ? "#86efac" : "#fed7aa"}`,
                }}>
                  {conviteAtivo.status === "usado" ? "✅ Conectado" : "⏳ Aguardando cadastro"}
                </span>
                {conviteAtivo.email_paciente && (
                  <span style={{ fontSize: 12, color: "#64748b" }}>{conviteAtivo.email_paciente}</span>
                )}
              </div>
              {conviteAtivo.status !== "usado" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#C47535", background: "#FEF3E2",
                    border: "1px solid #F0D4B0", borderRadius: 8, padding: "6px 10px",
                    flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {gerarLinkConvite(conviteAtivo.token)}
                  </div>
                  <button onClick={() => copiarLink(conviteAtivo.token)}
                    style={{ padding: "6px 14px", background: linkCopiado ? "#f0fdf4" : "#E28743",
                      color: linkCopiado ? "#166534" : "#fff", border: "none",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    {linkCopiado ? "✓ Copiado" : "Copiar link"}
                  </button>
                </div>
              )}
              {conviteAtivo.status !== "usado" && conviteAtivo.email_paciente && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => abrirEmailConvite(conviteAtivo.token)}
                    style={{ padding: "7px 14px", background: "#E28743", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer" }}>
                    📧 Enviar por e-mail
                  </button>
                  <button onClick={() => handleRevogar(conviteAtivo.id)}
                    style={{ padding: "7px 12px", background: "none", color: "#94a3b8",
                      border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12,
                      fontWeight: 600, cursor: "pointer" }}>
                    Revogar
                  </button>
                </div>
              )}
              {conviteAtivo.status === "usado" && (
                <div style={{ fontSize: 12, color: "#15803d" }}>
                  {paciente.nome.split(" ")[0]} já está usando o app e pode receber tarefas.
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#8A4020", marginBottom: 12, lineHeight: 1.5 }}>
                Convide {paciente.nome.split(" ")[0]} para acompanhar o tratamento no app.
                {!paciente.email && (
                  <span style={{ color: "#92400e" }}> Informe o e-mail abaixo ou cadastre-o no perfil.</span>
                )}
              </div>
              {erroConvite && (
                <div style={{ fontSize: 12, color: "#dc2626", background: "#fff1f2",
                  border: "1px solid #fecdd3", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
                  {erroConvite}
                </div>
              )}
              {paciente.email ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, padding: "8px 12px", fontSize: 12, color: "#C47535",
                    background: "#FEF3E2", border: "1px solid #F0D4B0", borderRadius: 8 }}>
                    {paciente.email}
                  </div>
                  <button onClick={handleGerarConvite} disabled={gerandoConvite}
                    style={{ padding: "8px 16px", background: gerandoConvite ? "#F0C08A" : "#E28743",
                      color: "#fff", border: "none", borderRadius: 8, fontSize: 12,
                      fontWeight: 700, cursor: gerandoConvite ? "default" : "pointer", flexShrink: 0 }}>
                    {gerandoConvite ? "Gerando…" : "Gerar convite"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="email"
                    value={emailConvite}
                    onChange={e => setEmailConvite(e.target.value)}
                    placeholder="E-mail do paciente (obrigatório)"
                    style={{ flex: 1, minWidth: 160, padding: "8px 12px", fontSize: 12,
                      border: `1.5px solid ${erroConvite ? "#fca5a5" : "#F0D4B0"}`,
                      borderRadius: 8, outline: "none",
                      fontFamily: "inherit", color: "#2C302E" }}
                  />
                  <button onClick={handleGerarConvite} disabled={gerandoConvite}
                    style={{ padding: "8px 16px", background: gerandoConvite ? "#F0C08A" : "#E28743",
                      color: "#fff", border: "none", borderRadius: 8, fontSize: 12,
                      fontWeight: 700, cursor: gerandoConvite ? "default" : "pointer", flexShrink: 0 }}>
                    {gerandoConvite ? "Gerando…" : "Gerar convite"}
                  </button>
                </div>
              )}
              {paciente.email && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                  Para alterar o e-mail, edite o cadastro do paciente.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Histórico de alterações */}
      {!editando && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={async () => {
              const abrindo = !historicoAberto;
              setHistoricoAberto(abrindo);
              if (abrindo && !historicoCarregado) {
                setCarregandoHistorico(true);
                const { data } = await buscarAuditLogPaciente(paciente.id, 10);
                setHistoricoEntradas((data ?? []).map(formatarEntradaLog));
                setHistoricoCarregado(true);
                setCarregandoHistorico(false);
              }
            }}
            style={{ width: "100%", display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "10px 14px",
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: historicoAberto ? "10px 10px 0 0" : 10,
              cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#2C302E" }}>
                Histórico de alterações
              </span>
              {historicoCarregado && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px",
                  borderRadius: 10, background: "#e0e7ff", color: "#4338ca" }}>
                  {historicoEntradas.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8",
              transform: historicoAberto ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s", display: "inline-block" }}>▾</span>
          </button>

          {historicoAberto && (
            <div style={{ border: "1px solid #e2e8f0", borderTop: "none",
              borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
              {carregandoHistorico ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "#94a3b8" }}>
                  Carregando…
                </div>
              ) : historicoEntradas.length === 0 ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "#94a3b8" }}>
                  Nenhuma alteração registrada ainda.
                </div>
              ) : historicoEntradas.map(entrada => (
                <EntradaAuditoria key={entrada.id} entrada={entrada} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exportar dados */}
      {!editando && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12,
          padding: "16px 20px", background: "#fff", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Exportar dados
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            Exportação completa dos dados clínicos para portabilidade (LGPD Art. 18)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleExportarJSON}
              disabled={exportandoJSON}
              style={{ padding: "8px 16px", background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#0f172a",
                cursor: exportandoJSON ? "default" : "pointer", opacity: exportandoJSON ? 0.6 : 1 }}>
              {exportandoJSON ? "Exportando…" : "⬇ Exportar JSON"}
            </button>
            <button
              onClick={handleExportarCSV}
              disabled={exportandoCSV}
              style={{ padding: "8px 16px", background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#0f172a",
                cursor: exportandoCSV ? "default" : "pointer", opacity: exportandoCSV ? 0.6 : 1 }}>
              {exportandoCSV ? "Exportando…" : "⬇ Exportar CSV"}
            </button>
          </div>
        </div>
      )}

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
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C302E", marginBottom: 2 }}>
                  Arquivar paciente
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Preserva o cadastro e histórico. Pode ser restaurado em até 30 dias.
                </div>
              </div>
              <button onClick={() => setConfirmandoExcluir(true)}
                style={{ padding: "8px 18px", background: "#fff1f2",
                  border: "1.5px solid #fecdd3", borderRadius: 8, fontSize: 12,
                  fontWeight: 700, color: "#dc2626", cursor: "pointer", flexShrink: 0 }}>
                Arquivar paciente
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
                Arquivar {paciente.nome}?
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
                O cadastro e histórico serão preservados e poderão ser restaurados em até 30 dias.
                Após esse prazo, os dados são excluídos permanentemente.
              </div>
              {erroArquivar && (
                <div style={{ fontSize: 12, color: "#dc2626", background: "#fff1f2",
                  border: "1px solid #fecdd3", borderRadius: 8,
                  padding: "8px 12px", marginBottom: 12 }}>
                  {erroArquivar}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setConfirmandoExcluir(false); setErroArquivar(""); }}
                  style={{ padding: "8px 18px", background: "#f1f5f9", border: "none",
                    borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={excluir} disabled={excluindo}
                  style={{ padding: "8px 22px", background: excluindo ? "#fca5a5" : "#dc2626",
                    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    color: "#fff", cursor: excluindo ? "default" : "pointer" }}>
                  {excluindo ? "Arquivando…" : "Arquivar paciente"}
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
    <div style={{ height: "100%", display: "flex", overflow: "hidden", background: "rgba(241,167,166,0.05)" }}>

      {/* ── Coluna esquerda ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", borderRight: "1px solid #f1f5f9" }}>

        {/* Header */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          Mural de palavras-chave
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#2C302E", marginBottom: 20 }}>
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
              borderRadius: 10, fontSize: 13, color: "#2C302E", background: "#f8fafc",
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
              borderRadius: 10, fontSize: 13, color: "#2C302E", background: "#f8fafc",
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
      <div style={{ width: 300, flexShrink: 0, overflowY: "auto", padding: "24px 20px", background: "rgba(241,167,166,0.08)", borderLeft: "1px solid rgba(241,167,166,0.2)" }}>

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
      <div style={{ fontSize:15, fontWeight:700, color:"#2C302E", marginBottom:6 }}>Dados insuficientes</div>
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
          <div style={{ fontSize:20, fontWeight:800, color:"#2C302E" }}>
            Insights — {paciente.nome.split(" ")[0]}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            Baseado em {totalSessoes} sessão{totalSessoes !== 1 ? "s" : ""} registrada{totalSessoes !== 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={exportarRelatorio}
          style={{ padding:"8px 18px", background:"#2C302E", color:"#fff", border:"none",
            borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          Exportar relatório
        </button>
      </div>

      {/* ── Seção 2: Cards de métricas ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total de sessões", val: totalSessoes, sub:"registradas", cor:"#E28743" },
          { label:"Tarefas completas", val: `${pctCompletas}%`, sub:`${tarefasConcluidas} de ${totalComTarefa}`, cor:"#10b981" },
          { label:"Distorção principal", val: topDistorcoes[0]?.nome ?? "—", sub: topDistorcoes[0] ? `${topDistorcoes[0].percentual}% das sessões` : "dados insuficientes", cor:"#f59e0b" },
          { label:"Última sessão c/ alerta", val: ultimaSessaoAlerta ? `Sessão ${ultimaSessaoAlerta.numero}` : "Nenhuma", sub: ultimaSessaoAlerta ? ultimaSessaoAlerta.data : "sem alertas recentes", cor:"#ef4444" },
        ].map(({ label, val, sub, cor }) => (
          <div key={label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px",
            border:"1px solid #f1f5f9", borderTop:`3px solid ${cor}` }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#2C302E", marginBottom:2, lineHeight:1.3 }}>{val}</div>
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

// ─── HELPERS: AGENDAMENTOS ────────────────────────────────────────────────────────
const _proxAgendDe = (pacienteId, agends) => {
  const agora = new Date();
  return agends
    .filter(a => String(a.paciente_id) === String(pacienteId) && a.status !== "cancelado" && new Date(a.inicio) >= agora)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0] ?? null;
};

const _labelAgend = (agend) => {
  if (!agend) return "Não agendado";
  const d = new Date(agend.inicio);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const hora = d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
  if (dia.getTime() === hoje.getTime()) return `Hoje, ${hora}`;
  if (dia.getTime() === amanha.getTime()) return `Amanhã, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { weekday:"short", day:"numeric", month:"short" })}, ${hora}`;
};

// ─── COMPONENTE: AGENDA HOJE/AMANHÃ ──────────────────────────────────────────────
const AgendaHojeList = ({ agendamentos, pacientes, onSelect, onNovoAgendamento }) => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);

  const doDia = (dia) => agendamentos
    .filter(a => {
      const d = new Date(a.inicio); d.setHours(0, 0, 0, 0);
      return d.getTime() === dia.getTime() && a.status !== "cancelado";
    })
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  const agendHoje = doDia(hoje);
  const agendAmanha = doDia(amanha);

  const renderItem = (a) => {
    const p = pacientes.find(px => String(px.id) === String(a.paciente_id));
    const hora = new Date(a.inicio).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
    return (
      <div key={a.id} onClick={() => p && onSelect(p)}
        style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px",
          cursor: p ? "pointer" : "default", borderBottom:"1px solid #f8fafc",
          transition:"background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#FEF3E2"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <Avatar iniciais={p?.iniciais ?? "?"} cor={p?.cor ?? "#94a3b8"} tamanho={26} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#2C302E",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {p?.nome ?? a.paciente_nome ?? "Sem paciente"}
          </div>
          <div style={{ fontSize:10, color:"#E28743", fontWeight:600 }}>
            {hora} · {_CAL_TIPO_LABEL?.[a.tipo] ?? a.tipo}
          </div>
        </div>
      </div>
    );
  };

  if (agendHoje.length === 0 && agendAmanha.length === 0) {
    return (
      <div style={{ padding:"20px 16px", textAlign:"center" }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📭</div>
        <div style={{ fontSize:12, color:"#94a3b8", marginBottom:12 }}>
          Sem sessões hoje ou amanhã
        </div>
        {onNovoAgendamento && (
          <button onClick={() => onNovoAgendamento(null)}
            style={{ padding:"6px 14px", background:"#E28743", color:"#fff",
              border:"none", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer" }}>
            + Novo agendamento
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {agendHoje.length > 0 && (
        <>
          <div style={{ padding:"4px 14px", fontSize:10, fontWeight:700, color:"#dc2626",
            textTransform:"uppercase", letterSpacing:"0.07em", background:"#fff1f2",
            borderBottom:"1px solid #fecdd3" }}>
            Hoje · {agendHoje.length}
          </div>
          {agendHoje.map(renderItem)}
        </>
      )}
      {agendAmanha.length > 0 && (
        <>
          <div style={{ padding:"4px 14px", fontSize:10, fontWeight:700, color:"#64748b",
            textTransform:"uppercase", letterSpacing:"0.07em", background:"#f8fafc",
            borderBottom:"1px solid #f1f5f9" }}>
            Amanhã · {agendAmanha.length}
          </div>
          {agendAmanha.map(renderItem)}
        </>
      )}
    </div>
  );
};

// ─── MODAL: AGENDAMENTO ───────────────────────────────────────────────────────────
const ModalAgendamento = ({ paciente, pacientes = [], terapeutaId, onSalvar, onFechar, dataInicial, horaInicioInicial, agendamentoExistente }) => {
  const modoEdicao = !!agendamentoExistente;
  const hoje = new Date().toISOString().slice(0, 10);

  const _iniData = () => {
    if (agendamentoExistente) return new Date(agendamentoExistente.inicio).toISOString().slice(0, 10);
    return dataInicial || hoje;
  };
  const _iniHora = () => {
    if (agendamentoExistente) {
      const d = new Date(agendamentoExistente.inicio);
      return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    }
    return horaInicioInicial || "09:00";
  };
  const _iniDuracao = () => {
    if (agendamentoExistente) return Math.round((new Date(agendamentoExistente.fim) - new Date(agendamentoExistente.inicio)) / 60000);
    return 50;
  };

  const [data, setData] = useState(_iniData);
  const [horaInicio, setHoraInicio] = useState(_iniHora);
  const [duracao, setDuracao] = useState(_iniDuracao);
  const [tipo, setTipo] = useState(agendamentoExistente?.tipo || "sessao");
  const [notas, setNotas] = useState(agendamentoExistente?.notas || "");
  const [salvando, setSalvando] = useState(false);
  const [pacienteIdSel, setPacienteIdSel] = useState(paciente?.id ?? "");
  const [recorrencia, setRecorrencia] = useState("nenhuma");
  const [repeticoes, setRepeticoes] = useState(8);
  const [erroModal, setErroModal] = useState(null);

  const calcularFim = (hi, dur) => {
    const [h, m] = hi.split(":").map(Number);
    const totalMin = h * 60 + m + Number(dur);
    return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  };

  const horaFim = calcularFim(horaInicio, duracao);

  const pacienteEfetivo = paciente ?? pacientes.find(p => String(p.id) === String(pacienteIdSel)) ?? null;

  // UUID v4 válido: 8-4-4-4-12 hex chars
  const isUUID = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const pacienteIdParaDB = isUUID(pacienteEfetivo?.id) ? pacienteEfetivo.id : null;

  const offsets = recorrencia === "semanal"   ? Array.from({ length: repeticoes }, (_, i) => i * 7)
                : recorrencia === "quinzenal" ? Array.from({ length: repeticoes }, (_, i) => i * 14)
                : recorrencia === "mensal"    ? Array.from({ length: repeticoes }, (_, i) => i * 30)
                : [0];

  const salvar = async () => {
    if (!data || !horaInicio) return;
    setErroModal(null);

    const ini = new Date(`${data}T${horaInicio}:00`);
    const fim = new Date(`${data}T${horaFim}:00`);

    // Modo edição — atualiza agendamento existente
    if (modoEdicao) {
      setSalvando(true);
      const { data: atualizado, error } = await atualizarAgendamento(agendamentoExistente.id, {
        inicio: ini.toISOString(), fim: fim.toISOString(), tipo, notas,
      });
      setSalvando(false);
      if (error) { alert(`Erro ao salvar: ${error.message ?? JSON.stringify(error)}`); return; }
      onSalvar([atualizado ?? { ...agendamentoExistente, inicio: ini.toISOString(), fim: fim.toISOString(), tipo, notas }]);
      return;
    }

    // Modo criação
    if (hasSupabase && pacienteEfetivo && !pacienteIdParaDB) {
      setErroModal("Este paciente não possui ID válido no sistema. Tente recadastrá-lo ou entre em contato com o suporte.");
      return;
    }
    if (hasSupabase && !pacienteEfetivo && !pacienteIdSel) {
      setErroModal("Selecione um paciente para agendar a sessão.");
      return;
    }
    setSalvando(true);
    const baseInicio = ini;
    const baseFim = fim;
    const criados = [];
    for (const offset of offsets) {
      const iniOff = new Date(baseInicio); iniOff.setDate(iniOff.getDate() + offset);
      const fimOff = new Date(baseFim);    fimOff.setDate(fimOff.getDate() + offset);
      const { data: agend, error } = await criarAgendamento(terapeutaId, {
        pacienteId: pacienteIdParaDB,
        inicio: iniOff.toISOString(), fim: fimOff.toISOString(), tipo, notas,
      });
      if (error) { console.error("[ModalAgendamento] erro Supabase:", error); setSalvando(false); alert(`Erro ao criar agendamento: ${error.message ?? JSON.stringify(error)}`); return; }
      criados.push(agend ?? {
        id: `local-${Date.now()}-${offset}`,
        paciente_id: pacienteIdParaDB,
        paciente_nome: pacienteEfetivo?.nome ?? "",
        paciente_iniciais: pacienteEfetivo?.iniciais ?? "",
        terapeuta_id: terapeutaId,
        inicio: iniOff.toISOString(), fim: fimOff.toISOString(), tipo, status: "agendado", notas,
      });
    }
    setSalvando(false);
    onSalvar(criados);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px 24px",
        width:460, boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#2C302E", marginBottom:16 }}>
          {modoEdicao ? "✏️ Editar agendamento" : "📅 Agendar sessão"}
        </div>

        {/* Seletor de paciente — oculto no modo edição */}
        {!modoEdicao && (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                letterSpacing:"0.06em", marginBottom:5 }}>Paciente</div>
              {paciente ? (
                <div style={{ padding:"8px 12px", background:"#f8fafc", border:"1.5px solid #f1f5f9",
                  borderRadius:8, fontSize:13, color:"#2C302E", fontWeight:600 }}>
                  {paciente.nome}
                </div>
              ) : (
                <select value={pacienteIdSel} onChange={e => { setPacienteIdSel(e.target.value); setErroModal(null); }}
                  style={{ width:"100%", padding:"8px 12px", border:`1.5px solid ${erroModal ? "#ef4444" : "#e2e8f0"}`,
                    borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                    background:"#fff", boxSizing:"border-box" }}>
                  <option value="">— Sem paciente vinculado —</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              )}
            </div>
            {erroModal && (
              <div style={{ marginTop:-8, marginBottom:10, padding:"8px 12px", background:"#fff1f2",
                border:"1px solid #fecdd3", borderRadius:8, fontSize:12, color:"#be123c", fontWeight:600 }}>
                ⚠️ {erroModal}
              </div>
            )}
          </>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
              letterSpacing:"0.06em", marginBottom:5 }}>Data *</div>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                borderRadius:8, fontSize:13, color:"#2C302E", outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
              letterSpacing:"0.06em", marginBottom:5 }}>Hora início *</div>
            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
              style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                borderRadius:8, fontSize:13, color:"#2C302E", outline:"none", boxSizing:"border-box" }} />
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
              letterSpacing:"0.06em", marginBottom:5 }}>Duração</div>
            <select value={duracao} onChange={e => setDuracao(e.target.value)}
              style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                background:"#fff", boxSizing:"border-box" }}>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={50}>50 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
              letterSpacing:"0.06em", marginBottom:5 }}>Hora fim</div>
            <div style={{ padding:"9px 12px", border:"1.5px solid #f1f5f9", borderRadius:8,
              fontSize:13, color:"#94a3b8", background:"#f8fafc" }}>
              {horaFim}
            </div>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
            letterSpacing:"0.06em", marginBottom:5 }}>Tipo</div>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
              borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
              background:"#fff", boxSizing:"border-box" }}>
            <option value="sessao">Sessão</option>
            <option value="avaliacao">Avaliação</option>
            <option value="retorno">Retorno</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {!modoEdicao && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:5 }}>Recorrência</div>
                <select value={recorrencia} onChange={e => setRecorrencia(e.target.value)}
                  style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                    borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                    background:"#fff", boxSizing:"border-box" }}>
                  <option value="nenhuma">Pontual</option>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
              {recorrencia !== "nenhuma" && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
                    letterSpacing:"0.06em", marginBottom:5 }}>Repetições</div>
                  <select value={repeticoes} onChange={e => setRepeticoes(Number(e.target.value))}
                    style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
                      borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
                      background:"#fff", boxSizing:"border-box" }}>
                    <option value={4}>4×</option>
                    <option value={8}>8×</option>
                    <option value={12}>12×</option>
                    <option value={24}>24×</option>
                  </select>
                </div>
              )}
            </div>
            {recorrencia !== "nenhuma" && (
              <div style={{ padding:"8px 12px", background:"#f0fdf4", border:"1px solid #bbf7d0",
                borderRadius:8, fontSize:11, color:"#166534", fontWeight:600, marginBottom:14 }}>
                Serão criados {offsets.length} agendamentos · {offsets.length > 1 ? `até ${new Date(new Date(`${data}T${horaInicio}:00`).getTime() + offsets[offsets.length-1]*86400000).toLocaleDateString("pt-BR")}` : ""}
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase",
            letterSpacing:"0.06em", marginBottom:5 }}>Notas (opcional)</div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ex: Primeira sessão de avaliação inicial"
            rows={2}
            style={{ width:"100%", padding:"8px 12px", border:"1.5px solid #e2e8f0",
              borderRadius:8, fontSize:13, color:"#2C302E", outline:"none",
              resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} />
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onFechar}
            style={{ padding:"9px 20px", background:"#f1f5f9", color:"#475569",
              border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            style={{ padding:"9px 24px", background:"#E28743", color:"#fff",
              border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
              opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando…" : modoEdicao ? "Salvar alterações" : recorrencia !== "nenhuma" ? `Agendar ${offsets.length} sessões` : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TELA: CALENDÁRIO SEMANAL ─────────────────────────────────────────────────────
const _CAL_HORA_INI = 7;
const _CAL_HORA_FIM = 21;
const _CAL_SLOT_H = 40; // px por 30 min
const _CAL_SLOTS = (() => {
  const s = [];
  for (let h = _CAL_HORA_INI; h < _CAL_HORA_FIM; h++) {
    s.push({ h, m: 0 });
    s.push({ h, m: 30 });
  }
  return s;
})();
const _CAL_NOMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const _CAL_TIPO_LABEL = { sessao:"Sessão", avaliacao:"Avaliação", retorno:"Retorno", outro:"Outro" };
const _CAL_STATUS_ESTILO = {
  realizado: { bg:"#f0fdf4", border:"#86efac", borderLeft:"#16a34a", cor:"#166534", prefixo:"✓ " },
  cancelado:  { bg:"#f1f5f9", border:"#cbd5e1", borderLeft:"#94a3b8", cor:"#94a3b8", prefixo:"✕ " },
};

const TelaCalendario = ({ agendamentos, setAgendamentos, pacientes, terapeutaId, onIrParaCopiloto, onCarregarSemana }) => {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [modalSlot, setModalSlot] = useState(null);
  const [agendSel, setAgendSel] = useState(null);
  const [modoVista, setModoVista] = useState("semana"); // "semana" | "dia"
  const [diaSel, setDiaSel] = useState(0); // índice 0-6 dentro da semana
  const [draggingId, setDraggingId] = useState(null);
  const [agendEditing, setAgendEditing] = useState(null);

  const getSegunda = (offset) => {
    const d = new Date();
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const s = new Date(d);
    s.setDate(d.getDate() + diff + offset * 7);
    s.setHours(0, 0, 0, 0);
    return s;
  };

  const segunda = getSegunda(semanaOffset);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    return d;
  });

  const hojeRef = new Date();
  hojeRef.setHours(0, 0, 0, 0);

  // Carrega dados ao navegar para semana fora do range inicial
  useEffect(() => {
    if (!onCarregarSemana) return;
    const dom = new Date(segunda); dom.setHours(0, 0, 0, 0);
    const sab = new Date(dom); sab.setDate(dom.getDate() + 6); sab.setHours(23, 59, 59, 999);
    onCarregarSemana(dom, sab);
  }, [semanaOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const mesmoDia = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const agendsDia = (dia) =>
    agendamentos.filter(a => mesmoDia(new Date(a.inicio), dia));

  const posAgend = (a) => {
    const ini = new Date(a.inicio);
    const fim = new Date(a.fim);
    const topMin = (ini.getHours() - _CAL_HORA_INI) * 60 + ini.getMinutes();
    const top = (topMin / 30) * _CAL_SLOT_H;
    const durMin = Math.max(30, (fim - ini) / 60000);
    return { top, height: (durMin / 30) * _CAL_SLOT_H };
  };

  const labelSemana = () => {
    const fim = new Date(segunda);
    fim.setDate(segunda.getDate() + 6);
    const o = { day:"numeric", month:"short" };
    return `${segunda.toLocaleDateString("pt-BR", o)} – ${fim.toLocaleDateString("pt-BR", { ...o, year:"numeric" })}`;
  };

  const TOTAL_H = _CAL_SLOTS.length * _CAL_SLOT_H;
  const diaAtual = dias[diaSel];

  const navegarDia = (delta) => {
    const novo = diaSel + delta;
    if (novo < 0) { setSemanaOffset(o => o - 1); setDiaSel(6); }
    else if (novo > 6) { setSemanaOffset(o => o + 1); setDiaSel(0); }
    else setDiaSel(novo);
  };

  const handleDrop = async (e, dia, h, m) => {
    e.preventDefault();
    const agendId = e.dataTransfer.getData("agendId");
    if (!agendId) return;
    const agend = agendamentos.find(a => a.id === agendId);
    if (!agend) return;
    const durMin = Math.round((new Date(agend.fim) - new Date(agend.inicio)) / 60000);
    const novoIni = new Date(dia); novoIni.setHours(h, m, 0, 0);
    const novoFim = new Date(novoIni.getTime() + durMin * 60000);
    setDraggingId(null);
    setAgendamentos(prev => prev.map(a => a.id === agendId
      ? { ...a, inicio: novoIni.toISOString(), fim: novoFim.toISOString() } : a));
    const { error } = await atualizarAgendamento(agendId, {
      inicio: novoIni.toISOString(), fim: novoFim.toISOString(),
    });
    if (error) {
      setAgendamentos(prev => prev.map(a => a.id === agendId ? agend : a));
      alert(`Erro ao mover: ${error.message}`);
    }
  };

  const handleCancelarAgendamento = async (id) => {
    if (!window.confirm("Cancelar este agendamento?")) return;
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: "cancelado" } : a));
    setAgendSel(null);
    const { error } = await cancelarAgendamento(id);
    if (error) {
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: "agendado" } : a));
      alert(`Erro ao cancelar: ${error.message}`);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:"#fff" }}>

      {/* Barra de navegação */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px",
        borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>

        {/* Navegação esquerda */}
        <button onClick={() => modoVista === "semana" ? setSemanaOffset(o => o - 1) : navegarDia(-1)}
          style={{ padding:"5px 12px", border:"1.5px solid #e2e8f0", borderRadius:8,
            background:"#fff", cursor:"pointer", fontSize:16, color:"#64748b" }}>‹</button>

        {/* Label central */}
        <div style={{ flex:1, textAlign:"center", fontSize:13, fontWeight:700, color:"#2C302E" }}>
          {modoVista === "semana"
            ? labelSemana()
            : diaAtual.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </div>

        {/* Botão Hoje */}
        <button onClick={() => { setSemanaOffset(0); setDiaSel(hojeRef.getDay() === 0 ? 6 : hojeRef.getDay() - 1); }}
          style={{ padding:"5px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, cursor:"pointer",
            fontSize:12, fontWeight:700,
            background: semanaOffset === 0 && (modoVista === "semana" || mesmoDia(diaAtual, hojeRef)) ? "#FEF3E2" : "#fff",
            color: semanaOffset === 0 && (modoVista === "semana" || mesmoDia(diaAtual, hojeRef)) ? "#C47535" : "#64748b" }}>
          Hoje
        </button>

        {/* Navegação direita */}
        <button onClick={() => modoVista === "semana" ? setSemanaOffset(o => o + 1) : navegarDia(1)}
          style={{ padding:"5px 12px", border:"1.5px solid #e2e8f0", borderRadius:8,
            background:"#fff", cursor:"pointer", fontSize:16, color:"#64748b" }}>›</button>

        {/* Toggle Semana/Dia */}
        <div style={{ display:"flex", border:"1.5px solid #e2e8f0", borderRadius:8, overflow:"hidden", marginLeft:4 }}>
          {["semana","dia"].map(v => (
            <button key={v} onClick={() => setModoVista(v)}
              style={{ padding:"5px 12px", border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
                background: modoVista === v ? "#E28743" : "#fff",
                color: modoVista === v ? "#fff" : "#64748b" }}>
              {v === "semana" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Grade */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

        {/* Cabeçalho de dias — sticky */}
        <div style={{ display:"flex", borderBottom:"2px solid #e2e8f0",
          position:"sticky", top:0, zIndex:10, background:"#fff" }}>
          <div style={{ width:52, flexShrink:0 }} />
          {(modoVista === "semana" ? dias : [diaAtual]).map((dia, i) => {
            const isHoje = mesmoDia(dia, hojeRef);
            const isSel = modoVista === "semana" && i === diaSel;
            const nomIdx = modoVista === "semana" ? i : diaSel;
            return (
              <div key={i}
                onClick={() => { if (modoVista === "semana") { setDiaSel(i); setModoVista("dia"); } }}
                style={{ flex:1, padding:"8px 4px", textAlign:"center",
                  borderLeft:"1px solid #f1f5f9",
                  cursor: modoVista === "semana" ? "pointer" : "default",
                  background: isSel ? "#FEF3E2" : "transparent" }}>
                <div style={{ fontSize:10, fontWeight:700,
                  color: isSel ? "#E28743" : "#94a3b8",
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>
                  {_CAL_NOMES[nomIdx]}
                </div>
                <div style={{ width:28, height:28, borderRadius:"50%",
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:800,
                  background: isHoje ? "#E28743" : isSel ? "#FEF3E2" : "transparent",
                  color: isHoje ? "#fff" : isSel ? "#C47535" : "#2C302E" }}>
                  {dia.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Corpo da grade */}
        <div style={{ display:"flex", flex:1, minHeight:TOTAL_H }}>

          {/* Coluna de horas */}
          <div style={{ width:52, flexShrink:0, borderRight:"1px solid #f1f5f9" }}>
            {_CAL_SLOTS.map(({ h, m }) => (
              <div key={`t${h}${m}`} style={{ height:_CAL_SLOT_H, display:"flex",
                alignItems:"flex-start", justifyContent:"flex-end",
                paddingRight:6, paddingTop:3,
                borderBottom:`1px solid ${m === 0 ? "#f1f5f9" : "transparent"}` }}>
                {m === 0 && (
                  <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>
                    {String(h).padStart(2,"0")}h
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Colunas de dias (7 em semana, 1 em dia) */}
          {(modoVista === "semana" ? dias : [diaAtual]).map((dia, di) => {
            const agends = agendsDia(dia);
            const isHoje = mesmoDia(dia, hojeRef);
            return (
              <div key={di} style={{ flex:1, position:"relative", height:TOTAL_H,
                borderLeft:"1px solid #f1f5f9",
                background: isHoje ? "#fafaff" : "#fff" }}>

                {/* Áreas de slot clicáveis + drop target */}
                {_CAL_SLOTS.map(({ h, m }, si) => (
                  <div key={`s${h}${m}`}
                    onClick={() => setModalSlot({
                      data: new Date(dia),
                      horaInicio: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`,
                    })}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "#FEF3E2"; }}
                    onDragLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    onDrop={e => { e.currentTarget.style.background = "transparent"; handleDrop(e, dia, h, m); }}
                    style={{ position:"absolute", top: si * _CAL_SLOT_H,
                      left:0, right:0, height:_CAL_SLOT_H, cursor:"pointer",
                      borderBottom:`1px solid ${m === 0 ? "#f1f5f9" : "#f8fafc"}` }}
                    onMouseEnter={e => { if (!draggingId) e.currentTarget.style.background = "#FEF3E2"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  />
                ))}

                {/* Agendamentos */}
                {agends.map(a => {
                  const { top, height } = posAgend(a);
                  const estilo = _CAL_STATUS_ESTILO[a.status] ?? null;
                  const bloqueado = a.status === "cancelado" || a.status === "realizado";
                  return (
                    <div key={a.id}
                      draggable={!bloqueado}
                      onDragStart={e => { e.dataTransfer.setData("agendId", a.id); setDraggingId(a.id); }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={e => { e.stopPropagation(); setAgendSel(a); }}
                      style={{ position:"absolute", top: top + 1, left:2, right:2,
                        height: height - 2,
                        background: estilo ? estilo.bg : "#FEF3E2",
                        border: `1.5px solid ${estilo ? estilo.border : "#F0D4B0"}`,
                        borderLeft: `3px solid ${estilo ? estilo.borderLeft : "#E28743"}`,
                        borderRadius:6, padding:"3px 6px", overflow:"hidden",
                        cursor: bloqueado ? "default" : "grab",
                        opacity: draggingId === a.id ? 0.4 : bloqueado ? 0.7 : 1,
                        zIndex:2 }}>
                      <div style={{ fontSize:10, fontWeight:700,
                        color: estilo ? estilo.cor : "#C47535",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {estilo?.prefixo}
                        {a.paciente_iniciais && <span style={{ opacity:0.7 }}>{a.paciente_iniciais} · </span>}
                        {a.paciente_nome || "Agendamento"}
                      </div>
                      {height > _CAL_SLOT_H && (
                        <div style={{ fontSize:9, color: estilo ? estilo.cor : "#E28743", opacity:0.7, marginTop:1 }}>
                          {new Date(a.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                          –{new Date(a.fim).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover de agendamento selecionado */}
      {agendSel && (
        <div style={{ position:"fixed", inset:0, zIndex:150, background:"rgba(0,0,0,0.25)" }}
          onClick={() => setAgendSel(null)}>
          <div style={{ position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            background:"#fff", borderRadius:14, padding:"20px 20px 16px",
            boxShadow:"0 8px 32px rgba(0,0,0,0.18)", border:"1px solid #f1f5f9",
            width:300 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"#2C302E" }}>
                  {agendSel.paciente_nome || "Agendamento"}
                </div>
                <div style={{ fontSize:11, color:"#E28743", fontWeight:600, marginTop:2 }}>
                  {_CAL_TIPO_LABEL[agendSel.tipo] ?? agendSel.tipo}
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                background: agendSel.status === "cancelado" ? "#fff1f2" : agendSel.status === "realizado" ? "#f0fdf4" : "#FEF3E2",
                color: agendSel.status === "cancelado" ? "#dc2626" : agendSel.status === "realizado" ? "#16a34a" : "#C47535" }}>
                {agendSel.status === "realizado" ? "✓ realizado" : agendSel.status}
              </span>
            </div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>
              📅 {new Date(agendSel.inicio).toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}
              {"  ·  "}
              🕐 {new Date(agendSel.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
              {" – "}
              {new Date(agendSel.fim).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
            </div>
            {agendSel.notas && (
              <div style={{ fontSize:12, color:"#64748b", background:"#f8fafc",
                borderRadius:8, padding:"8px 10px", marginBottom:14, fontStyle:"italic" }}>
                {agendSel.notas}
              </div>
            )}
            {/* Botões de ação */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {agendSel.paciente_nome && (
                <button
                  onClick={() => {
                    const p = pacientes.find(px => String(px.id) === String(agendSel.paciente_id));
                    if (p && onIrParaCopiloto) onIrParaCopiloto(p);
                    setAgendSel(null);
                  }}
                  style={{ flex:1, padding:"7px 0", background:"#E28743", color:"#fff",
                    border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  Abrir copiloto
                </button>
              )}
              {agendSel.status !== "cancelado" && (
                <button
                  onClick={() => { setAgendEditing(agendSel); setAgendSel(null); }}
                  style={{ flex:1, padding:"7px 0", background:"#f0fdf4", color:"#16a34a",
                    border:"1px solid #bbf7d0", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  ✏️ Editar
                </button>
              )}
              {agendSel.status !== "cancelado" && (
                <button
                  onClick={() => handleCancelarAgendamento(agendSel.id)}
                  style={{ flex:1, padding:"7px 0", background:"#fff1f2", color:"#dc2626",
                    border:"1px solid #fecdd3", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  ✕ Cancelar
                </button>
              )}
              <button onClick={() => setAgendSel(null)}
                style={{ flex:1, padding:"7px 0", background:"#f1f5f9", color:"#475569",
                  border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ao clicar em slot vazio */}
      {modalSlot && (
        <ModalAgendamento
          paciente={null}
          pacientes={pacientes}
          terapeutaId={terapeutaId}
          dataInicial={modalSlot.data.toISOString().slice(0, 10)}
          horaInicioInicial={modalSlot.horaInicio}
          onSalvar={novos => {
            const lista = Array.isArray(novos) ? novos : [novos];
            setAgendamentos(prev => [...prev, ...lista]);
            setModalSlot(null);
          }}
          onFechar={() => setModalSlot(null)}
        />
      )}

      {/* Modal de edição de agendamento existente */}
      {agendEditing && (
        <ModalAgendamento
          paciente={pacientes.find(p => String(p.id) === String(agendEditing.paciente_id)) ?? null}
          pacientes={pacientes}
          terapeutaId={terapeutaId}
          agendamentoExistente={agendEditing}
          onSalvar={novos => {
            const atualizado = novos[0];
            setAgendamentos(prev => prev.map(a => a.id === agendEditing.id
              ? { ...a, ...atualizado } : a));
            setAgendEditing(null);
          }}
          onFechar={() => setAgendEditing(null)}
        />
      )}
    </div>
  );
};

// ─── TELA: CONFIGURAÇÕES DO TERAPEUTA ────────────────────────────────────────
// ─── TELA: DASHBOARD ──────────────────────────────────────────────────────────
const TelaDashboard = ({ pacientesLista = [], agendamentos = [], terapeutaId, terapeutaNome }) => {
  const [metricas, setMetricas] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const agora = new Date();
    const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 3600 * 1000);
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 3600 * 1000);
    const inicioDia = new Date(agora); inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(agora); fimDia.setHours(23, 59, 59, 999);
    const diaSemana = agora.getDay();
    const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - diaSemana); inicioSemana.setHours(0, 0, 0, 0);
    const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23, 59, 59, 999);

    const agendHoje = agendamentos.filter(a => {
      if (a.status === 'cancelado') return false;
      const d = new Date(a.inicio);
      return d >= inicioDia && d <= fimDia;
    });
    const agendSemana = agendamentos.filter(a => {
      if (a.status === 'cancelado') return false;
      const d = new Date(a.inicio);
      return d >= inicioSemana && d <= fimSemana;
    });

    if (!hasSupabase || !terapeutaId || terapeutaId === "demo") {
      const n = pacientesLista.length;
      setMetricas({
        totalPacientes: n,
        pacientesAtivos: Math.min(n, 2),
        agendamentosHoje: agendHoje.length,
        agendamentosSemana: agendSemana.length,
        pacientesUsandoApp: Math.min(n, 1),
        statusPlanos: { a_iniciar: Math.max(0, n - 2), proposto: Math.min(n, 1), confirmado: Math.min(n, 1) },
        pacientesPorStatus: pacientesLista.map((p, i) => ({ ...p, statusPlano: i === 0 ? 'confirmado' : i === 1 ? 'proposto' : 'a_iniciar' })),
      });
      setCarregando(false);
      return;
    }

    const pIds = pacientesLista.map(p => p.id).filter(id => typeof id === "string");

    Promise.all([
      supabase.from("sessoes").select("paciente_id")
        .eq("terapeuta_id", terapeutaId)
        .gte("created_at", trintaDiasAtras.toISOString()),
      pIds.length > 0
        ? supabase.from("registros_abcd").select("paciente_id").in("paciente_id", pIds).gte("created_at", seteDiasAtras.toISOString())
        : Promise.resolve({ data: [] }),
      supabase.from("planos").select("paciente_id, status, created_at")
        .eq("terapeuta_id", terapeutaId)
        .order("created_at", { ascending: false }),
    ]).then(([{ data: sessoesData }, { data: registrosData }, { data: planosData }]) => {
      const activePIds = new Set((sessoesData || []).map(s => s.paciente_id));
      const pacientesAtivos = pIds.filter(id => activePIds.has(id)).length;

      const appUserPIds = new Set((registrosData || []).map(r => r.paciente_id));
      const pacientesUsandoApp = pIds.filter(id => appUserPIds.has(id)).length;

      const latestPlanoPerPaciente = {};
      (planosData || []).forEach(p => {
        if (!latestPlanoPerPaciente[p.paciente_id]) {
          latestPlanoPerPaciente[p.paciente_id] = p.status || 'proposto';
        }
      });

      const statusCounts = { a_iniciar: 0, proposto: 0, confirmado: 0 };
      const pacientesPorStatus = pacientesLista.map(p => {
        const st = latestPlanoPerPaciente[p.id] || 'a_iniciar';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
        return { ...p, statusPlano: st };
      });

      setMetricas({
        totalPacientes: pacientesLista.length,
        pacientesAtivos,
        agendamentosHoje: agendHoje.length,
        agendamentosSemana: agendSemana.length,
        pacientesUsandoApp,
        statusPlanos: statusCounts,
        pacientesPorStatus,
      });
      setCarregando(false);
    });
  }, [terapeutaId, pacientesLista.length, agendamentos.length]);

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  if (carregando) {
    return (
      <div style={{ padding:"40px 28px", display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
        <div style={{ fontSize:13, color:"#94a3b8" }}>Carregando métricas…</div>
      </div>
    );
  }

  if (!metricas) return null;

  const { totalPacientes, pacientesAtivos, agendamentosHoje, agendamentosSemana, pacientesUsandoApp, statusPlanos, pacientesPorStatus } = metricas;
  const nomeExibido = terapeutaNome ? terapeutaNome.split(" ")[0] : "";
  const pendentes = (statusPlanos.a_iniciar || 0) + (statusPlanos.proposto || 0);

  return (
    <div style={{ padding:"32px 28px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22, fontWeight:800, color:"#2C302E", marginBottom:4 }}>
          {saudacao()}{nomeExibido ? `, ${nomeExibido}` : ""}
        </div>
        <div style={{ fontSize:13, color:"#64748b" }}>
          Aqui está um resumo do seu consultório hoje
        </div>
      </div>

      {/* Cards: Pacientes + Agenda */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16, marginBottom:20 }}>
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Pacientes</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <div style={{ fontSize:32, fontWeight:800, color:"#2C302E", lineHeight:1 }}>{totalPacientes}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>cadastrados</div>
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Ativos (30d)</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <div style={{ fontSize:32, fontWeight:800, color:"#E28743", lineHeight:1 }}>{pacientesAtivos}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>
              {totalPacientes > 0 ? `${Math.round(pacientesAtivos / totalPacientes * 100)}%` : "—"}
            </div>
          </div>
        </div>
        <div style={{ background: agendamentosHoje > 0 ? "#f0f9ff" : "#fff", border:`1px solid ${agendamentosHoje > 0 ? "#bae6fd" : "#f1f5f9"}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color: agendamentosHoje > 0 ? "#0369a1" : "#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Hoje</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <div style={{ fontSize:32, fontWeight:800, color: agendamentosHoje > 0 ? "#0ea5e9" : "#2C302E", lineHeight:1 }}>{agendamentosHoje}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>sessões</div>
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Esta semana</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <div style={{ fontSize:32, fontWeight:800, color:"#2C302E", lineHeight:1 }}>{agendamentosSemana}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>sessões</div>
          </div>
        </div>
      </div>

      {/* Cards: App + Planos */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:16, marginBottom:20 }}>
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>App ativo (7d)</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:6 }}>
            <div style={{ fontSize:32, fontWeight:800, color:"#8b5cf6", lineHeight:1 }}>{pacientesUsandoApp}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>pacientes</div>
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.4 }}>
            {pacientesUsandoApp > 0 ? "Registros recentes no app do paciente" : "Nenhum registro recente no app"}
          </div>
        </div>

        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Status dos planos de sessão</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:800, color:"#94a3b8", lineHeight:1, marginBottom:4 }}>{statusPlanos.a_iniciar || 0}</div>
              <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:2 }}>A iniciar</div>
              <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.4 }}>Plano não gerado</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:800, color:"#f59e0b", lineHeight:1, marginBottom:4 }}>{statusPlanos.proposto || 0}</div>
              <div style={{ fontSize:11, fontWeight:700, color:"#92400e", marginBottom:2 }}>Proposto</div>
              <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.4 }}>Aguardando revisão</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:800, color:"#10b981", lineHeight:1, marginBottom:4 }}>{statusPlanos.confirmado || 0}</div>
              <div style={{ fontSize:11, fontWeight:700, color:"#065f46", marginBottom:2 }}>Confirmado</div>
              <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.4 }}>Revisado e aprovado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de pacientes com plano pendente */}
      {pendentes > 0 && pacientesPorStatus.length > 0 && (
        <div style={{ background:"#fff", border:"1px solid #f1f5f9", borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#2C302E", marginBottom:14 }}>
            Próxima sessão — Pendências de plano
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {pacientesPorStatus.filter(p => p.statusPlano !== 'confirmado').map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"10px 12px", borderRadius:8, background:"#f8fafc" }}>
                <Avatar iniciais={p.iniciais} cor={p.cor} tamanho={32} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#2C302E" }}>{p.nome}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.queixa || "—"}</div>
                </div>
                <div style={{
                  padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, flexShrink:0,
                  ...(p.statusPlano === 'proposto'
                    ? { background:"#fffbeb", color:"#92400e", border:"1px solid #fde68a" }
                    : { background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0" })
                }}>
                  {p.statusPlano === 'proposto' ? 'Aguardando revisão' : 'Plano não gerado'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TELA ORIENTAÇÕES DE USO ──────────────────────────────────────────────────
const ORIENTACOES_BLOCOS = [
  {
    id: "primeiros",
    titulo: "🚀 Primeiros passos",
    itens: [
      { sub: "Configure seu perfil", txt: "Vá em ⚙️ Configurações no menu lateral, selecione o tratamento (Dr. ou Dra.), e preencha seu nome completo, e-mail, telefone e número de registro (CRP). Seu nome e tratamento aparecem no cabeçalho do menu lateral." },
      { sub: "Cadastre seu primeiro paciente", txt: "Na seção Pacientes, clique em '+ Novo paciente'. Preencha nome, e-mail, queixa principal e selecione a linha terapêutica. Os dados podem ser editados a qualquer momento na aba Perfil do paciente." },
      { sub: "Convide o paciente para o app", txt: "Acesse a aba Perfil do paciente → clique em 'Gerar link de convite' → copie e envie por WhatsApp ou e-mail. O paciente clica no link, cria uma senha e já fica vinculado ao seu cadastro." },
    ],
  },
  {
    id: "ciclo",
    titulo: "🔄 Ciclo de uma sessão",
    itens: [
      { sub: "Antes da sessão", txt: "1. Acesse Visão Geral para checar a agenda do dia.\n2. Abra o paciente → Histórico → 📱 Registros do app para ver os registros da semana.\n3. Na aba 📋 Sessões, releia as sessões anteriores.\n4. Revise o plano proposto (aba Próx. Sessão) — edite se necessário e confirme." },
      { sub: "Durante a sessão", txt: "Use a aba Mural para capturar palavras-chave em tempo real enquanto conversa com o paciente. Toque nas palavras para selecioná-las; o botão 'Organizar com IA' agrupa automaticamente por categoria." },
      { sub: "Após a sessão (até 24h depois)", txt: "1. Vá em Importar → cole suas anotações em texto livre.\n2. Clique em 'Processar com IA' — ela extrai emoções, distorções e pontos-chave.\n3. Revise o que foi extraído.\n4. Salve a sessão.\n5. Gere o plano para a próxima sessão → revise → confirme.\n6. Envie a tarefa ao paciente pelo app." },
    ],
  },
  {
    id: "ia",
    titulo: "🤖 Como a IA funciona",
    itens: [
      { sub: "O que ela faz", txt: "A IA lê suas anotações e extrai automaticamente: emoções com intensidade, distorções cognitivas identificadas, pontos-chave da sessão e sugestões de tarefa de casa. Ela também gera um plano estruturado para a próxima sessão com objetivos, técnicas sugeridas e perguntas iniciais." },
      { sub: "O que ela NÃO faz", txt: "A IA não toma decisões clínicas. Ela é um rascunho inteligente — tudo que gerar deve ser revisado por você antes de ser confirmado. O julgamento clínico é sempre seu." },
      { sub: "Aprendizado de estilo", txt: "Cada edição que você faz nos planos gerados ensina o sistema sobre seu estilo. Com o tempo, os rascunhos ficam mais alinhados à sua forma de trabalhar — menos edições, mais fluidez." },
    ],
  },
  {
    id: "mural",
    titulo: "🏷️ Mural de palavras",
    itens: [
      { sub: "Para que serve", txt: "O Mural é um painel de captura rápida durante a sessão. Em vez de anotar em papel, você toca nas palavras clínicas relevantes para o momento — elas ficam registradas e organizadas automaticamente." },
      { sub: "Banco de palavras", txt: "Cada linha terapêutica tem seu próprio banco: TCC tem cognição, comportamento e emoção; Psicanálise tem processo, estrutura e material; Gestalt tem contato e awareness, entre outras. O banco muda automaticamente conforme a linha configurada no perfil do paciente." },
      { sub: "Organizar com IA", txt: "Após selecionar as palavras da sessão, clique em 'Organizar com IA'. O sistema agrupa por categoria e, para TCC, destaca as distorções identificadas em vermelho para fácil visualização." },
    ],
  },
  {
    id: "insights",
    titulo: "📊 Insights e análise longitudinal",
    itens: [
      { sub: "Quando acessar", txt: "Use a aba Insights quinzenalmente ou antes de sessões de balanço. Ela mostra padrões que não são evidentes sessão a sessão." },
      { sub: "Alertas automáticos", txt: "O sistema gera alertas quando detecta: baixa adesão a tarefas (2+ sessões sem realizar), distorção cognitiva em mais de 60% das sessões, ou alertas clínicos em duas sessões consecutivas." },
      { sub: "Exportar relatório", txt: "O botão 'Exportar relatório' na aba Insights gera um resumo consolidado do paciente — útil para supervisão, interconsulta ou encaminhamento." },
    ],
  },
  {
    id: "agenda",
    titulo: "📅 Agenda",
    itens: [
      { sub: "Hoje / Amanhã", txt: "Lista rápida das sessões do dia e do próximo dia com status do plano de cada paciente. Clique no nome do paciente para ir direto ao histórico." },
      { sub: "Semana (Calendário)", txt: "Visualização semanal em grade. Clique em um horário vazio para criar agendamento. Clique em um existente para editar ou cancelar." },
      { sub: "Boas práticas", txt: "Crie agendamentos com antecedência — eles alimentam os indicadores do Painel de Visão Geral. Sessões canceladas devem ser marcadas como canceladas (não apagadas) para manter o histórico correto." },
    ],
  },
];

const TelaOrientacoes = () => {
  const [aberta, setAberta] = useState(null);
  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"32px 40px", boxSizing:"border-box", background:"rgba(241,167,166,0.04)" }}>
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#2C302E", marginBottom:4 }}>
            📋 Orientações de Uso
          </div>
          <div style={{ fontSize:13, color:"#64748b" }}>
            Como usar cada funcionalidade da plataforma — abra a seção que precisar consultar.
          </div>
        </div>

        {/* Fluxo rápido */}
        <div style={{ background:"#FEF3E2", borderRadius:14, padding:"16px 20px", marginBottom:24, border:"1px solid #F0D4B0" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#C47535", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
            Fluxo de trabalho recomendado por sessão
          </div>
          {[
            "Visão Geral → checar agenda e planos pendentes",
            "Histórico do paciente → reler sessões anteriores",
            "Mural (durante a sessão) → capturar palavras-chave",
            "Importar → colar anotações e processar com IA",
            "Próx. Sessão → revisar plano gerado → confirmar",
            "Perfil do paciente → enviar tarefa ao app",
          ].map((passo, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:6 }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:"#E28743", color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                {i + 1}
              </div>
              <span style={{ fontSize:13, color:"#8A4020", lineHeight:1.4 }}>{passo}</span>
            </div>
          ))}
        </div>

        {/* Acordeão */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {ORIENTACOES_BLOCOS.map(bloco => {
            const estaAberto = aberta === bloco.id;
            return (
              <div key={bloco.id} style={{ background:"#fff", borderRadius:12, border:`1.5px solid ${estaAberto ? "#F0D4B0" : "#f1f5f9"}`, overflow:"hidden" }}>
                <button
                  onClick={() => setAberta(estaAberto ? null : bloco.id)}
                  style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                  <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>{bloco.titulo}</span>
                  <span style={{ fontSize:20, color:"#94a3b8", transform: estaAberto ? "rotate(90deg)" : "none", transition:"transform 0.2s", lineHeight:1 }}>›</span>
                </button>
                {estaAberto && (
                  <div style={{ padding:"0 20px 20px" }}>
                    {bloco.itens.map((item, i) => (
                      <div key={i} style={{ marginBottom: i < bloco.itens.length - 1 ? 16 : 0, paddingBottom: i < bloco.itens.length - 1 ? 16 : 0, borderBottom: i < bloco.itens.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#E28743", marginBottom:5 }}>
                          {item.sub}
                        </div>
                        <div style={{ fontSize:13, color:"#475569", lineHeight:1.7, whiteSpace:"pre-line" }}>
                          {item.txt}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div style={{ marginTop:24, padding:"14px 18px", background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0", textAlign:"center" }}>
          <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
            Dúvidas não respondidas aqui? Consulte o arquivo <strong>GUIA_TERAPEUTA.md</strong> no repositório do projeto ou entre em contato com o suporte.
          </div>
        </div>
      </div>
    </div>
  );
};

const TelaConfiguracoes = ({ terapeutaId, terapeutaEmail, perfil, onSalvar }) => {
  const [form, setForm] = useState({
    tratamento:     perfil?.tratamento     ?? "Dr.",
    nome:           perfil?.nome           ?? "",
    telefone:       perfil?.telefone       ?? "",
    crp:            perfil?.crp            ?? "",
    janela_contexto: perfil?.janela_contexto ?? 3,
  });
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setForm({
      tratamento:     perfil?.tratamento     ?? "Dr.",
      nome:           perfil?.nome           ?? "",
      telefone:       perfil?.telefone       ?? "",
      crp:            perfil?.crp            ?? "",
      janela_contexto: perfil?.janela_contexto ?? 3,
    });
  }, [perfil?.nome, perfil?.telefone, perfil?.crp, perfil?.tratamento, perfil?.janela_contexto]);

  const campo = (label, key, placeholder, tipo = "text", readOnly = false) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#94a3b8",
        textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
        {label}
      </label>
      <input
        type={tipo}
        value={readOnly ? (terapeutaEmail ?? "") : form[key]}
        readOnly={readOnly}
        onChange={readOnly ? undefined : e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0",
          borderRadius:8, fontSize:13, color: readOnly ? "#94a3b8" : "#2C302E",
          background: readOnly ? "#f8fafc" : "#fff", outline:"none",
          boxSizing:"border-box" }}
      />
      {readOnly && (
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
          Altere o e-mail em Supabase → Authentication → Users.
        </div>
      )}
    </div>
  );

  const handleSalvar = async () => {
    if (!form.nome.trim()) { setErro("Nome é obrigatório."); return; }
    setSalvando(true); setSucesso(false); setErro("");
    const { error } = await atualizarTerapeuta(terapeutaId, {
      tratamento:      form.tratamento,
      nome:            form.nome.trim(),
      telefone:        form.telefone.trim() || null,
      crp:             form.crp.trim()      || null,
      janela_contexto: form.janela_contexto,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message || "Erro ao salvar. Tente novamente.");
    } else {
      setSucesso(true);
      onSalvar?.({ ...form });
      setTimeout(() => setSucesso(false), 3000);
    }
  };

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"32px 28px" }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#2C302E", marginBottom:4 }}>
            ⚙️ Configurações
          </div>
          <div style={{ fontSize:13, color:"#64748b" }}>
            Dados do seu perfil profissional
          </div>
        </div>

        {/* Card perfil */}
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid #f1f5f9",
          padding:"24px 28px", marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#E28743", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:20 }}>
            Dados pessoais e profissionais
          </div>

          {/* Seletor Dr. / Dra. */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#94a3b8",
              textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>
              Tratamento
            </label>
            <div style={{ display:"flex", gap:8 }}>
              {["Dr.", "Dra."].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tratamento: t }))}
                  type="button"
                  style={{ padding:"8px 22px", border:"1.5px solid",
                    borderColor: form.tratamento === t ? "#E28743" : "#e2e8f0",
                    borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                    background: form.tratamento === t ? "#FEF3E2" : "#fff",
                    color: form.tratamento === t ? "#E28743" : "#64748b",
                    transition:"all 0.15s" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {campo("Nome completo", "nome", "Ex: Ana Paula Silva")}
          {campo("E-mail", null, "", "email", true)}
          {campo("Telefone / WhatsApp", "telefone", "Ex: (11) 9 9999-9999")}
          {campo("CRP / Registro de classe", "crp", "Ex: CRP 06/123456")}

          {/* Janela de contexto da IA */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#94a3b8",
              textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>
              Sessões usadas pela IA no plano
            </label>
            <div style={{ display:"flex", gap:8 }}>
              {[3, 4, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setForm(f => ({ ...f, janela_contexto: n }))}
                  style={{ padding:"6px 18px", borderRadius:8, border:"1.5px solid",
                    borderColor: form.janela_contexto === n ? "#6366f1" : "#e2e8f0",
                    background: form.janela_contexto === n ? "#eef2ff" : "#fff",
                    color: form.janela_contexto === n ? "#6366f1" : "#64748b",
                    fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:"#94a3b8", marginTop:6, marginBottom:0 }}>
              Quantas sessões anteriores a IA analisa para gerar o plano. Mais sessões = análise mais longitudinal.
            </p>
          </div>
        </div>

        {/* Feedback */}
        {erro && (
          <div style={{ padding:"10px 14px", background:"#fff1f2", border:"1px solid #fecdd3",
            borderRadius:8, fontSize:13, color:"#dc2626", marginBottom:16 }}>
            ⚠️ {erro}
          </div>
        )}
        {sucesso && (
          <div style={{ padding:"10px 14px", background:"#f0fdf4", border:"1px solid #bbf7d0",
            borderRadius:8, fontSize:13, color:"#15803d", marginBottom:16 }}>
            ✅ Dados salvos com sucesso!
          </div>
        )}

        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{ padding:"10px 28px", background: salvando ? "#F0C08A" : "#E28743",
            color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700,
            cursor: salvando ? "default" : "pointer" }}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
};

// ─── APP PRINCIPAL ──────────────────────────────────────────────────────────────
// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    icone: null,
    titulo: "Bem-vindo ao Vinculi",
    texto: "Seu copiloto clínico está pronto.",
    subtexto: "Registre sessões, gere planos com IA e acompanhe seus pacientes — tudo em um lugar.",
  },
  {
    icone: "👤",
    titulo: "Adicione seu primeiro paciente",
    texto: "Comece criando um paciente",
    subtexto: "No menu lateral esquerdo, clique em '+ Novo paciente' para cadastrar nome, queixa e linha terapêutica.",
  },
  {
    icone: "📋",
    titulo: "Importe uma sessão",
    texto: "Cole suas anotações e a IA estrutura tudo",
    subtexto: "Selecione um paciente → aba Importar → cole o texto da sessão → clique em 'Gerar rascunho com IA'.",
  },
  {
    icone: "🎯",
    titulo: "Plano gerado em segundos",
    texto: "A IA sugere o plano para a próxima sessão",
    subtexto: "Após importar, vá à aba Próx. sessão → 'Gerar plano com IA'. Revise, edite e confirme antes de usar.",
  },
  {
    icone: "📱",
    titulo: "Convide seu paciente",
    texto: "Conecte o paciente ao app",
    subtexto: "Aba Perfil do paciente → 'Gerar link de convite' → envie por WhatsApp ou e-mail. O paciente registra humor e tarefas entre sessões.",
  },
];

const OnboardingModal = ({ step, onNext, onPrev, onConcluir, onPular }) => {
  const atual = ONBOARDING_STEPS[step - 1];
  const total = ONBOARDING_STEPS.length;
  const isUltimo = step === total;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 36,
        width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
        position: "relative",
        display: "flex", flexDirection: "column", gap: 24,
      }}>
        {/* Pular */}
        <button onClick={onPular} style={{
          position: "absolute", top: 18, right: 20,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "#94a3b8", fontWeight: 600,
          fontFamily: "inherit", padding: "4px 8px",
        }}>
          Pular
        </button>

        {/* Ícone */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          {atual.icone === null ? (
            <VinculiIcon size={64} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "#FDF0EF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
            }}>
              {atual.icone}
            </div>
          )}
        </div>

        {/* Textos */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E28743", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            {atual.titulo}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2C302E", lineHeight: 1.3, marginBottom: 12 }}>
            {atual.texto}
          </div>
          <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            {atual.subtexto}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              width: i + 1 === step ? 20 : 8, height: 8,
              borderRadius: 4,
              background: i + 1 === step ? "#E28743" : "#e2e8f0",
              transition: "width 0.25s, background 0.25s",
            }} />
          ))}
        </div>

        {/* Navegação */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {step > 1 && (
            <button onClick={onPrev} style={{
              padding: "10px 20px", borderRadius: 10,
              border: "1.5px solid #e2e8f0", background: "#fff",
              fontSize: 13, fontWeight: 600, color: "#475569",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Anterior
            </button>
          )}
          <button onClick={isUltimo ? onConcluir : onNext} style={{
            padding: "10px 28px", borderRadius: 10,
            border: "none", background: "#E28743",
            fontSize: 13, fontWeight: 700, color: "#fff",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {isUltimo ? "Concluir ✓" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isCompact = bp === "mobile" || bp === "tablet";
  const [pacientesLista, setPacientesLista] = useState(hasSupabase ? [] : PACIENTES);
  const [humorAlerta, setHumorAlerta] = useState(new Map());
  const [paciente, setPaciente] = useState(hasSupabase ? null : PACIENTES[0]);
  const [aba, setAba] = useState("historico");
  const [abaParaNavegar, setAbaParaNavegar] = useState(null);
  const [menuAberto, setMenuAberto] = useState(true);
  const [mostrarPacientes, setMostrarPacientes] = useState(false);
  const [triggerAbrirPaciente, setTriggerAbrirPaciente] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [sessaoAuth, setSessaoAuth] = useState(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [terapeutaNome, setTerapeutaNome] = useState("");
  const [terapeutaPerfil, setTerapeutaPerfil] = useState(null); // { nome, telefone, crp }
  const [mostrarDashboard, setMostrarDashboard] = useState(true);
  const [mostrarAgenda, setMostrarAgenda] = useState(false);
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [mostrarOrientacoes, setMostrarOrientacoes] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState("visaogeral"); // "visaogeral" | "agenda" | "pacientes" | "configuracoes" | "orientacoes" | null
  const [abaAgenda, setAbaAgenda] = useState("hoje");         // "hoje" | "calendario"
  const [agendamentos, setAgendamentos] = useState([]);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [pacienteParaAgendar, setPacienteParaAgendar] = useState(null);
  const agendRangeRef = useRef({ inicio: null, fim: null }); // rastreia range já carregado
  const [onboardingVisivel, setOnboardingVisivel] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

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
    testarChavesIA();
    const prevUid = { current: null };
    const { data } = onAuthStateChange(async (evento, sessao) => {
      setSessaoAuth(sessao);
      setCarregandoAuth(false);
      // BUG 1: resetar state ao trocar de usuário (evita dados de sessão anterior)
      const novoUid = sessao?.user?.id ?? null;
      if (novoUid !== prevUid.current) {
        prevUid.current = novoUid;
        if (novoUid && novoUid !== "demo") {
          setPacientesLista([]);
          setPaciente(null);
          setAgendamentos([]);
          setHumorAlerta(new Map());
          setTerapeutaNome("");
          setTerapeutaPerfil(null);
          setOnboardingVisivel(false);
          agendRangeRef.current = { inicio: null, fim: null };
        }
      }
      if (sessao?.user?.id && sessao.user.id !== "demo") {
        try {
          // Garante que existe uma linha em terapeutas (caso o trigger não tenha disparado no cadastro)
          if (hasSupabase) {
            await supabase.from("terapeutas").upsert(
              { id: sessao.user.id, email: sessao.user.email },
              { onConflict: "id", ignoreDuplicates: true }
            );
            const { data: perfil } = await supabase
              .from("terapeutas").select("nome, telefone, crp, tratamento, onboarding_concluido, janela_contexto").eq("id", sessao.user.id).maybeSingle();
            if (perfil?.nome) setTerapeutaNome(perfil.nome);
            if (perfil) setTerapeutaPerfil({ nome: perfil.nome ?? "", telefone: perfil.telefone ?? "", crp: perfil.crp ?? "", tratamento: perfil.tratamento ?? "Dr.", janela_contexto: perfil.janela_contexto ?? 3 });
            // BUG 2: nome vazio → configurações antes do onboarding
            if (perfil && !perfil.nome) {
              setMostrarDashboard(false);
              setMostrarConfiguracoes(true);
              setSecaoAtiva("configuracoes");
            } else if (perfil && !perfil.onboarding_concluido) {
              setOnboardingStep(1);
              setOnboardingVisivel(true);
            }
          }
          const { data: lista } = await listarPacientes(sessao.user.id);
          const mapeados = (lista ?? []).map(mapearPaciente);
          setPacientesLista(mapeados);
          if (mapeados.length > 0) {
            setPaciente(mapeados[0]);
            buscarUltimoHumorPorPacientes(mapeados.map(p => p.id))
              .then(mapa => setHumorAlerta(mapa));
          }

          // Carrega agendamentos: 1 mês atrás até 3 meses à frente
          const hoje = new Date();
          const rIni = new Date(hoje); rIni.setMonth(hoje.getMonth() - 1); rIni.setHours(0,0,0,0);
          const rFim = new Date(hoje); rFim.setMonth(hoje.getMonth() + 3); rFim.setHours(23,59,59,999);
          listarAgendamentos(sessao.user.id, rIni.toISOString(), rFim.toISOString())
            .then(({ data }) => {
              if (data) {
                setAgendamentos(data);
                agendRangeRef.current = { inicio: rIni, fim: rFim };
              }
            });
        } catch (err) {
          console.error('[auth] erro crítico no carregamento:', err);
        }
      } else {
        // Modo mock: carrega agendamentos simulados (range amplo)
        const hoje = new Date();
        const rIni = new Date(hoje); rIni.setMonth(hoje.getMonth() - 1); rIni.setHours(0,0,0,0);
        const rFim = new Date(hoje); rFim.setMonth(hoje.getMonth() + 3); rFim.setHours(23,59,59,999);
        listarAgendamentos("demo", rIni.toISOString(), rFim.toISOString())
          .then(({ data }) => {
            if (data) {
              setAgendamentos(data);
              agendRangeRef.current = { inicio: rIni, fim: rFim };
            }
          });
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  // normaliza registro do Supabase para o formato de UI usado em sessoesList
  const mapearSessao = (s) => ({
    id: s.id,
    created_at: s.created_at,
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
    setAba("historico");
    const pid = paciente?.id;
    if (typeof pid !== "string") return; // mock (número) → skip
    listarSessoes(pid).then(({ data, error }) => {
      if (error) { console.error("[sessoes] erro ao carregar:", error); return; }
      if (!data || data.length === 0) return;
      const mapeadas = data.map(mapearSessao);
      setPaciente(prev => prev.id === pid ? { ...prev, sessoesList: mapeadas } : prev);
      // Atualiza também a lista para que clicar no paciente não apague as sessões carregadas
      setPacientesLista(prev => prev.map(pt => pt.id === pid ? { ...pt, sessoesList: mapeadas } : pt));
    });
  }, [paciente?.id]);

  useEffect(() => {
    if (abaParaNavegar && paciente?.id) {
      setAba(abaParaNavegar);
      setAbaParaNavegar(null);
    }
  }, [paciente?.id, abaParaNavegar]);

  useEffect(() => {
    if (pacientesLista.length === 0) return;
    buscarUltimoHumorPorPacientes(pacientesLista.map(p => p.id))
      .then(mapa => setHumorAlerta(mapa));
  }, [pacientesLista.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSessaoSalva = async (novaSessao) => {
    const pid = paciente.id;
    // Atualização local imediata para UX responsiva
    setPaciente(prev => ({
      ...prev,
      sessoes: prev.sessoes + 1,
      sessoesList: [novaSessao, ...(prev.sessoesList || [])],
    }));
    setPacientesLista(prev => prev.map(p => {
      if (p.id !== pid) return p;
      return { ...p, sessoes: (p.sessoes || 0) + 1, sessoesList: [novaSessao, ...(p.sessoesList || [])] };
    }));
    setAba("historico");
    // Recarrega do banco para garantir que a lista está sincronizada
    if (typeof pid === "string") {
      const { data } = await listarSessoes(pid);
      if (data && data.length > 0) {
        const mapeadas = data.map(mapearSessao);
        setPaciente(prev => prev.id === pid ? { ...prev, sessoesList: mapeadas } : prev);
      }
    }
    // Re-fetch humor para atualizar badges (paciente pode ter registrado durante a sessão)
    buscarUltimoHumorPorPacientes(pacientesLista.map(p => p.id))
      .then(mapa => setHumorAlerta(mapa));
  };

  const handleNovoPaciente = (novo) => {
    setPacientesLista(prev => [...prev, novo]);
  };

  const handleAtualizarPaciente = async (atualizado) => {
    setPacientesLista(prev => prev.map(p => p.id === atualizado.id ? atualizado : p));
    setPaciente(atualizado);
    const tid = sessaoAuth?.user?.id;
    if (typeof atualizado.id === "string" && tid && tid !== "demo") {
      const { error } = await atualizarPaciente(atualizado.id, {
        nome: atualizado.nome,
        iniciais: atualizado.iniciais,
        queixa: atualizado.queixa,
        diagnostico: atualizado.diagnostico,
        meta: atualizado.meta,
        linha: atualizado.linha,
        risco: atualizado.risco,
        inicio: atualizado.inicio,
        sessoes_pagas: Number(atualizado.sessoes_pagas) || 0,
        email: atualizado.email || null,
        telefone: atualizado.telefone || null,
        convenio: atualizado.convenio || null,
        idade: atualizado.idade ? Number(atualizado.idade) : null,
      });
      if (error) throw new Error(error.message || "Erro ao salvar no banco");
    }
  };

  const handleExcluirPaciente = async (id) => {
    const tid = sessaoAuth?.user?.id;
    if (typeof id === "string" && tid && tid !== "demo") {
      const { error } = await deletarPaciente(id);
      if (error) throw new Error(error.message || "Erro ao arquivar paciente");
    }
    const restantes = pacientesLista.filter(p => p.id !== id);
    setPacientesLista(restantes);
    if (paciente?.id === id) {
      setPaciente(restantes[0] ?? null);
      setAba("historico");
    }
  };

  const handleRestaurarPaciente = async (id) => {
    const tid = sessaoAuth?.user?.id;
    if (typeof id === "string" && tid && tid !== "demo") {
      const { error } = await restaurarPaciente(id);
      if (error) return { ok: false, message: error.message || "Erro ao restaurar paciente" };
    }
    const { data: lista } = await listarPacientes(sessaoAuth.user.id);
    if (lista) {
      const mapeados = lista.map(mapearPaciente);
      setPacientesLista(mapeados);
      buscarUltimoHumorPorPacientes(mapeados.map(p => p.id))
        .then(mapa => setHumorAlerta(mapa));
    }
    return { ok: true };
  };

  if (carregandoAuth) return <TelaCarregando />;
  if (!sessaoAuth) return <TelaLogin onAuth={setSessaoAuth} />;

  const terapeutaId = sessaoAuth?.user?.id;
  const proxAgend = _proxAgendDe(paciente?.id, agendamentos);
  const proxLabel = _labelAgend(proxAgend);
  const abrirAgendamento = (p) => { setPacienteParaAgendar(p ?? paciente); setModalAgendamentoAberto(true); };

  const handleConcluirOnboarding = async () => {
    setOnboardingVisivel(false);
    if (terapeutaId && terapeutaId !== "demo") {
      await marcarOnboardingConcluido(terapeutaId);
    }
  };

  const carregarSemana = async (inicioSemana, fimSemana) => {
    const { inicio, fim } = agendRangeRef.current;
    // Semana já está dentro do range carregado → nada a fazer
    if (inicio && fim && inicioSemana >= inicio && fimSemana <= fim) return;
    const uid = terapeutaId ?? "demo";
    const { data } = await listarAgendamentos(uid, inicioSemana.toISOString(), fimSemana.toISOString());
    if (data && data.length > 0) {
      setAgendamentos(prev => {
        const ids = new Set(prev.map(a => a.id));
        return [...prev, ...data.filter(a => !ids.has(a.id))];
      });
    }
    // Expande o range registrado (mesmo que não tenha retornado dados — semana vazia é válida)
    agendRangeRef.current = {
      inicio: inicio ? new Date(Math.min(inicio.getTime(), inicioSemana.getTime())) : inicioSemana,
      fim:    fim    ? new Date(Math.max(fim.getTime(),    fimSemana.getTime()))    : fimSemana,
    };
  };

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
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", position:"relative", fontFamily:"'DM Sans', system-ui, sans-serif", background:"#f8fafc", color:"#2C302E", fontSize:14 }}>

        {/* Header topo */}
        <div style={{ background:"#fff", borderBottom:"1px solid #f1f5f9", padding:"0 16px", display:"flex", alignItems:"center", height:52, gap:10, flexShrink:0 }}>
          <button onClick={() => setMenuMobileAberto(true)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:4, fontSize:20, lineHeight:1, color:"#64748b", flexShrink:0 }}>
            ☰
          </button>
          <button onClick={() => setMostrarPacientes(true)}
            style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"6px 10px", cursor:"pointer" }}>
            {paciente ? (
              <>
                <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={24} />
                <span style={{ fontSize:13, fontWeight:700, color:"#2C302E", flex:1, textAlign:"left", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{paciente.nome}</span>
              </>
            ) : (
              <span style={{ fontSize:13, color:"#94a3b8", flex:1, textAlign:"left" }}>Selecione um paciente</span>
            )}
            <span style={{ fontSize:12, color:"#94a3b8" }}>▾</span>
          </button>
          <div onClick={abrirAgendamento}
            style={{ padding:"4px 10px", background: proxLabel.includes("Hoje") ? "#fff1f2" : "#f1f5f9",
              borderRadius:8, fontSize:11, fontWeight:700,
              color: proxLabel.includes("Hoje") ? "#dc2626" : "#475569",
              flexShrink:0, cursor:"pointer" }}>
            {proxLabel.includes("Hoje") ? "🔴 Hoje" : proxLabel}
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {mostrarDashboard ? (
            <TelaDashboard pacientesLista={pacientesLista} agendamentos={agendamentos} terapeutaId={terapeutaId} terapeutaNome={terapeutaNome} />
          ) : mostrarOrientacoes ? (
            <TelaOrientacoes />
          ) : mostrarConfiguracoes ? (
            <TelaConfiguracoes terapeutaId={terapeutaId} terapeutaEmail={sessaoAuth?.user?.email} perfil={terapeutaPerfil} onSalvar={dados => {
              setTerapeutaNome(dados.nome);
              setTerapeutaPerfil(dados);
              if (!terapeutaPerfil?.nome && dados.nome) {
                setMostrarConfiguracoes(false);
                setOnboardingStep(1);
                setOnboardingVisivel(true);
              }
            }} />
          ) : mostrarAgenda ? (
            <TelaCalendario agendamentos={agendamentos} setAgendamentos={setAgendamentos} pacientes={pacientesLista} terapeutaId={terapeutaId} onIrParaCopiloto={p => { setPaciente(p); setAba("historico"); setMostrarAgenda(false); }} onCarregarSemana={carregarSemana} />
          ) : paciente === null ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:32 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>👤</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#475569", marginBottom:8 }}>Nenhum paciente cadastrado</div>
                <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Adicione seu primeiro paciente para começar.</div>
                <button onClick={() => { setMostrarPacientes(true); setTriggerAbrirPaciente(true); }}
                  style={{ padding:"10px 24px", background:"#E28743", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  + Adicionar primeiro paciente
                </button>
              </div>
            </div>
          ) : (
            <>
              {aba === "historico" && <TelaHistorico paciente={paciente} isMobile={isMobile} onAgendar={abrirAgendamento} proximaSessao={proxLabel} />}
              {aba === "mural" && <TelaMural paciente={paciente} />}
              {aba === "plano" && <TelaPlano paciente={paciente} isMobile={isMobile} terapeutaId={terapeutaId} onAgendar={abrirAgendamento} proximaSessao={proxLabel} terapeutaPerfil={terapeutaPerfil} />}
              {aba === "importar" && <TelaImportar paciente={paciente} isMobile={isMobile} terapeutaId={terapeutaId} onSessaoSalva={handleSessaoSalva} agendamentos={agendamentos} onAgendamentoRealizado={id => setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status:"realizado" } : a))} />}
              {aba === "insights" && <TelaInsights paciente={paciente} analise={analisarPadroes(paciente.sessoesList)} />}
              {aba === "perfil" && <TelaPerfil paciente={paciente} isMobile={isMobile} terapeutaId={terapeutaId} terapeutaNome={terapeutaNome} terapeutaEmail={sessaoAuth?.user?.email} onAtualizar={handleAtualizarPaciente} onExcluir={handleExcluirPaciente} />}
            </>
          )}
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
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, border:"none", background:"transparent", cursor:"pointer", borderTop: aba === a.id ? "2px solid #E28743" : "2px solid transparent" }}>
              <span style={{ fontSize:20 }}>{a.icon}</span>
              <span style={{ fontSize:10, fontWeight: aba === a.id ? 700 : 500, color: aba === a.id ? "#E28743" : "#94a3b8" }}>{a.label}</span>
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
                  onAbrirAgendamento={p => { setPacienteParaAgendar(p); setModalAgendamentoAberto(true); }}
                  onRestaurar={handleRestaurarPaciente}
                  humorAlerta={humorAlerta}
                  abrirModal={triggerAbrirPaciente}
                  onAbrirModalConsumed={() => setTriggerAbrirPaciente(false)}
                  onIrParaImportar={p => { setAbaParaNavegar("importar"); setPaciente(p); setMostrarDashboard(false); setMostrarConfiguracoes(false); setMostrarOrientacoes(false); setMostrarAgenda(false); setMostrarPacientes(false); }}
                />
              </div>
            </div>
          </>
        )}

        {/* Drawer de navegação principal (mobile) */}
        {menuMobileAberto && (
          <>
            <div onClick={() => setMenuMobileAberto(false)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:40 }} />
            <div style={{ position:"fixed", top:0, left:0, bottom:0, width:280, background:"#fff", zIndex:50, display:"flex", flexDirection:"column", boxShadow:"4px 0 24px rgba(0,0,0,0.12)" }}>
              {/* Header do drawer */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", height:56, borderBottom:"1px solid #f1f5f9" }}>
                <VinculiAssinatura size="sm" />
                <button onClick={() => setMenuMobileAberto(false)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#94a3b8", lineHeight:1, padding:4 }}>
                  ✕
                </button>
              </div>
              {/* Itens de navegação */}
              <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
                {[
                  { icon:"🏠", label:"Visão Geral", action:() => { setMostrarDashboard(true); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMostrarOrientacoes(false); setMenuMobileAberto(false); } },
                  { icon:"📅", label:"Agenda", action:() => { setMostrarAgenda(true); setMostrarDashboard(false); setMostrarConfiguracoes(false); setMostrarOrientacoes(false); setMenuMobileAberto(false); } },
                  { icon:"📖", label:"Orientações de Uso", action:() => { setMostrarOrientacoes(true); setMostrarDashboard(false); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMenuMobileAberto(false); } },
                  { icon:"⚙️", label:"Configurações", action:() => { setMostrarConfiguracoes(true); setMostrarDashboard(false); setMostrarAgenda(false); setMostrarOrientacoes(false); setMenuMobileAberto(false); } },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:20 }}>{item.icon}</span>
                    <span style={{ fontSize:14, fontWeight:600, color:"#2C302E" }}>{item.label}</span>
                  </button>
                ))}
                <div style={{ margin:"8px 20px", borderTop:"1px solid #f1f5f9" }} />
                <div style={{ padding:"8px 20px 4px", fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  Paciente ativo
                </div>
                <button onClick={() => { setMostrarPacientes(true); setMenuMobileAberto(false); }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 20px", background:"none", border:"none", cursor:"pointer" }}>
                  <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={32} />
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C302E" }}>{paciente.nome}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>Trocar paciente</div>
                  </div>
                </button>
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
      background:"#f8fafc", color:"#2C302E", fontSize:14, overflow:"hidden" }}>

      {/* Sidebar esquerda — lista de pacientes */}
      <div style={{ width: menuAberto ? 280 : 56, flexShrink:0, background:"#fff",
        borderRight:"1px solid #f1f5f9", display:"flex", flexDirection:"column",
        height:"100vh", overflow:"hidden", transition:"width 0.25s ease" }}>

        {/* Logo + hamburguer */}
        <div style={{ borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
          {/* Linha da logo + hamburguer */}
          <div style={{ padding: menuAberto ? "0 14px 0 16px" : "0 6px",
            display:"flex", alignItems:"center", height:68,
            justifyContent: menuAberto ? "space-between" : "center", gap:8 }}>
            {menuAberto ? (
              <VinculiAssinatura size="sm" />
            ) : (
              <VinculiIcon size={28} />
            )}
            <button onClick={() => setMenuAberto(v => !v)}
              style={{ background:"none", border:"none", cursor:"pointer", padding:5,
                color:"#94a3b8", fontSize:18, lineHeight:1, flexShrink:0,
                borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
                transition:"color 0.15s" }}>
              ☰
            </button>
          </div>
          {/* Linha do profissional — visível só quando expandido */}
          {menuAberto && (
            <div style={{ padding:"0 16px 10px", display:"flex", alignItems:"center",
              justifyContent:"space-between", gap:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#2C302E",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {terapeutaNome
                  ? `${terapeutaPerfil?.tratamento || "Dr."} ${terapeutaNome.split(" ")[0]}`
                  : (sessaoAuth?.user?.email ?? "Terapeuta")}
              </div>
              <button onClick={() => signOut()}
                title="Sair da conta"
                style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
                  background:"none", border:"1px solid #e2e8f0", cursor:"pointer",
                  padding:"3px 10px", borderRadius:6, whiteSpace:"nowrap",
                  flexShrink:0, transition:"all 0.15s" }}>
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Acordeão de seções — visível quando expandido */}
        {menuAberto ? (
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

            {/* ── VISÃO GERAL ── */}
            <div
              onClick={() => { setSecaoAtiva("visaogeral"); setMostrarDashboard(true); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMostrarOrientacoes(false); }}
              style={{ display:"flex", alignItems:"center", gap:8,
                padding:"10px 16px", cursor:"pointer", userSelect:"none",
                background: mostrarDashboard ? "#FEF3E2" : "transparent",
                borderBottom:"1px solid #f1f5f9" }}>
              <span>🏠</span>
              <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.06em",
                color: mostrarDashboard ? "#E28743" : "#64748b" }}>Visão geral</span>
            </div>

            {/* ── SEÇÃO AGENDA ── */}
            <div>
              <div
                onClick={() => { setSecaoAtiva(s => s === "agenda" ? null : "agenda"); setMostrarAgenda(true); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 16px", cursor:"pointer", userSelect:"none",
                  background: secaoAtiva === "agenda" ? "#FEF3E2" : "transparent",
                  borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span>📅</span>
                  <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.06em",
                    color: secaoAtiva === "agenda" ? "#E28743" : "#64748b" }}>Agenda</span>
                </div>
                <span style={{ fontSize:10, color:"#cbd5e1", display:"inline-block",
                  transform: secaoAtiva === "agenda" ? "rotate(180deg)" : "rotate(0deg)",
                  transition:"transform 0.2s ease" }}>▾</span>
              </div>

              {secaoAtiva === "agenda" && (
                <div style={{ background:"#fafafa" }}>
                  {/* Sub-item: Hoje / Amanhã */}
                  <div
                    onClick={() => { setAbaAgenda("hoje"); setMostrarAgenda(true); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); }}
                    style={{ display:"flex", alignItems:"center", gap:8,
                      padding:"7px 16px 7px 28px", cursor:"pointer",
                      background: abaAgenda === "hoje" ? "#FEF3E2" : "transparent",
                      borderLeft: abaAgenda === "hoje" ? "3px solid #E28743" : "3px solid transparent",
                      borderBottom:"1px solid #f1f5f9", transition:"all 0.1s" }}>
                    <span style={{ fontSize:12 }}>🗓️</span>
                    <span style={{ fontSize:12, fontWeight: abaAgenda === "hoje" ? 700 : 500,
                      color: abaAgenda === "hoje" ? "#E28743" : "#64748b" }}>
                      Hoje / Amanhã
                    </span>
                  </div>

                  {/* Lista de agendamentos de hoje/amanhã */}
                  {abaAgenda === "hoje" && (
                    <AgendaHojeList
                      agendamentos={agendamentos}
                      pacientes={pacientesLista}
                      onSelect={p => { setPaciente(p); setAba("historico"); setMostrarAgenda(false); }}
                      onNovoAgendamento={abrirAgendamento}
                    />
                  )}

                  {/* Sub-item: Calendário */}
                  <div
                    onClick={() => { setAbaAgenda("calendario"); setMostrarAgenda(true); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); }}
                    style={{ display:"flex", alignItems:"center", gap:8,
                      padding:"7px 16px 7px 28px", cursor:"pointer",
                      background: abaAgenda === "calendario" ? "#FEF3E2" : "transparent",
                      borderLeft: abaAgenda === "calendario" ? "3px solid #E28743" : "3px solid transparent",
                      borderTop:"1px solid #f1f5f9", transition:"all 0.1s" }}>
                    <span style={{ fontSize:12 }}>📆</span>
                    <span style={{ fontSize:12, fontWeight: abaAgenda === "calendario" ? 700 : 500,
                      color: abaAgenda === "calendario" ? "#E28743" : "#64748b" }}>
                      Calendário
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── SEÇÃO PACIENTES ── */}
            <div>
              <div
                onClick={() => { setSecaoAtiva(s => s === "pacientes" ? null : "pacientes"); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 16px", cursor:"pointer", userSelect:"none",
                  background: secaoAtiva === "pacientes" ? "#FEF3E2" : "transparent",
                  borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span>👤</span>
                  <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.06em",
                    color: secaoAtiva === "pacientes" ? "#E28743" : "#64748b" }}>Pacientes</span>
                </div>
                <span style={{ fontSize:10, color:"#cbd5e1", display:"inline-block",
                  transform: secaoAtiva === "pacientes" ? "rotate(180deg)" : "rotate(0deg)",
                  transition:"transform 0.2s ease" }}>▾</span>
              </div>

              {secaoAtiva === "pacientes" && (
                <TelaPacientes
                  modo="pacientes"
                  pacientes={pacientesLista}
                  onSelect={p => { setPaciente(p); setAba("historico"); setAbaAgenda("hoje"); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); }}
                  pacienteSelecionado={paciente}
                  onNovoPaciente={handleNovoPaciente}
                  terapeutaId={terapeutaId}
                  menuAberto={true}
                  onAbrirAgendamento={p => { setPacienteParaAgendar(p); setModalAgendamentoAberto(true); }}
                  onRestaurar={handleRestaurarPaciente}
                  humorAlerta={humorAlerta}
                  abrirModal={triggerAbrirPaciente}
                  onAbrirModalConsumed={() => setTriggerAbrirPaciente(false)}
                  onIrParaImportar={p => { setAbaParaNavegar("importar"); setPaciente(p); setMostrarDashboard(false); setMostrarConfiguracoes(false); setMostrarOrientacoes(false); setMostrarAgenda(false); setAbaAgenda("hoje"); }}
                />
              )}
            </div>

            {/* ── ORIENTAÇÕES DE USO ── */}
            <div
              onClick={() => { setSecaoAtiva("orientacoes"); setMostrarOrientacoes(true); setMostrarDashboard(false); setMostrarAgenda(false); setMostrarConfiguracoes(false); }}
              style={{ display:"flex", alignItems:"center", gap:8,
                padding:"10px 16px", cursor:"pointer", userSelect:"none",
                background: mostrarOrientacoes ? "#FEF3E2" : "transparent",
                borderTop:"1px solid #f1f5f9" }}>
              <span>📋</span>
              <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.06em",
                color: mostrarOrientacoes ? "#E28743" : "#64748b" }}>Orientações de Uso</span>
            </div>

            {/* ── SEÇÃO CONFIGURAÇÕES ── */}
            <div style={{ marginTop:"auto", borderTop:"1px solid #f1f5f9" }}>
              <div
                onClick={() => {
                  const proximo = secaoAtiva !== "configuracoes";
                  setSecaoAtiva(proximo ? "configuracoes" : null);
                  setMostrarConfiguracoes(proximo);
                  setMostrarOrientacoes(false);
                  setMostrarDashboard(false);
                  setMostrarAgenda(false);
                }}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 16px", cursor:"pointer", userSelect:"none",
                  background: secaoAtiva === "configuracoes" ? "#FEF3E2" : "transparent" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span>⚙️</span>
                  <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.06em",
                    color: secaoAtiva === "configuracoes" ? "#E28743" : "#64748b" }}>
                    Configurações
                  </span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Menu colapsado — apenas avatares */
          <div style={{ flex:1, overflow:"hidden" }}>
            <TelaPacientes
              pacientes={pacientesLista}
              onSelect={p => { setPaciente(p); setAba("historico"); }}
              pacienteSelecionado={paciente}
              onNovoPaciente={handleNovoPaciente}
              terapeutaId={terapeutaId}
              menuAberto={false}
              onRestaurar={handleRestaurarPaciente}
              humorAlerta={humorAlerta}
            />
          </div>
        )}
      </div>

      {/* Área principal */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Barra de navegação superior */}
        <div style={{ background:"#fff", borderBottom:"1px solid #f1f5f9",
          padding:"0 28px", display:"flex", alignItems:"center",
          height:56, flexShrink:0, gap:4 }}>

          {mostrarDashboard ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🏠</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>Visão geral</span>
            </div>
          ) : mostrarOrientacoes ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>📋</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>Orientações de Uso</span>
            </div>
          ) : mostrarConfiguracoes ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>⚙️</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>Configurações</span>
            </div>
          ) : mostrarAgenda && abaAgenda === "calendario" ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>📆</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>Agenda: Semana</span>
            </div>
          ) : mostrarAgenda ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>📅</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>Agenda: Hoje / Amanhã</span>
            </div>
          ) : paciente === null ? null : (
            <>
              {/* Breadcrumb */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:24 }}>
                <Avatar iniciais={paciente.iniciais} cor={paciente.cor} tamanho={28} />
                <span style={{ fontSize:14, fontWeight:700, color:"#2C302E" }}>{paciente.nome}</span>
                <span style={{ fontSize:12, color:"#cbd5e1" }}>·</span>
                <span style={{ fontSize:12, color:"#94a3b8" }}>Sessão {paciente.sessoes}</span>
              </div>

              {/* Abas */}
              {abas.map(a => (
                <button key={a.id} onClick={() => setAba(a.id)}
                  style={{ padding:"6px 16px", border:"none", borderRadius:8, cursor:"pointer",
                    background: aba === a.id ? "#FEF3E2" : "transparent",
                    color: aba === a.id ? "#E28743" : "#64748b",
                    fontWeight: aba === a.id ? 700 : 500, fontSize:13,
                    transition:"all 0.15s" }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </>
          )}

          {/* Próxima sessão + botão agendar — ocultos nas telas de configurações, dashboard e agenda */}
          {!mostrarConfiguracoes && !mostrarDashboard && !mostrarAgenda && paciente !== null && (
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ padding:"5px 12px",
                background: proxLabel.includes("Hoje") ? "#fff1f2" : "#f1f5f9",
                borderRadius:8, fontSize:12, fontWeight:700,
                color: proxLabel.includes("Hoje") ? "#dc2626" : "#475569" }}>
                {proxLabel.includes("Hoje") ? "🔴 " : "📅 "}
                {proxLabel}
              </div>
              <button onClick={() => { setPacienteParaAgendar(null); setModalAgendamentoAberto(true); }}
                style={{ padding:"5px 12px", background:"#E28743", color:"#fff",
                  border:"none", borderRadius:8, fontSize:12, fontWeight:700,
                  cursor:"pointer", whiteSpace:"nowrap" }}>
                + Agendar
              </button>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ flex:1, overflow:"hidden" }}>
          {mostrarDashboard ? (
            <TelaDashboard
              pacientesLista={pacientesLista}
              agendamentos={agendamentos}
              terapeutaId={terapeutaId}
              terapeutaNome={terapeutaNome}
            />
          ) : mostrarOrientacoes ? (
            <TelaOrientacoes />
          ) : mostrarConfiguracoes ? (
            <TelaConfiguracoes
              terapeutaId={terapeutaId}
              terapeutaEmail={sessaoAuth?.user?.email}
              perfil={terapeutaPerfil}
              onSalvar={dados => {
                setTerapeutaNome(dados.nome);
                setTerapeutaPerfil(dados);
                if (!terapeutaPerfil?.nome && dados.nome) {
                  setMostrarConfiguracoes(false);
                  setOnboardingStep(1);
                  setOnboardingVisivel(true);
                }
              }}
            />
          ) : abaAgenda === "calendario" ? (
            <TelaCalendario
              agendamentos={agendamentos}
              setAgendamentos={setAgendamentos}
              pacientes={pacientesLista}
              terapeutaId={terapeutaId}
              onIrParaCopiloto={p => { setPaciente(p); setAba("historico"); setAbaAgenda("hoje"); }}
              onCarregarSemana={carregarSemana}
            />
          ) : paciente === null ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:32 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>👤</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#475569", marginBottom:8 }}>Nenhum paciente cadastrado</div>
                <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Adicione seu primeiro paciente para começar.</div>
                <button onClick={() => { setSecaoAtiva("pacientes"); setMostrarAgenda(false); setMostrarConfiguracoes(false); setMostrarDashboard(false); setMostrarOrientacoes(false); setTriggerAbrirPaciente(true); }}
                  style={{ padding:"10px 24px", background:"#E28743", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  + Adicionar primeiro paciente
                </button>
              </div>
            </div>
          ) : (
            <>
              {aba === "historico" && <TelaHistorico paciente={paciente} onAgendar={abrirAgendamento} proximaSessao={proxLabel} />}
              {aba === "mural" && <TelaMural paciente={paciente} />}
              {aba === "plano" && <TelaPlano key={paciente.id} paciente={paciente} terapeutaId={terapeutaId} onAgendar={abrirAgendamento} proximaSessao={proxLabel} terapeutaPerfil={terapeutaPerfil} />}
              {aba === "importar" && <TelaImportar paciente={paciente} terapeutaId={terapeutaId} onSessaoSalva={handleSessaoSalva} agendamentos={agendamentos} onAgendamentoRealizado={id => setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status:"realizado" } : a))} />}
              {aba === "insights" && <TelaInsights paciente={paciente} analise={analisarPadroes(paciente.sessoesList)} />}
              {aba === "perfil" && <TelaPerfil paciente={paciente} terapeutaId={terapeutaId} terapeutaNome={terapeutaNome} terapeutaEmail={sessaoAuth?.user?.email} onAtualizar={handleAtualizarPaciente} onExcluir={handleExcluirPaciente} />}
            </>
          )}
        </div>
      </div>

      {/* Modal de agendamento (nível global) */}
      {modalAgendamentoAberto && (
        <ModalAgendamento
          paciente={pacienteParaAgendar}
          pacientes={pacientesLista}
          terapeutaId={terapeutaId}
          onSalvar={novos => {
            const lista = Array.isArray(novos) ? novos : [novos];
            setAgendamentos(prev => [...prev, ...lista]);
            setModalAgendamentoAberto(false);
            setPacienteParaAgendar(null);
          }}
          onFechar={() => {
            setModalAgendamentoAberto(false);
            setPacienteParaAgendar(null);
          }}
        />
      )}

      {onboardingVisivel && (
        <OnboardingModal
          step={onboardingStep}
          onNext={() => setOnboardingStep(s => s + 1)}
          onPrev={() => setOnboardingStep(s => s - 1)}
          onConcluir={handleConcluirOnboarding}
          onPular={handleConcluirOnboarding}
        />
      )}

      {/* Carrega fonte */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    </div>
  );
}
