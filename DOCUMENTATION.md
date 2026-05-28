# Copiloto Terapeuta — Documentação Técnica Completa

> **Versão:** 2.0  
> **Data de referência:** 2026-05-27  
> **Status:** Em produção (Release 2.0 estável — Beta ativo)  
> **Repositório:** `app_-_Psic-TCC`  
> **URL de produção:** https://copiloto-vite.vercel.app

---

## Índice Geral

1. [Visão Geral da Solução](#1-visão-geral-da-solução)
2. [Arquitetura da Solução](#2-arquitetura-da-solução)
3. [ADRs — Architecture Decision Records](#3-adrs--architecture-decision-records)
4. [Design Doc Completo](#4-design-doc-completo)
5. [Documentação de APIs e Serviços](#5-documentação-de-apis-e-serviços)
6. [Documentação de Banco de Dados](#6-documentação-de-banco-de-dados)
7. [Documentação de Segurança](#7-documentação-de-segurança)
8. [Documentação de DevOps / CI/CD](#8-documentação-de-devops--cicd)
9. [Runbooks Operacionais](#9-runbooks-operacionais)
10. [Playbooks de Engenharia](#10-playbooks-de-engenharia)
11. [Manual do Usuário Final](#11-manual-do-usuário-final)
12. [Guia de Treinamento para o Cliente](#12-guia-de-treinamento-para-o-cliente)
13. [Matriz RACI](#13-matriz-raci)
14. [Glossário Técnico](#14-glossário-técnico)
15. [Roadmap e Backlog Inicial](#15-roadmap-e-backlog-inicial)

---

# 1. Visão Geral da Solução

## 1.1 Objetivo do Sistema

O **Copiloto Terapeuta** é uma plataforma web de suporte clínico para psicólogos e terapeutas. Seu objetivo central é **ampliar a capacidade clínica do profissional** através de três pilares:

1. **Registro estruturado de sessões** — transformar anotações brutas em dados clínicos estruturados usando inteligência artificial.
2. **Planejamento assistido por IA** — gerar planos para a próxima sessão com base no histórico clínico do paciente, adaptados à abordagem terapêutica escolhida.
3. **Acompanhamento longitudinal** — monitorar a evolução do paciente ao longo do tempo, identificar padrões e apoiar decisões clínicas com dados.

O produto é composto por dois aplicativos integrados:
- **App do Terapeuta** (`copiloto-vite`): ferramenta web desktop-first para o profissional.
- **App do Paciente** (`copiloto-paciente`): PWA mobile-first para o paciente registrar tarefas, humor e pensamentos entre sessões.

## 1.2 Problema que Resolve

Psicólogos enfrentam dificuldades recorrentes que reduzem a qualidade e eficiência do atendimento:

| Problema | Impacto |
|---|---|
| Tempo excessivo em notas clínicas e relatórios | Menos energia disponível para a intervenção em si |
| Dificuldade de lembrar detalhes de sessões passadas | Continuidade prejudicada, especialmente em semanas cheias |
| Ausência de dados estruturados sobre evolução do paciente | Decisões baseadas em impressões em vez de padrões |
| Desconexão entre sessões | Paciente sem ferramentas para praticar entre as consultas |
| Falta de visão gerencial do consultório | Dificuldade de priorizar tempo e identificar casos críticos |

O Copiloto Terapeuta resolve esses problemas ao atuar como um **assistente clínico invisível** — presente antes, durante e após a sessão.

## 1.3 Público-Alvo

### Usuário Primário: Terapeuta / Psicólogo
- Profissional de saúde mental registrado (CRP no Brasil)
- Atende de 5 a 40 pacientes por semana
- Usa computador/notebook no consultório ou home office
- Familiarizado com tecnologia, mas não é desenvolvedor
- Abordagens suportadas: TCC, Psicanálise, Gestalt, Junguiana, Humanista/ACP, Análise do Comportamento

### Usuário Secundário: Paciente
- Qualquer paciente do terapeuta com smartphone
- Acesso somente pelo convite do terapeuta
- Interage via app móvel (PWA) para tarefas e registro de humor

### Usuários Excluídos do Escopo Atual
- Clínicas e equipes multiprofissionais (multi-tenant não implementado)
- Psiquiatras (prescrição de medicamentos fora do escopo)
- Supervisores clínicos (acesso externo a dados não suportado)

## 1.4 Escopo Funcional

### Incluído no MVP

| Módulo | Funcionalidades |
|---|---|
| **Autenticação** | Cadastro, login, logout com e-mail e senha |
| **Gestão de Pacientes** | CRUD completo, perfil clínico, linha terapêutica, nível de risco |
| **Histórico de Sessões** | Visualização estruturada, timeline, detalhes por sessão |
| **Importação de Sessões** | Upload de texto/paste, extração por IA, revisão e salvamento |
| **Plano de Sessão** | Geração por IA, edição, confirmação, envio de tarefa |
| **Mural de Palavras** | Banco de termos por abordagem, agrupamento por categoria |
| **Insights Clínicos** | Análise de padrões, alertas automáticos, métricas |
| **Agenda** | Calendário semanal, agendamentos, recorrência |
| **App do Paciente** | Tarefas, registro ABCD, humor diário, conquistas |
| **Dashboard** | Visão geral do consultório, status de planos, métricas |
| **Configurações** | Perfil do terapeuta (nome, telefone, CRP, tratamento Dr./Dra.) |
| **Convites** | Geração de link de acesso para paciente |

### Não Incluído no MVP

- Faturamento e cobrança
- Prontuário eletrônico completo (CFP-compliant)
- Videoconferência integrada
- Multi-terapeuta / clínica
- Assinatura digital de documentos
- Exportação de relatório clínico completo em PDF (apenas plano de sessão disponível — US-16 planejado para v2.1)
- Integração com planos de saúde

## 1.5 Escopo Não Funcional

| Atributo | Meta |
|---|---|
| **Disponibilidade** | 99,5% (herdado do Supabase + Vercel) |
| **Latência** | < 2s para carregamento inicial; < 500ms para operações CRUD |
| **Segurança** | Dados isolados por terapeuta via RLS (Row Level Security) |
| **Privacidade** | Dados de pacientes nunca expostos entre terapeutas |
| **Acessibilidade** | Funcional em Chrome, Firefox, Edge modernos |
| **Responsividade** | Desktop-first; mobile suportado com layout adaptativo |
| **Escalabilidade** | Arquitetura stateless — escala horizontalmente no Vercel |
| **Manutenibilidade** | Single-file architecture (SPA), sem framework de estado externo |

---

# 2. Arquitetura da Solução

## 2.1 Diagrama Lógico

```
┌─────────────────────────────────────────────────────────────┐
│                      USUÁRIOS                                │
│                                                             │
│  [Terapeuta — Desktop/Notebook]    [Paciente — Smartphone] │
└──────────────┬──────────────────────────────┬──────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   APP DO TERAPEUTA       │    │   APP DO PACIENTE         │
│   copiloto-vite          │    │   copiloto-paciente        │
│   React + Vite (SPA)     │    │   React PWA               │
│   Vercel (CDN Global)    │    │   Vercel (CDN Global)     │
└──────────────┬───────────┘    └──────────────┬────────────┘
               │                               │
               │         SUPABASE              │
               ▼               ▼               ▼
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE (BaaS)                         │
│                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Auth Service  │  │  PostgreSQL  │  │  RLS Engine  │ │
│  │  (JWT tokens)  │  │  (14+ PG)    │  │  (policies)  │ │
│  └────────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────┘
               │
               │ (chamadas HTTP diretas do browser)
               ▼
┌──────────────────────────┐
│   GOOGLE AI STUDIO       │
│   Gemini API             │
│   (geração de planos,    │
│    extração de sessões)  │
└──────────────────────────┘
```

## 2.2 Diagrama Físico

```
┌─────────────────────────────────────────────────────────────────┐
│ VERCEL (Edge Network Global)                                     │
│                                                                  │
│  Project: copiloto-vite                  Project: copiloto-pct  │
│  ┌──────────────────────────┐            ┌──────────────────┐   │
│  │  dist/                   │            │  dist/ (PWA)     │   │
│  │  ├── index.html          │            │  ├── index.html  │   │
│  │  └── assets/             │            │  ├── sw.js       │   │
│  │      └── index-[hash].js │            │  └── assets/     │   │
│  │  (SPA, 834KB gzip 201KB) │            └──────────────────┘   │
│  └──────────────────────────┘                                   │
│  Domínio: copiloto-vite.vercel.app                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ SUPABASE (us-east-1 / São Paulo disponível)                      │
│                                                                  │
│  Endpoint:  https://[project-ref].supabase.co                   │
│  Auth:      /auth/v1/...                                         │
│  REST API:  /rest/v1/[table]                                     │
│                                                                  │
│  PostgreSQL 15                                                   │
│  ├── schema: public                                              │
│  │   ├── terapeutas          (1 row / terapeuta)                │
│  │   ├── pacientes           (~5-50 / terapeuta)                │
│  │   ├── sessoes             (~100-2000 / terapeuta)            │
│  │   ├── planos              (~50-500 / terapeuta)              │
│  │   ├── analises_longitudinais (~1 / paciente ativo)           │
│  │   ├── agendamentos        (~100-500 / terapeuta)             │
│  │   ├── convites            (1 / paciente ativo)               │
│  │   ├── tarefas             (~1-5 abertas / paciente)          │
│  │   ├── registros_abcd      (~variável por uso do app)         │
│  │   ├── humor_diario        (~variável)                        │
│  │   └── conquistas          (~variável)                        │
│  └── schema: auth (gerenciado pelo Supabase)                    │
└──────────────────────────────────────────────────────────────────┘
                       │ HTTPS (browser → API diretamente)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ API PROXY (Vercel Serverless — api/gemini.js)                     │
│  Rota: POST /api/gemini                                           │
│  Roteia para: Google AI (Gemini) ou Anthropic (Claude)           │
│  Chaves: GEMINI_API_KEY + ANTHROPIC_API_KEY (server-side)        │
├──────────────────────────────────────────────────────────────────┤
│ GOOGLE AI STUDIO                                                  │
│  Endpoint: https://generativelanguage.googleapis.com/v1beta/...  │
│  Modelo: gemini-2.5-flash (primário)                             │
│  Fallback: Claude Sonnet 4.6 via Anthropic API                   │
└──────────────────────────────────────────────────────────────────┘
```

## 2.3 Fluxos Principais

### Fluxo 1: Cadastro e Login

```
Browser → POST /auth/v1/signup → Supabase Auth cria user em auth.users
       → Trigger on_auth_user_created → INSERT em public.terapeutas
       → Resposta: JWT access_token + refresh_token armazenados no browser
       
Browser → POST /auth/v1/token?grant_type=password → JWT retornado
       → onAuthStateChange() dispara no frontend
       → Frontend carrega lista de pacientes via listarPacientes()
```

### Fluxo 2: Geração de Plano de Sessão

```
Terapeuta clica "Gerar plano" no TelaPlano
  → gerarPlanoSessao(paciente, sessoesInput, janelaContexto) em services/ia.js
    sessoesInput: array de sessões mais recentes (mais recente primeiro)
    janelaContexto: 1|3|4|5 (configurado em TelaConfiguracoes, salvo em terapeutas.janela_contexto)
  → POST /api/gemini (proxy serverless)
    Body: prompt com histórico das N sessões + padrões identificados + linha terapêutica
    Fallback automático para Claude se Gemini falhar
  → Resposta JSON: { objetivo, fluxoSocratico[3 eixos], tecnicas, tarefa, obs, contextoUtilizado }
  → normalizeAIPlano() → setPlanoCurrent()
  → salvarPlano(terapeutaId, pacienteId, campos) → POST /rest/v1/planos
    (status padrão: 'proposto')
  
Terapeuta revisa e edita
  → atualizarPlano(planoId, campos) → PATCH /rest/v1/planos?id=eq.{id}
  
Terapeuta clica "Confirmar plano"
  → atualizarPlano(planoId, { status: 'confirmado' }) → PATCH /rest/v1/planos
  → Dashboard reflete novo status

Terapeuta clica "⬇ PDF"
  → exportarPlanoPDF(plano, paciente, terapeutaPerfil) em utils/exportarPlanoPDF.js
  → Gera div oculto, converte via html2canvas + jsPDF → download Plano_{Nome}_{Data}.pdf
```

### Fluxo 3: Envio de Tarefa ao Paciente

```
Terapeuta clica "Enviar tarefa" em TelaPlano
  → criarTarefa({ paciente_id, terapeuta_id, descricao, tipo_formulario: 'abcd' })
  → POST /rest/v1/tarefas
  → Paciente abre o App → buscarTarefaAtiva(pacienteId)
  → GET /rest/v1/tarefas?paciente_id=eq.{id}&status=neq.concluido
  → Paciente preenche registro ABCD
  → criarRegistroABCD({ ...campos }) → POST /rest/v1/registros_abcd
  → Terapeuta visualiza em TelaHistorico → seção "Registros do app"
```

### Fluxo 4: Convite para App do Paciente

```
Terapeuta em TelaPerfil → clica "Gerar convite"
  → criarConvite(pacienteId, terapeutaId, emailPaciente)
  → POST /rest/v1/convites (token UUID gerado automaticamente)
  → Link copiado: https://copiloto-paciente.vercel.app/?token={uuid}
  
Paciente abre o link
  → buscarConvitePorToken(token) → GET /rest/v1/convites?token=eq.{uuid}
  → Paciente faz cadastro com email
  → atualizarConvite(id, { status: 'usado', paciente_auth_id: auth.uid() })
  → Função get_paciente_id() resolve UUID do paciente via convite
  → Paciente tem acesso APENAS aos próprios dados (RLS)
```

### Fluxo 5: Importação de Sessão via IA

```
Terapeuta em TelaImportar → cola ou faz upload de anotações brutas
  → extrairSessaoDeTexto(texto, paciente) → Gemini API
  → JSON estruturado: { numero, data, resumo, temas[], distorcoes[], emocoes[], ... }
  → Terapeuta revisa e edita campos na interface
  → criarSessao(terapeutaId, pacienteId, camposRevisados)
  → POST /rest/v1/sessoes
  → handleSessaoSalva() → atualiza sessoesList no state local
```

## 2.4 Componentes e Responsabilidades

### App do Terapeuta (`copiloto-vite/src/App.jsx`)

| Componente | Responsabilidade |
|---|---|
| `App` | Orquestrador raiz. Gerencia auth, roteamento de views, estado global |
| `TelaDashboard` | Métricas do consultório: pacientes, agenda, status de planos |
| `TelaPacientes` | Lista de pacientes com busca, filtros e criação |
| `TelaHistorico` | Timeline de sessões + toggle "Sessões / Registros do app". Cada sessão tem sub-abas "📋 Histórico da sessão" e "🎯 Plano da sessão". Sidebar de sessões colapsável. |
| `TelaPlano` | Plano da próxima sessão: geração IA, edição, confirmação |
| `TelaImportar` | Upload/paste de anotações com extração por IA |
| `TelaMural` | Banco de palavras por abordagem terapêutica |
| `TelaInsights` | Análise de padrões, alertas, métricas e gráficos longitudinais; Análise Clínica por IA com cache inteligente |
| `TelaPerfil` | Edição do perfil do paciente + geração de convite |
| `TelaCalendario` | Agenda semanal com CRUD de agendamentos |
| `TelaConfiguracoes` | Edição do perfil do terapeuta; seletor de janela de contexto (1/3/4/5 sessões) |
| `ModalAgendamento` | Modal para criar/editar agendamentos e recorrências |
| `AgendaHojeList` | Lista de sessões do dia no sidebar |
| `OnboardingModal` | Modal de boas-vindas: 5 steps guiados, progress dots, persiste `onboarding_concluido` no banco |

### Camada de Serviços (`copiloto-vite/src/services/`)

| Arquivo | Responsabilidade |
|---|---|
| `supabase.js` | Inicialização do cliente Supabase, guard `hasSupabase` |
| `auth.js` | Login, logout, cadastro, observer de sessão |
| `pacientes.js` | CRUD de pacientes |
| `sessoes.js` | Listagem e criação de sessões |
| `planos.js` | CRUD de planos de sessão + confirmarPlano |
| `agendamentos.js` | CRUD de agendamentos com filtro por intervalo de datas |
| `tarefas.js` | Criação e listagem de tarefas do paciente |
| `registros.js` | Leitura de registros ABCD do paciente |
| `humor_service.js` | Leitura do humor diário do paciente |
| `convites.js` | Criação, geração de link, listagem e revogação de convites |
| `terapeutas.js` | Busca, atualização do perfil + `marcarOnboardingConcluido()` |
| `ia.js` | Gemini 2.5-flash (primário) + Claude Sonnet fallback; `gerarPlanoSessao()` com multi-sessão; `gerarAnaliseLongitudinal()` |
| `analise_longitudinal.js` | Leitura e upsert em `analises_longitudinais`; `buscarAnalise()` + `salvarAnalise()` |
| `exportacao.js` | Exportação LGPD: `exportarJSON()` e `exportarCSV()` com BOM UTF-8 |
| `auditoria.js` | Leitura de `audit_log` por paciente; `formatarEntradaLog()` |
| `testarIA.js` | Validação da chave de API em desenvolvimento |

**Utilitários (`src/utils/`):**

| Arquivo | Responsabilidade |
|---|---|
| `exportarPlanoPDF.js` | Exporta plano de sessão em PDF: html2canvas + jsPDF A4, logo Vinculi base64, paginação automática |

## 2.5 Tecnologias Utilizadas

| Categoria | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| Framework UI | React | 18.x | Ecossistema maduro, hooks modernos |
| Build tool | Vite | 5.4 | Fast HMR, build otimizado |
| Estilização | CSS-in-JS inline | — | Zero dependências, portabilidade máxima |
| Backend / BaaS | Supabase | — | Auth + PostgreSQL + RLS + realtime sem infraestrutura própria |
| Banco de dados | PostgreSQL | 15 | Robustez, suporte a JSONB, arrays, RLS nativo |
| IA Generativa | Google Gemini | 2.5-flash | Custo baixo, boa performance para texto clínico; Claude Sonnet como fallback |
| Gráficos | Recharts | 3.8.1 | LineChart, BarChart, AreaChart para dashboard de evolução |
| Exportação PDF | jsPDF + html2canvas | — | Exportação do plano de sessão em A4 |
| Hospedagem | Vercel | — | CI/CD integrado, CDN global, deploy por push |
| Fontes | DM Sans (Google Fonts) | — | Legibilidade em leitura clínica |

## 2.6 Padrões Arquiteturais

| Padrão | Aplicação |
|---|---|
| **SPA (Single Page Application)** | Um único arquivo HTML + JS bundle; roteamento via estado React |
| **BFF implícito** | Serviços em `src/services/` encapsulam toda comunicação com Supabase |
| **Row Level Security** | Isolamento de dados no banco; nenhuma lógica de autorização no frontend |
| **Optimistic UI** | Estado local atualizado imediatamente; persistência em background |
| **Guard pattern** | `hasSupabase` permite modo demo sem banco de dados configurado |
| **Single-file component** | App.jsx contém toda a lógica por escolha deliberada (ver ADR-01) |

---

# 3. ADRs — Architecture Decision Records

## ADR-01: Single-File Architecture para o App Principal

**Status:** Aceita  
**Data:** 2025 (início do projeto)

### Contexto
O MVP precisa ser rápido de iterar, funcionar como artifact interativo no Claude.ai e ser mantido por uma equipe pequena (1-2 pessoas). A arquitetura padrão de componentes em múltiplos arquivos adiciona overhead de setup, importações e navegação de código para um time tão pequeno.

### Decisão
Todo o código do app do terapeuta reside em um único arquivo: `src/App.jsx`. Componentes, dados simulados, constantes e lógica de negócio coexistem no mesmo arquivo, organizados por seções comentadas.

### Alternativas Consideradas
- **Arquitetura de componentes separados**: Melhor organização a longo prazo, mas overhead desnecessário para MVP de 1 arquivo.
- **Next.js com SSR**: Overkill para uma SPA protegida por login; sem benefício de SEO.
- **Zustand / Redux**: Gerenciamento de estado externo desnecessário dado o modelo de props/lifting atual.

### Consequências
- **Positivo:** Iteração extremamente rápida, sem overhead de importações, fácil de revisar inteiro de uma vez.
- **Negativo:** Arquivo cresce (>5.000 linhas), navegação por busca de texto em vez de pastas.
- **Mitigação:** Seções comentadas (`// ─── NOME ───`) e nomenclatura consistente compensam a falta de estrutura de pastas.

---

## ADR-02: Supabase como Backend-as-a-Service

**Status:** Aceita  
**Data:** 2025

### Contexto
O produto precisa de autenticação segura, banco de dados relacional e controle de acesso granular sem que a equipe mantenha infraestrutura própria. O MVP precisa ir ao ar em semanas, não meses.

### Decisão
Usar Supabase como único backend: Auth, PostgreSQL e RLS. Sem API própria (Node/Python). O frontend chama a API REST do Supabase diretamente.

### Alternativas Consideradas
- **Firebase**: Banco NoSQL dificulta queries relacionais e análises clínicas.
- **API própria (Express/FastAPI)**: Meses de desenvolvimento extra; não se justifica no MVP.
- **PocketBase**: Menos maturidade, ecossistema menor, RLS menos robusto.

### Consequências
- **Positivo:** Auth pronta, RLS nativa no banco, sem servidor a manter, SDK JavaScript de alto nível.
- **Negativo:** Acoplamento ao vendor Supabase; chave anon exposta no frontend (compensada pelo RLS).
- **Mitigação:** Toda autorização vive no banco (RLS), não no frontend. Chave anon sem privilégios de administrador.

---

## ADR-03: Row Level Security como única barreira de autorização

**Status:** Aceita  
**Data:** 2025

### Contexto
Dados de pacientes são sensíveis. Com o frontend chamando Supabase diretamente (sem API proxy), é essencial que o banco rejeite qualquer acesso não autorizado, independentemente do que o frontend envie.

### Decisão
Toda tabela tem RLS habilitada. Políticas garantem que `auth.uid()` corresponda ao `terapeuta_id` (ou ao `paciente_auth_id` para o app do paciente) em cada operação. O frontend não implementa checagens de autorização — confia inteiramente no banco.

### Alternativas Consideradas
- **Autorização no frontend**: Facilmente contornável; insegura por definição.
- **API proxy com JWT**: Segurança superior, mas requer backend próprio (ver ADR-02).

### Consequências
- **Positivo:** Segurança robusta mesmo se o frontend for comprometido; simples de auditar.
- **Negativo:** Depuração de queries negadas pode ser opaca; policies precisam ser testadas cuidadosamente.
- **Mitigação:** Todas as policies seguem o padrão uniforme `auth.uid() = terapeuta_id`; função helper `get_paciente_id()` para o app do paciente.

---

## ADR-04: Gemini API chamada diretamente do Browser

**Status:** ~~Aceita com ressalva~~ **Superada** — proxy serverless implementado (v1.1)  
**Data:** 2025

### Contexto
A geração de planos e extração de sessões requer uma LLM. Chamar a API do Gemini de um servidor proxy adiciona latência e complexidade de infraestrutura.

### Decisão
Chamar a Gemini API diretamente do browser usando `VITE_GEMINI_API_KEY` (variável de ambiente pública no Vercel). A chave fica exposta no bundle JavaScript.

### Alternativas Consideradas
- **Proxy serverless (Vercel Functions)**: Esconde a chave, mas adiciona latência e custo de função.
- **Edge Function no Supabase**: Similar ao proxy, mais complexidade.

### Consequências
- **Positivo:** Zero latência de proxy, deploy simplificado, sem custo extra de função.
- **Negativo:** Chave de API visível no bundle JS; quem a descobrir pode usar a cota.
- **Mitigação:** Monitorar uso no Google AI Studio; restringir a chave por domínio de referência HTTP; mover para proxy serverless na Fase 2.

> **Atualização v1.1 (2026-05-26):** Proxy serverless implementado em `copiloto-vite/api/gemini.js` (Vercel Function). Chave da IA movida para variável de ambiente do servidor. Suporte a Gemini (primário) e Claude/Anthropic (fallback). ADR superada.

---

## ADR-05: Modelo de Dados com Linha Terapêutica por Paciente

**Status:** Aceita  
**Data:** 2025

### Contexto
O MVP suporta 6 abordagens terapêuticas (TCC, Psicanálise, Gestalt, Junguiana, Humanista/ACP, Análise do Comportamento). Cada abordagem tem terminologia, campos e tipos de intervenção distintos.

### Decisão
Campo `linha` (texto) na tabela `pacientes` e na tabela `terapeutas` (`linha_default`). A lógica de adaptação de UI e labels vive no frontend como constantes (`BANCO_PALAVRAS`, `LABELS_POR_LINHA`, `CAMPOS_POR_LINHA`).

### Alternativas Consideradas
- **Tabela separada de abordagens**: Over-engineering para MVP; labels raramente mudam.
- **JSON por abordagem no banco**: Dificulta queries e relatórios futuros.

### Consequências
- **Positivo:** Simples de extender; novas abordagens são adicionadas em `BANCO_PALAVRAS` sem migração de schema.
- **Negativo:** Sem validação de enum no banco (qualquer string é aceita).
- **Mitigação:** Frontend valida via seleção controlada; enum pode ser adicionado em migração futura.

---

## ADR-06: Status de Plano como Campo de Texto com Três Estados

**Status:** Aceita  
**Data:** 2026

### Contexto
O dashboard precisa saber se o terapeuta revisou e aprovou o plano de sessão gerado pela IA. Isso requer um status persistido no banco.

### Decisão
Campo `status text DEFAULT 'proposto'` na tabela `planos`. Três valores possíveis: `a_iniciar` (sem plano), `proposto` (gerado, não revisado), `confirmado` (revisado e aprovado).

### Consequências
- **Positivo:** Simples, legível, sem enum complexo.
- **Negativo:** `a_iniciar` não é um valor real na tabela — é inferido pela ausência de registro.
- **Mitigação:** Tratado no frontend: se não há plano, status = `a_iniciar`; se há, usa o campo.

---

# 4. Design Doc Completo

## 4.1 Descrição da Implementação

### Estrutura de Arquivos

```
app_-_Psic-TCC/
├── copiloto-vite/                   # App do terapeuta
│   ├── src/
│   │   ├── App.jsx                  # Componente raiz — ~6.800 linhas
│   │   ├── services/
│   │   │   ├── supabase.js          # Cliente Supabase
│   │   │   ├── auth.js              # Autenticação
│   │   │   ├── pacientes.js         # CRUD pacientes
│   │   │   ├── sessoes.js           # CRUD sessões
│   │   │   ├── planos.js            # CRUD planos + confirmar
│   │   │   ├── agendamentos.js      # CRUD agendamentos
│   │   │   ├── tarefas.js           # CRUD tarefas
│   │   │   ├── registros.js         # Leitura registros ABCD
│   │   │   ├── humor_service.js     # Leitura humor diário
│   │   │   ├── convites.js          # Geração/gestão de convites
│   │   │   ├── terapeutas.js        # Perfil do terapeuta
│   │   │   ├── ia.js               # Gemini + Claude fallback; plano + análise longitudinal
│   │   │   └── analise_longitudinal.js  # Cache de análises longitudinais por paciente
│   │   ├── utils/
│   │   │   └── exportarPlanoPDF.js  # Exportação do plano de sessão em PDF
│   │   └── components/
│   │       ├── TelaLogin.jsx        # Tela de login/cadastro
│   │       └── TelaCarregando.jsx   # Splash screen de carregamento
│   ├── api/
│   │   └── gemini.js                # Proxy serverless: Gemini + Claude (Vercel Function)
│   ├── supabase/
│   │   ├── schema.sql               # Schema principal
│   │   ├── schema_paciente.sql      # Tabelas do app paciente
│   │   ├── agendamentos.sql         # Tabela de agendamentos
│   │   └── *.sql                    # Migrações incrementais
│   ├── public/
│   │   └── vite.svg
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── copiloto-paciente/               # App do paciente (PWA)
│   ├── src/
│   │   └── App.jsx                  # App PWA do paciente
│   └── ...
│
├── CLAUDE.md                        # Guia para o Claude Code
└── DOCUMENTATION.md                 # Este arquivo
```

### Seções do App.jsx

O arquivo segue uma ordem convencional de top-down:

```
1. Imports (React, serviços)
2. Hook useBreakpoint
3. Constantes globais (BANCO_PALAVRAS, DISTORCOES_TCC, ESTILO_INICIAL)
4. DADOS SIMULADOS (PACIENTES, PLANOS_GERADOS) — para modo demo
5. Componentes auxiliares (Badge, RiscoTag, Avatar, etc.)
6. normalizeAIPlano (função de mapeamento)
7. Telas (TelaPacientes, TelaHistorico, TelaPlano, TelaImportar,
          TelaMural, TelaInsights, TelaPerfil, TelaCalendario,
          TelaDashboard, TelaConfiguracoes)
8. Componentes de layout (AgendaHojeList, ModalAgendamento)
9. App principal (estado global, effects, handlers, render)
```

## 4.2 Estrutura de Dados

### Estado Global do App

```javascript
// App.jsx — estado relevante do componente raiz
const [paciente, setPaciente]               // Paciente selecionado
const [pacientesLista, setPacientesLista]   // Todos os pacientes
const [aba, setAba]                         // Aba ativa do paciente
const [sessaoAuth, setSessaoAuth]           // Sessão JWT do Supabase
const [terapeutaNome, setTerapeutaNome]     // Nome do terapeuta logado
const [terapeutaPerfil, setTerapeutaPerfil] // { nome, telefone, crp }
const [mostrarDashboard, ...]               // true = exibe TelaDashboard
const [mostrarAgenda, ...]                  // true = contexto de agenda ativo
const [mostrarConfiguracoes, ...]           // true = exibe TelaConfiguracoes
const [secaoAtiva, ...]                     // Seção expandida no sidebar
const [abaAgenda, ...]                      // "hoje" | "calendario"
const [agendamentos, ...]                   // Lista de agendamentos carregados
```

### Modelo de Paciente (estado local)

```javascript
{
  id: "uuid",
  nome: "Maria da Silva",
  iniciais: "MS",
  queixa: "Ansiedade generalizada",
  diagnostico: "F41.1",
  linha: "tcc",              // chave de BANCO_PALAVRAS
  risco: "baixo",            // baixo | medio | alto
  sessoes: 12,               // número da última sessão
  sessoes_pagas: 10,
  inicio: "2024-03-01",
  meta: "Reduzir ansiedade em situações sociais",
  cor: "#6366f1",            // cor do avatar (calculada por índice)
  adesao: 75,                // % de tarefas completadas
  humor: [5,6,7,6,8,7,6],   // últimos 7 dias
  sessoesList: [...],        // sessões carregadas do Supabase
  statusPlano: "proposto",   // calculado no dashboard
}
```

### Modelo de Sessão

```javascript
{
  id: "uuid",
  numero: 12,
  data: "18/05/2026",
  resumo: "Paciente relatou...",
  temas: ["ansiedade social", "evitamento"],
  distorcoes: ["Catastrofização", "Leitura mental"],
  tecnicas: ["Reestruturação cognitiva", "Experimento comportamental"],
  emocoes: [{ nome: "Ansiedade", intensidade: 8 }, { nome: "Tristeza", intensidade: 4 }],
  alertas: [],
  resultadoTarefa: "Completou parcialmente",
  tarefaProxima: "Registro ABC por 3 dias",
  humor_inicio: 4,
  humor_fim: 6,
}
```

### Modelo de Plano (TelaPlano)

```javascript
{
  id: "uuid",               // ID do banco (null para mock/novos não salvos)
  objetivo: "Trabalhar catastrofização em contexto profissional",
  itensRevisar: ["Verificar tarefa: ...", "Resultado: ..."],
  focoPrincipal: "...",
  fluxoSocratico: [
    { eixo: "Investigação", descricao: "...", perguntas: [{ id: 1, texto: "..." }] },
    { eixo: "Exploração de perspectiva", ... },
    { eixo: "Construção de resposta alternativa", ... }
  ],
  tecnicas: ["Reestruturação cognitiva", "Registro de pensamentos"],
  tarefa: "Preencher 3 registros ABC durante a semana",
  obs: "Atenção à resistência ao experimento comportamental",
  duracaoSugerida: "50 min",
  urgencia: "normal",       // normal | alto
}
```

## 4.3 Fluxos Internos Detalhados

### Carregamento Inicial

```
1. App monta → useEffect([]) dispara
2. onAuthStateChange registra listener
3. Se sessão existe:
   a. upsert em terapeutas (garante registro)
   b. SELECT nome, telefone, crp da tabela terapeutas
   c. listarPacientes(uid) → setState(mapeados)
   d. setPaciente(mapeados[0]) → primeiro paciente pré-selecionado
   e. listarAgendamentos(uid, rangeIni, rangeFim) → setState
4. TelaDashboard renderiza com mostrarDashboard=true (default)
5. useEffect([paciente.id]) → listarSessoes(paciente.id) → atualiza sessoesList
```

### Atualização de Dados Após Salvar Sessão

```
handleSessaoSalva(novaSessao):
  1. Normaliza campos da nova sessão
  2. setPaciente(prev => { ...prev, sessoesList: [nova, ...prev.sessoesList], sessoes: nova.numero })
  3. setPacientesLista(prev => prev.map(p => p.id === id ? atualizado : p))
  4. Navega para aba "historico"
```

### Persistência de Tarefa Entre Abas

```
TelaPlano monta (useEffect [paciente.id]):
  → listarTarefas(paciente.id)
  → Encontra tarefa com status !== 'concluida'
  → setTarefaEnviada({ id, descricao })
  → UI mostra badge "Tarefa enviada" em vez do botão de envio
```

## 4.4 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Chave Gemini exposta no bundle | Alta | Médio | Monitorar quota; mover para proxy na Fase 2 |
| Supabase fora do ar | Baixa | Alto | App funciona em modo demo; dados não perdidos |
| Perda de dados ao editar paciente | Baixa | Alto | UPDATE com retorno confirma operação; sem soft-delete ainda |
| Prompt injection via notas brutas | Média | Baixo | Notas são conteúdo de entrada do usuário; sem exec de código |
| Timeout de geração de plano (Gemini) | Média | Médio | Botão "Gerar plano" desabilitado durante geração; mensagem de erro clara |
| Violação de privacidade entre terapeutas | Muito baixa | Muito alto | RLS impede acesso cruzado no banco |

## 4.5 Limitações Conhecidas

1. **Sem modo offline**: App requer conexão para qualquer operação de dados.
2. **PDF de plano disponível; relatório clínico completo pendente**: PDF do plano de sessão entregue na v2.0; relatório consolidado com gráficos e histórico (US-16) planejado para v2.1.
3. ~~**IA não tem contexto longitudinal real**~~ **Resolvido em v2.0**: `gerarPlanoSessao` aceita até 5 sessões; `gerarAnaliseLongitudinal` usa todas as sessões do paciente.
4. ~~**Chave de API pública**~~ **Resolvido em v1.1**: Proxy serverless oculta as chaves (ADR-04 superada).
5. **Sem validação de CRP**: Campo livre; o sistema não verifica registros no CFP/CRP.
6. **Single tenant por design**: Um terapeuta por conta; sem compartilhamento de pacientes.
7. ~~**Sem logs de auditoria clínica**~~ **Resolvido em v1.1**: Tabela `audit_log` com triggers em sessoes/planos/pacientes.
8. **Sem backup próprio**: Depende 100% do backup automático do Supabase.
9. **humor_inicio/humor_fim ausentes nos dados mock**: Gráfico de humor mostra empty state para pacientes de demonstração; sem impacto em dados reais.
10. **Análise Longitudinal requer dados estruturados**: Pacientes com poucas sessões ou dados incompletos (sem distorções, sem temas) geram análises rasas.
11. **Bundle aumentou ~40 KB gzip**: Logo Vinculi em base64 + Recharts adicionados na v2.0; impacto baixo (cache PWA).

## 4.6 Débitos Técnicos

| ID | Débito | Causa | Impacto | Solução Futura |
|---|---|---|---|---|
| DT-01 | Bundle size (592 KB / 158 KB gzip) | App.jsx monolítico + logo base64 + Recharts | Baixo (PWA com cache) | Code splitting com `dynamic import()` |
| DT-02 | App.jsx monolítico (~6.800 linhas) | Decisão arquitetural (ADR-01) | Médio (manutenibilidade) | Extrair cada Tela para arquivo próprio |
| DT-03 | Dados mock com campos incompletos | humor_inicio/fim ausentes nos PACIENTES mock | Gráfico de humor não demonstra valor em demos | Popular campos de humor nos dados simulados |
| DT-04 | Janela de contexto "1 sessão" sem diferenciação visual | Seletor não segmenta "Básico / Longitudinal" | Baixo (UX) | Separador ou label no seletor |
| DT-05 | Google Calendar não implementado | OAuth Google + VITE_GOOGLE_CLIENT_ID pendentes | Médio | OAuth Google (pré-req para US-14) |

---

# 5. Documentação de APIs e Serviços

## 5.1 Visão Geral

O app do terapeuta não expõe nem consome uma API REST própria. Toda comunicação é feita via **Supabase JavaScript SDK** (`@supabase/supabase-js`), que abstrai chamadas REST/WebSocket para o PostgreSQL.

As "APIs" documentadas aqui são os contratos dos serviços internos em `src/services/`.

## 5.2 Supabase Client

**Arquivo:** `src/services/supabase.js`

```javascript
// Inicialização
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const hasSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
```

**Variáveis de ambiente necessárias:**
```env
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_GEMINI_API_KEY=AIzaSy...
```

## 5.3 Serviço: auth.js

| Função | Descrição | Retorno |
|---|---|---|
| `signUp(email, password)` | Cadastro de novo terapeuta | `{ data: { user, session }, error }` |
| `signIn(email, password)` | Login com e-mail e senha | `{ data: { user, session }, error }` |
| `signOut()` | Logout e limpeza de sessão | `{ error }` |
| `onAuthStateChange(callback)` | Observer de mudanças de sessão | `{ data: { subscription } }` |

## 5.4 Serviço: pacientes.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `listarPacientes(terapeutaId)` | uuid | SELECT * WHERE terapeuta_id = $1 ORDER BY nome |
| `criarPaciente(terapeutaId, campos)` | uuid, object | INSERT + SELECT retornando novo registro |
| `atualizarPaciente(pacienteId, campos)` | uuid, object | UPDATE + SELECT |
| `excluirPaciente(pacienteId)` | uuid | DELETE (cascade para sessões, planos, etc.) |

**Campos de `campos` em criarPaciente:**
```javascript
{
  nome: string,           // obrigatório
  iniciais: string,
  queixa: string,
  diagnostico: string,
  linha: string,          // 'tcc' | 'psicanalise' | 'gestalt' | 'junguiana' | 'humanista' | 'comportamental'
  risco: string,          // 'baixo' | 'medio' | 'alto'
  sessoes: number,
  sessoes_pagas: number,
  inicio: string,
  meta: string
}
```

## 5.5 Serviço: sessoes.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `listarSessoes(pacienteId)` | uuid | SELECT * WHERE paciente_id = $1 ORDER BY numero DESC |
| `criarSessao(terapeutaId, pacienteId, campos)` | uuid, uuid, object | INSERT + SELECT |

**Campos de sessão:**
```javascript
{
  numero: integer,         // obrigatório
  data: string,
  humor_inicio: integer,
  humor_fim: integer,
  resumo: text,
  temas: text[],
  distorcoes: text[],
  tecnicas: text[],
  emocoes: jsonb,          // [{ nome, intensidade }]
  alertas: text[],
  resultado_tarefa: text,
  tarefa_proxima: text,
  notas_raw: text
}
```

## 5.6 Serviço: planos.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `buscarPlano(pacienteId)` | uuid | SELECT mais recente; retorna null se não existe |
| `salvarPlano(terapeutaId, pacienteId, campos)` | uuid, uuid, object | INSERT (status padrão: 'proposto') |
| `atualizarPlano(planoId, campos)` | uuid, object | UPDATE; seta editado=true automaticamente |
| `confirmarPlano(planoId)` | uuid | UPDATE status='confirmado' |
| `buscarStatusPlanosPorTerapeuta(terapeutaId)` | uuid | SELECT paciente_id, status, created_at ORDER BY created_at DESC |

## 5.7 Serviço: agendamentos.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `listarAgendamentos(terapeutaId, inicio, fim)` | uuid, ISO8601, ISO8601 | SELECT WHERE inicio >= $2 AND inicio <= $3 |
| `criarAgendamento(terapeutaId, campos)` | uuid, object | INSERT, suporta criação múltipla para recorrência |
| `atualizarAgendamento(agendId, campos)` | uuid, object | UPDATE |
| `cancelarAgendamento(agendId)` | uuid | UPDATE status='cancelado' |

**Status de agendamento:** `agendado` | `confirmado` | `cancelado` | `falta` | `realizado`

## 5.8 Serviço: tarefas.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `criarTarefa(campos)` | object | INSERT em tarefas; status padrão 'pendente' |
| `listarTarefas(pacienteId)` | uuid | SELECT WHERE paciente_id = $1 ORDER BY criado_em DESC |

## 5.9 Serviço: ia.js

**Modelo principal:** `gemini-2.5-flash` via proxy `/api/gemini`  
**Fallback:** `claude-sonnet-4-6` via mesmo proxy  
**Normalização:** proxy retorna `{ text }` para ambos; `extrairJSON(text)` remove blocos markdown antes do parse.

### Funções Públicas

#### `extrairSessaoDeTexto(texto, linha, onProviderChange)`
```
Input:  texto bruto + linha terapêutica ('tcc' | 'psicanalise' | ...)
Output: { sessao: { resumo, temas[], distorcoes[], tecnicas[], emocoes[], alertas[], humor_inicio, humor_fim, ... }, provider }
```

#### `gerarPlanoSessao(paciente, sessoesInput, janelaContexto, onProviderChange)`
```
sessoesInput: array (mais recente primeiro) ou objeto único (retrocompat.)
janelaContexto: 1|3|4|5 — número de sessões usadas no contexto (default 3)

Output: { plano: {
  objetivo, itensRevisar[], focoPrincipal,
  fluxoSocratico: [                  ← 3 eixos FIXOS, nessa ordem:
    { eixo: "Investigação de evidências",       perguntas: [p1, p2] },
    { eixo: "Exploração de perspectiva",        perguntas: [p3, p4] },
    { eixo: "Construção de resposta alternativa", perguntas: [p5, p6] }
  ],
  tecnicas[], tarefa, obs, duracaoSugerida, urgencia,
  contextoUtilizado   ← número de sessões efetivamente usadas
}, provider }
```

**Instruções anti-superficialidade no prompt:** `focoPrincipal` mínimo 3 linhas com justificativa por evidências; perguntas passam nos testes de especificidade e intenção oculta; tarefa específica com situação + objetivo + forma de registro.

#### `gerarAnaliseLongitudinal(paciente, todasSessoes)`
```
Input:  paciente + array completo de sessões (sem limite de janela)
Ordena: sessões em ordem cronológica antes de montar o prompt

Output: {
  evolucaoCaso: string,              ← mínimo 4 linhas
  padroesPresistentes: [{ padrao, frequencia, contexto, indicacao }],
  pontosAtencao: string[],
  hipoteses: string[],
  direcaoProximosCiclos: string,     ← mínimo 3 linhas
  sessoesAnalisadas: number,
  dataAnalise: string,
  geradoPor: 'gemini' | 'claude'
}
```

**Tratamento de erros da IA:**
- Gemini falha → fallback automático para Claude (transparente para o caller)
- Parse error de JSON → `extrairJSON()` tenta remover markdown antes de falhar
- Ambos falham → exception propagada ao componente; usuário vê alert

## 5.10 Serviço: analise_longitudinal.js

| Função | Parâmetros | Descrição |
|---|---|---|
| `buscarAnalise(terapeutaId, pacienteId)` | uuid, uuid | SELECT mais recente (order created_at desc, limit 1); retorna null se não existe |
| `salvarAnalise(terapeutaId, pacienteId, conteudo, sessoesCount, geradoPor)` | uuid, uuid, jsonb, int, string | Upsert: atualiza se existe (via buscarAnalise), insere se não existe |

**Cache inteligente no TelaInsights:**
- `analise.sessoes_count` = quantidade de sessões quando a análise foi gerada
- `sessoesList.length` = quantidade atual
- Se `sessoesList.length > analise.sessoes_count` → botão "↻ Atualizar (N novas)"
- Se igual → botão "✓ Atualizada" (desabilitado)
- Se null → botão "✦ Gerar análise"

## 5.11 Utilitário: exportarPlanoPDF.js

```
exportarPlanoPDF(plano, paciente, terapeutaPerfil)
  → Monta div oculto (position:absolute, left:-9999px)
  → Cabeçalho: logo Vinculi (base64 PNG), nome/CRP do terapeuta, nome/sessão do paciente
  → Seções: objetivo, itens a revisar, foco principal, fluxo socrático, técnicas, tarefa, obs
  → html2canvas scale:2 (alta resolução) → jsPDF A4 portrait, paginação automática
  → Remove div do DOM no finally (sem vazamento)
  → Download: Plano_{NomePaciente}_{DD-MM-AAAA}.pdf
```

---

# 6. Documentação de Banco de Dados

## 6.1 Modelo Lógico

```
terapeutas ──┐
             ├── pacientes ──┐
             │               ├── sessoes
             │               ├── planos
             │               ├── agendamentos
             │               └── convites ──── tarefas ──── registros_abcd
             │                                            
             └── agendamentos (terapeuta_id FK direto)

pacientes (via convites.paciente_id)
  └── humor_diario
  └── conquistas
```

## 6.2 Dicionário de Dados

### Tabela: `terapeutas`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | — | FK para auth.users (chave primária) |
| `email` | text | NOT NULL | — | E-mail do terapeuta |
| `nome` | text | NULL | — | Nome completo |
| `crp` | text | NULL | — | Número de registro (ex: CRP 06/123456) |
| `telefone` | text | NULL | — | Telefone de contato |
| `tratamento` | text | NULL | 'Dr.' | Tratamento exibido: "Dr." ou "Dra." |
| `linha_default` | text | NULL | 'tcc' | Abordagem padrão |
| `onboarding_concluido` | boolean | NULL | false | true após concluir/pular o onboarding guiado |
| `janela_contexto` | integer | NOT NULL | 3 | Sessões usadas pela IA no plano (1, 3, 4 ou 5) |
| `acesso_analise_longitudinal` | boolean | NOT NULL | true | Feature flag: Análise Longitudinal Pro; false = exibe card de upgrade |
| `created_at` | timestamptz | NOT NULL | now() | Data de cadastro |

### Tabela: `pacientes`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `terapeuta_id` | uuid | NOT NULL | — | FK → terapeutas.id |
| `nome` | text | NOT NULL | — | Nome completo do paciente |
| `iniciais` | text | NULL | — | Iniciais para avatar (ex: "MS") |
| `queixa` | text | NULL | — | Queixa principal |
| `diagnostico` | text | NULL | — | CID ou DSM livre |
| `linha` | text | NULL | 'tcc' | Abordagem terapêutica |
| `risco` | text | NULL | 'baixo' | Nível de risco: baixo/medio/alto |
| `sessoes` | integer | NULL | 0 | Número da última sessão registrada |
| `sessoes_pagas` | integer | NULL | 0 | Sessões com pagamento confirmado |
| `inicio` | text | NULL | — | Data de início do acompanhamento |
| `meta` | text | NULL | — | Objetivo terapêutico principal |
| `deleted_at` | timestamptz | NULL | — | Soft-delete: preenchido ao arquivar; NULL = ativo |
| `created_at` | timestamptz | NOT NULL | now() | Criação |
| `updated_at` | timestamptz | NOT NULL | now() | Última atualização (trigger) |

**Nota:** Pacientes com `deleted_at IS NOT NULL` são filtrados no frontend. Pacientes arquivados ficam em estado recuperável por 30 dias antes da exclusão definitiva.

### Tabela: `sessoes`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NOT NULL | — | FK → pacientes.id |
| `terapeuta_id` | uuid | NOT NULL | — | FK → terapeutas.id |
| `numero` | integer | NOT NULL | — | Número sequencial da sessão |
| `data` | text | NOT NULL | — | Data no formato DD/MM/AAAA |
| `humor_inicio` | integer | NULL | — | Humor ao início (1-10) |
| `humor_fim` | integer | NULL | — | Humor ao fim (1-10) |
| `resumo` | text | NULL | — | Resumo narrativo |
| `temas` | text[] | NULL | — | Temas abordados |
| `distorcoes` | text[] | NULL | — | Distorções cognitivas identificadas |
| `tecnicas` | text[] | NULL | — | Técnicas aplicadas |
| `emocoes` | jsonb | NULL | — | Array: `[{nome, intensidade}]` |
| `alertas` | text[] | NULL | — | Alertas clínicos |
| `resultado_tarefa` | text | NULL | — | Como foi a tarefa da sessão anterior |
| `tarefa_proxima` | text | NULL | — | Tarefa proposta para a próxima sessão |
| `notas_raw` | text | NULL | — | Anotações brutas originais |
| `created_at` | timestamptz | NOT NULL | now() | Criação |

### Tabela: `planos`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NOT NULL | — | FK → pacientes.id |
| `terapeuta_id` | uuid | NOT NULL | — | FK → terapeutas.id |
| `sessao_id` | uuid | NULL | — | FK → sessoes.id (opcional, legado) |
| `sessao_origem_id` | uuid | NULL | — | FK → sessoes.id — vínculo direto sessão que originou o plano |
| `numero_proxima` | integer | NOT NULL | — | Número da próxima sessão |
| `objetivo` | text | NULL | — | Objetivo principal da sessão |
| `tecnicas` | text[] | NULL | — | Técnicas sugeridas |
| `perguntas` | text[] | NULL | — | Perguntas socráticas sugeridas |
| `distorcoes_foco` | text[] | NULL | — | Distorções a trabalhar |
| `tarefa` | text | NULL | — | Tarefa sugerida |
| `observacoes` | text | NULL | — | Observações clínicas |
| `gerado_por` | text | NULL | 'gemini' | Origem: gemini/claude/manual |
| `editado` | boolean | NULL | false | Se foi editado pelo terapeuta |
| `status` | text | NULL | 'proposto' | a_iniciar¹/proposto/confirmado |
| `sessoes_contexto` | integer | NULL | 1 | Número de sessões usadas na geração do plano |
| `created_at` | timestamptz | NOT NULL | now() | Criação |
| `updated_at` | timestamptz | NOT NULL | now() | Última atualização (trigger) |

¹ `a_iniciar` é estado inferido (ausência de registro), não armazenado.

### Tabela: `analises_longitudinais` (nova — v2.0)

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NOT NULL | — | FK → pacientes.id (CASCADE DELETE) |
| `terapeuta_id` | uuid | NOT NULL | — | FK → terapeutas.id (CASCADE DELETE) |
| `conteudo` | jsonb | NOT NULL | — | JSON com as 5 seções da análise |
| `sessoes_count` | integer | NOT NULL | — | Sessões analisadas na geração |
| `gerado_por` | text | NOT NULL | 'gemini' | gemini / claude |
| `created_at` | timestamptz | NOT NULL | now() | Criação |
| `updated_at` | timestamptz | NOT NULL | now() | Última atualização |

**RLS:** terapeuta acessa apenas próprias análises (`auth.uid() = terapeuta_id`)  
**Índice:** `idx_analises_paciente (paciente_id, terapeuta_id)`  
**Unicidade lógica:** uma análise por par (paciente_id, terapeuta_id) — implementada via upsert no serviço.

### Tabela: `agendamentos`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `terapeuta_id` | uuid | NOT NULL | — | FK → terapeutas.id |
| `paciente_id` | uuid | NULL | — | FK → pacientes.id (SET NULL no delete) |
| `inicio` | timestamptz | NOT NULL | — | Início da sessão |
| `fim` | timestamptz | NOT NULL | — | Fim da sessão |
| `tipo` | text | NULL | 'sessao' | sessao/avaliacao/retorno/outro |
| `status` | text | NULL | 'agendado' | agendado/confirmado/cancelado/falta/realizado |
| `notas` | text | NULL | — | Observações do agendamento |
| `created_at` | timestamptz | NOT NULL | now() | Criação |

### Tabela: `convites`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NULL | — | FK → pacientes.id |
| `terapeuta_id` | uuid | NULL | — | ID do terapeuta criador |
| `email_paciente` | text | NULL | — | E-mail sugerido |
| `token` | uuid | UNIQUE | gen_random_uuid() | Token do link de convite |
| `status` | text | NULL | 'pendente' | pendente/usado/revogado |
| `paciente_auth_id` | uuid | NULL | — | auth.uid() do paciente após cadastro |
| `criado_em` | timestamptz | NOT NULL | now() | Criação |

### Tabela: `tarefas`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NULL | — | FK → pacientes.id |
| `sessao_id` | uuid | NULL | — | FK → sessoes.id (opcional) |
| `terapeuta_id` | uuid | NULL | — | ID do terapeuta responsável |
| `descricao` | text | NOT NULL | — | Descrição da tarefa |
| `tipo_formulario` | text | NULL | 'abcd' | Tipo de registro esperado |
| `prazo` | date | NULL | — | Data limite |
| `status` | text | NULL | 'pendente' | pendente/em_andamento/concluido |
| `criado_em` | timestamptz | NOT NULL | now() | Criação |
| `atualizado_em` | timestamptz | NOT NULL | now() | Atualização |

### Tabela: `registros_abcd`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `tarefa_id` | uuid | NULL | — | FK → tarefas.id (SET NULL) |
| `paciente_id` | uuid | NOT NULL | — | ID do paciente autor |
| `situacao` | text | NULL | — | A — situação ativadora |
| `emocao` | text | NULL | — | B — emoção sentida |
| `intensidade_antes` | integer | NULL | — | Intensidade antes (1-10) |
| `pensamento` | text | NULL | — | C — pensamento automático |
| `resposta_racional` | text | NULL | — | D — resposta racional |
| `intensidade_depois` | integer | NULL | — | Intensidade depois (1-10) |
| `criado_em` | timestamptz | NOT NULL | now() | Criação |

### Tabela: `humor_diario`

| Coluna | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `paciente_id` | uuid | NOT NULL | — | ID do paciente |
| `data` | date | NOT NULL | — | Data do registro |
| `valor` | integer | NOT NULL | — | Humor 1-10 (CHECK constraint) |
| `nota` | text | NULL | — | Observação livre |
| `atualizado_em` | timestamptz | NOT NULL | now() | Atualização |

**Restrições:** UNIQUE (paciente_id, data) — um registro por dia.

## 6.3 Funções e Triggers do Banco

| Nome | Tipo | Descrição |
|---|---|---|
| `update_updated_at()` | Trigger Function | Atualiza `updated_at = now()` antes de UPDATE em pacientes e planos |
| `handle_new_user()` | Trigger Function | Cria registro em `terapeutas` ao inserir em `auth.users` |
| `get_paciente_id()` | Helper Function | Retorna `paciente_id` do convite com `paciente_auth_id = auth.uid()` |
| `pacientes_updated_at` | Trigger | Ativa `update_updated_at()` em UPDATE na tabela pacientes |
| `planos_updated_at` | Trigger | Ativa `update_updated_at()` em UPDATE na tabela planos |
| `on_auth_user_created` | Trigger | Ativa `handle_new_user()` em INSERT em auth.users |

## 6.4 Índices

| Tabela | Coluna(s) | Tipo | Justificativa |
|---|---|---|---|
| `agendamentos` | (terapeuta_id, inicio) | BTREE | Query principal de listagem por período |
| `analises_longitudinais` | (paciente_id, terapeuta_id) | BTREE | Lookup por par paciente+terapeuta na busca de análise |
| Todas as tabelas | PK uuid | BTREE | Automático pelo PostgreSQL |

## 6.5 Regras de Integridade

- **CASCADE DELETE:** Excluir terapeuta → exclui pacientes → exclui sessões, planos, agendamentos, convites.
- **SET NULL:** Excluir sessão → seta `planos.sessao_id = NULL`. Excluir paciente → seta `agendamentos.paciente_id = NULL`.
- **CHECK:** `humor_diario.valor` entre 1 e 10.
- **UNIQUE:** `humor_diario(paciente_id, data)` — um humor por dia. `convites.token` — tokens únicos.
- **NOT NULL críticos:** `sessoes.numero`, `sessoes.data`, `pacientes.nome`, `tarefas.descricao`, `terapeutas.email`.

---

# 7. Documentação de Segurança

## 7.1 Autenticação

**Mecanismo:** Supabase Auth com JWT (JSON Web Tokens).

```
Fluxo de autenticação:
1. Usuário envia e-mail + senha
2. Supabase valida credenciais → retorna access_token (JWT) + refresh_token
3. SDK armazena tokens em localStorage (gerenciado pelo Supabase SDK)
4. Cada request ao banco inclui: Authorization: Bearer {access_token}
5. Supabase verifica JWT → extrai auth.uid() → aplica RLS
6. access_token expira em 1 hora → refresh_token renova automaticamente
```

**Políticas de senha:**
- Mínimo 6 caracteres (padrão Supabase; recomendado aumentar em produção)
- Sem política de rotação no MVP

**Recuperação de senha:**
- Fluxo nativo Supabase: usuário solicita reset → recebe e-mail → redefine senha

## 7.2 Autorização — Row Level Security

Cada tabela tem RLS habilitada. O princípio: **nenhuma operação é permitida sem RLS explícita**.

### Políticas do App do Terapeuta

```sql
-- Padrão universal para tabelas do terapeuta:
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id)
```

| Tabela | Política | Operações |
|---|---|---|
| terapeutas | `auth.uid() = id` | ALL (SELECT, INSERT, UPDATE, DELETE) |
| pacientes | `auth.uid() = terapeuta_id` | ALL |
| sessoes | `auth.uid() = terapeuta_id` | ALL |
| planos | `auth.uid() = terapeuta_id` | ALL |
| analises_longitudinais | `auth.uid() = terapeuta_id` | ALL |
| agendamentos | `auth.uid() = terapeuta_id` | ALL |
| convites (terapeuta) | `auth.uid() = terapeuta_id` | ALL |

### Políticas do App do Paciente

```sql
-- Paciente acessa apenas dados do próprio paciente_id:
USING (paciente_id = public.get_paciente_id())
```

| Tabela | Política | Operações |
|---|---|---|
| convites (paciente) | `auth.uid() = paciente_auth_id` | SELECT |
| convites (ativação) | token em convites pendentes | UPDATE |
| tarefas (paciente) | `paciente_id = get_paciente_id()` | SELECT, UPDATE |
| registros_abcd | `paciente_id = get_paciente_id()` | ALL |
| humor_diario | `paciente_id = get_paciente_id()` | ALL |
| conquistas | `paciente_id = get_paciente_id()` | ALL |

### Leitura Cruzada (Terapeuta lê dados do app do paciente)

```sql
-- Terapeuta lê registros dos seus pacientes:
USING (paciente_id IN (SELECT id FROM pacientes WHERE terapeuta_id = auth.uid()))
```

Aplicada em: `registros_abcd`, `humor_diario`, `conquistas`.

## 7.3 Gestão de Segredos

| Segredo | Localização | Exposição |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel Env Vars | Pública (sem risco — URL é pública) |
| `VITE_SUPABASE_ANON_KEY` | Vercel Env Vars | Pública (segurança via RLS) |
| `GEMINI_API_KEY` | Vercel Env Vars (servidor) | Protegida — usada apenas pelo proxy `api/gemini.js` |
| `ANTHROPIC_API_KEY` | Vercel Env Vars (servidor) | Protegida — usada apenas pelo proxy `api/gemini.js` |
| Service Role Key | **Nunca no frontend** | Apenas no Supabase Dashboard |

**Práticas em produção:**
- Nunca commitar `.env` com valores reais (`.env` está em `.gitignore`)
- `GEMINI_API_KEY` e `ANTHROPIC_API_KEY`: variáveis de servidor no Vercel — não expostas no bundle desde a v1.1
- Supabase Anon Key: sem capacidade de bypass de RLS por design

## 7.4 Criptografia

| Dado | Em trânsito | Em repouso |
|---|---|---|
| Comunicação app ↔ Supabase | HTTPS/TLS 1.3 | — |
| Senhas dos usuários | HTTPS/TLS | bcrypt (Supabase gerencia) |
| Dados dos pacientes | HTTPS/TLS | AES-256 (Supabase gerencia no disco) |
| JWTs | HTTPS/TLS | Assinados com HS256 |
| Dados no localStorage | — | Sem criptografia adicional |

## 7.5 Logs e Auditoria

**Logs disponíveis:**
- Supabase Dashboard → Logs: queries SQL, erros de autenticação, edge functions
- Vercel Dashboard → Logs: deploys, edge requests

**Disponível:**
- Tabela `audit_log` com triggers em sessoes, planos e pacientes (implementado na v1.1)
- Leitura via `auditoria.js` → `buscarAuditoria(pacienteId)` + `formatarEntradaLog()`

**Limitações atuais:**
- Sem log de acesso ao app (quem abriu qual paciente)
- Sem retenção de versões anteriores de sessões ou planos (snapshot histórico)

## 7.6 Proteção Contra Ameaças Comuns

| Ameaça | Mitigação |
|---|---|
| SQL Injection | Parâmetros via SDK Supabase (prepared statements) |
| XSS | React escapa HTML por padrão; sem `dangerouslySetInnerHTML` |
| CSRF | Não aplicável (SPA sem cookies de sessão próprios) |
| Acesso não autorizado entre terapeutas | RLS no banco (ver 7.2) |
| Brute force de senha | Supabase tem rate limiting nativo |
| Token hijacking | Tokens em localStorage (sem HttpOnly cookie); risk aceito para MVP |

---

# 8. Documentação de DevOps / CI/CD

## 8.1 Pipeline de Deployment

```
Developer → git push (ou commit local) → Vercel CLI deploy
                                            │
                                            ▼
                                    Vercel Build Server
                                    ├── npm install
                                    ├── npm run build (Vite)
                                    └── Deploy para CDN Global
                                            │
                                            ▼
                                    copiloto-vite.vercel.app
```

**Comando de deploy:**
```bash
cd copiloto-vite
npx vercel --prod
```

**Tempo médio de deploy:** 12-15 segundos (com cache de build ativo).

## 8.2 Gatilhos de Deploy

| Gatilho | Ambiente | Ação |
|---|---|---|
| `npx vercel --prod` (manual) | Produção | Deploy full com build |
| `npx vercel` (sem --prod) | Preview | Deploy em URL preview única |
| Push para branch (se GitHub conectado) | Preview/Produção | CI automático via Vercel |

**Nota:** Atualmente o deploy é manual via CLI. Não há integração GitHub automática configurada.

## 8.3 Variáveis de Ambiente por Ambiente

| Variável | Desenvolvimento | Produção | Visibilidade |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Vercel Dashboard | Pública (VITE_ prefix) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Vercel Dashboard | Pública (segura via RLS) |
| `GEMINI_API_KEY` | `.env.local` | Vercel Dashboard | **Servidor apenas** (proxy) |
| `ANTHROPIC_API_KEY` | `.env.local` | Vercel Dashboard | **Servidor apenas** (proxy) |

**Arquivo `.env.local` (não commitado):**
```env
VITE_SUPABASE_URL=https://[ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
```

## 8.4 Build e Bundle

| Métrica | Valor |
|---|---|
| Framework | Vite 5.4.21 |
| Bundle principal | `index-[hash].js` — ~592KB gzip (~158KB transferido) |
| HTML | 0.91KB (0.53KB gzip) |
| Módulos transformados | ~100+ (Recharts + jsPDF adicionados na v2.0) |
| Tempo de build | ~5-6 segundos |
| Alerta de chunk size | Acima de 500KB (informativo, não blocante) |

## 8.5 Testes Automatizados

**Estado atual:** Sem testes automatizados no MVP.

**Plano para Fase 2:**
- Unit tests para funções puras (`normalizeAIPlano`, `analisarPadroes`, `mapearSessao`)
- Integration tests para serviços (mock Supabase)
- E2E básico com Playwright para fluxos críticos (login, criar paciente, gerar plano)

## 8.6 Políticas de Branch

| Branch | Propósito | Deploy |
|---|---|---|
| `main` | Produção estável | Manual `--prod` |
| `dev` | Desenvolvimento ativo | Preview via `vercel` |
| `feature/*` | Novas funcionalidades | Preview por PR |

**Regra geral:** Nunca fazer push diretamente para `main` sem testar em preview primeiro.

## 8.7 Migrações de Banco de Dados

**Processo atual:**
1. Escrever arquivo SQL em `copiloto-vite/supabase/[descricao].sql`
2. Executar manualmente no Supabase SQL Editor
3. Documentar no commit

**Arquivos de migração existentes:**

| Arquivo / Migração | Descrição | Status |
|---|---|---|
| `schema.sql` | Schema principal (terapeutas, pacientes, sessoes, planos) | ✅ Executado |
| `schema_paciente.sql` | App do paciente (convites, tarefas, registros_abcd, humor_diario) | ✅ Executado |
| `agendamentos.sql` | Tabela de agendamentos | ✅ Executado |
| `integracao_app_paciente.sql` | Integração entre apps | ✅ Executado |
| `terapeutas_telefone.sql` | ADD COLUMN telefone em terapeutas | ✅ Executado |
| `dashboard_planos_status.sql` | ADD COLUMN status em planos | ✅ Executado |
| `terapeutas_tratamento.sql` | ADD COLUMN tratamento em terapeutas (Dr./Dra.) | ✅ Executado |
| `planos_sessao_origem_id.sql` | ADD COLUMN sessao_origem_id em planos (vínculo direto sessão→plano) | ✅ Executado |
| `pacientes_deleted_at.sql` | ADD COLUMN deleted_at em pacientes (soft-delete recuperável 30 dias) | ✅ Executado |
| `audit_log.sql` | CREATE TABLE audit_log + triggers em sessoes/planos/pacientes | ✅ Executado |
| `push_subscriptions.sql` | CREATE TABLE push_subscriptions (VAPID push notifications app paciente) | ✅ Executado |
| `conquistas_fix.sql` | Fix colunas conquistas: `conquista_id`→`tipo`, `desbloqueado_em`→`desbloqueada_em`, NOT NULL `descricao`+`icone` | ✅ Executado |
| *(inline MCP)* | ADD COLUMN onboarding_concluido boolean DEFAULT false em terapeutas | ✅ Executado 2026-05-26 |
| *(inline MCP — v2.0)* | ADD COLUMN janela_contexto integer DEFAULT 3 + acesso_analise_longitudinal boolean DEFAULT true em terapeutas | ✅ Executado 2026-05-27 |
| *(inline MCP — v2.0)* | CREATE TABLE analises_longitudinais + RLS + índice idx_analises_paciente | ✅ Executado 2026-05-27 |

---

# 9. Runbooks Operacionais

## 9.1 Como Monitorar o Sistema

### Dashboard de Saúde (Supabase)
1. Acessar: `https://app.supabase.com/project/[ref]`
2. Verificar: **Database → Health** → CPU, connections, storage
3. Verificar: **Logs → Edge Logs** → errors 4xx/5xx nas últimas 24h
4. Verificar: **Auth → Users** → registros recentes (sinal de atividade normal)

### Vercel
1. Acessar: `https://vercel.com/ttsazevedos-projects/copiloto-vite`
2. Verificar: última deployment bem-sucedida
3. Verificar: Analytics (se habilitado) → tempo de resposta, erros

### Sinais de alerta
- Aumento repentino de erros 401 → problema de autenticação
- Aumento de erros 500 no Supabase → problema no banco
- Deployment falha no build → erro de código (verificar logs Vercel)

## 9.2 Como Fazer Deploy de Emergência

```bash
# 1. Acesse o diretório do projeto
cd c:/Users/thiag/Projetos/app_-_Psic-TCC/copiloto-vite

# 2. Verifique que o build está funcionando
npm run build

# 3. Deploy para produção
npx vercel --prod

# 4. Verifique a URL de produção no browser
# https://copiloto-vite.vercel.app
```

## 9.3 Como Executar uma Migração de Banco de Dados

```
1. Abrir Supabase Dashboard → SQL Editor
2. Abrir o arquivo .sql da migração em copiloto-vite/supabase/
3. Copiar o conteúdo completo
4. Colar no SQL Editor
5. Clicar "Run" (ou Ctrl+Enter)
6. Verificar: "Success. No rows returned" ou similar
7. Verificar no Table Editor que a coluna/tabela foi criada
```

**Rollback de migração:**
Para `ADD COLUMN`: `ALTER TABLE [tabela] DROP COLUMN IF EXISTS [coluna];`
Para `CREATE TABLE`: `DROP TABLE IF EXISTS [tabela] CASCADE;`

## 9.4 Como Lidar com Incidente: Usuário Não Consegue Fazer Login

```
Diagnóstico:
1. Verificar Supabase → Auth → Users → e-mail existe?
   → NÃO: orientar usuário a se cadastrar
   → SIM: continuar

2. Verificar Supabase → Logs → Auth → erro específico?
   → "Invalid login credentials": senha errada → reset de senha
   → "Email not confirmed": confirmar e-mail não chegou
   → Rate limited: muitas tentativas → aguardar 15 min

3. Verificar se Supabase está operacional: status.supabase.com

Resolução:
- Reset de senha: no Supabase Dashboard → Auth → Users → [user] → "Send Recovery Email"
- Confirmar e-mail manualmente: Auth → Users → [user] → "Confirm Email"
```

## 9.5 Como Lidar com Incidente: Dados de Paciente Desapareceram

```
Diagnóstico:
1. Verificar Supabase → Table Editor → pacientes
   → Filtrar por terapeuta_id = [id do terapeuta]
   → Dados estão no banco?

2. Se dados estão no banco mas não aparecem no app:
   → Verificar RLS: as políticas estão corretas?
   → SQL: SELECT * FROM pacientes WHERE terapeuta_id = '[id]';

3. Se dados não estão no banco:
   → Supabase tem backup automático diário
   → Supabase Dashboard → Database → Backups → Restaurar point-in-time

Ação preventiva: Implementar soft-delete (campo deleted_at) na Fase 2.
```

## 9.6 Procedimento de Contingência: App Fora do Ar

```
Cenário A: Vercel fora do ar
→ Aguardar resolução (status.vercel.com)
→ Opção: fazer redeploy em provider alternativo (Netlify/Cloudflare Pages)
   com as mesmas variáveis de ambiente

Cenário B: Supabase fora do ar
→ App exibe mensagem de erro de conexão
→ Usuários podem continuar usando as funcionalidades mock/demo
→ Dados não são perdidos (ficam no banco, offline apenas)
→ Aguardar resolução (status.supabase.com)

Cenário C: Gemini API fora do ar
→ Botão "Gerar plano" exibe mensagem de erro
→ Terapeuta pode criar sessões e planos manualmente
→ Sem impacto em dados existentes
```

---

# 10. Playbooks de Engenharia

## 10.1 Padrões de Código

### Nomenclatura

```javascript
// Componentes React: PascalCase
const TelaHistorico = ({ paciente }) => { ... }

// Funções: camelCase
const handleSalvarTarefa = () => { ... }
const buscarPlano = async (pacienteId) => { ... }

// Constantes globais: SCREAMING_SNAKE_CASE
const BANCO_PALAVRAS = { ... }
const DISTORCOES_TCC = [...]

// Estados: [nome, setNome]
const [paciente, setPaciente] = useState(null)

// Seções no arquivo: comentário padronizado
// ─── NOME DA SEÇÃO ───────────────────────────────────────────
```

### Estilo de Componente

```jsx
// Sempre: props desestruturadas + defaults explícitos
const MeuComponente = ({ paciente, isMobile = false, onSalvar }) => {
  // 1. Hooks (todos antes de qualquer return condicional)
  const [estado, setEstado] = useState(null);

  // 2. Effects
  useEffect(() => { ... }, [paciente.id]);

  // 3. Handlers
  const handleClick = () => { ... };

  // 4. Early returns (loading, error, empty states)
  if (!paciente) return null;

  // 5. Render principal
  return (
    <div style={{ ... }}>
      ...
    </div>
  );
};
```

### Estilo Inline

```jsx
// Padrão para blocos com muitas propriedades
<div style={{
  background: "#fff",
  border: "1px solid #f1f5f9",
  borderRadius: 12,
  padding: "18px 20px"
}}>

// Padrão para estilos condicionais
<span style={{
  color: ativo ? "#4f46e5" : "#64748b",
  fontWeight: ativo ? 700 : 500
}}>
```

### Paleta de Cores (sistema)

```
Background: #f8fafc
Texto principal: #0f172a
Texto secundário: #64748b
Texto terciário: #94a3b8
Bordas: #f1f5f9 / #e2e8f0
Primária (indigo): #6366f1
Info (azul): #0ea5e9
Sucesso (verde): #10b981
Warning (amarelo): #f59e0b
Rosa: #ec4899
Roxo: #8b5cf6
Erro (vermelho): #ef4444 / #dc2626
```

## 10.2 Padrões de Serviços

```javascript
// Todo serviço segue o padrão:
export async function nomeServico(params) {
  if (!hasSupabase) return { data: null, error: null };  // guard obrigatório

  const { data, error } = await supabase
    .from('tabela')
    .select('...')
    .eq('campo', valor);

  return { data, error };  // sempre retorna o mesmo shape
}
```

## 10.3 Padrões de Adição de Novas Telas

1. Criar componente antes do `App` principal no arquivo
2. Adicionar ao array de abas ou à lógica de roteamento
3. Seguir a nomenclatura `Tela[Nome]`
4. Receber `paciente` como prop quando necessário
5. Testar no modo demo (sem Supabase) antes de integrar

## 10.4 Padrões de Migração de Banco

1. Criar arquivo em `copiloto-vite/supabase/[descricao_curta].sql`
2. Usar `IF NOT EXISTS` / `IF EXISTS` em todas as operações
3. Incluir comentário explicativo no topo do arquivo
4. Executar em ambiente de teste antes de produção
5. Documentar no commit e neste arquivo

## 10.5 Como Adicionar Nova Abordagem Terapêutica

1. Adicionar entrada em `BANCO_PALAVRAS` com `label`, `cor`, `categorias`
2. Adicionar entrada em `LABELS_POR_LINHA` com `perguntas` e `material`
3. Adicionar entrada em `CAMPOS_POR_LINHA` com `campos`, `placeholder_evolucao`, `placeholder_tarefa`
4. Testar no TelaMural (seletor de linha), TelaHistorico (badge), TelaPlano (labels)

---

# 11. Manual do Usuário Final

## 11.1 Primeiros Passos

### Cadastro
1. Acesse https://copiloto-vite.vercel.app
2. Clique em "Criar conta"
3. Informe seu e-mail e uma senha segura
4. Confirme o e-mail se solicitado
5. Complete seu perfil em **Configurações** (nome, CRP, telefone)

### Tela Inicial (Visão Geral)
Ao fazer login, você verá o **Dashboard** com:
- **Pacientes cadastrados / Ativos (30 dias)**
- **Sessões hoje / esta semana**
- **Pacientes usando o app do paciente**
- **Status dos planos** (A iniciar / Proposto / Confirmado)
- **Lista de pendências** — pacientes com plano ainda não confirmado

## 11.2 Gerenciando Pacientes

### Criar Paciente
1. Menu esquerdo → **Pacientes** → **+ Novo paciente**
2. Preencha nome, queixa, diagnóstico, linha terapêutica e nível de risco
3. Clique em **Salvar**

### Selecionar Paciente
- Clique no nome do paciente na lista lateral
- O cabeçalho superior mostrará o nome e número de sessão atual
- As abas (Histórico, Mural, Plano, Importar, Insights, Perfil) ficam disponíveis

### Editar / Excluir Paciente
1. Selecione o paciente → aba **Perfil**
2. Clique em **Editar dados**
3. Modifique os campos desejados → **Salvar alterações**
4. Para excluir: botão vermelho **Excluir paciente** (ação irreversível)

## 11.3 Registrando Sessões

### Via Importação (recomendado)
1. Aba **Importar** com o paciente selecionado
2. Cole suas anotações brutas da sessão na caixa de texto
3. Clique **Processar com IA**
4. Revise os campos extraídos (resumo, temas, distorções, técnicas, emoções)
5. Ajuste o que for necessário
6. Clique **Salvar sessão**

### Resultado da Importação
A sessão aparecerá na aba **Histórico** com:
- Número e data da sessão
- Resumo narrativo
- Temas identificados
- Distorções cognitivas
- Técnicas aplicadas
- Emoções com intensidade
- Alertas clínicos (se identificados)

## 11.4 Planejando a Próxima Sessão

### Gerar Plano com IA
1. Aba **Plano** com o paciente selecionado
2. (Requer pelo menos uma sessão registrada)
3. Clique **Gerar plano com IA**
4. Aguarde ~5-10 segundos
5. Revise o plano gerado:
   - Objetivo da sessão
   - Perguntas socráticas
   - Técnicas sugeridas
   - Tarefa de casa
   - Observações clínicas

### Editar o Plano
- Clique **Editar** ao lado de qualquer campo
- Modifique o conteúdo
- Clique **Salvar** para confirmar a edição

### Confirmar o Plano
- Após revisar tudo, clique **✓ Salvar e confirmar plano**
- O status muda para "Confirmado" no Dashboard
- O plano confirmado fica marcado com verde

### Enviar Tarefa para o App do Paciente
1. Na seção "App do paciente" dentro da aba Plano
2. A tarefa de casa aparece automaticamente
3. Clique **📤 Enviar tarefa**
4. O paciente receberá a tarefa no app móvel

## 11.5 Usando o Mural de Palavras

1. Aba **Mural** com o paciente selecionado
2. Selecione a abordagem terapêutica (já pré-selecionada com a do paciente)
3. Clique nas palavras do banco para selecioná-las
4. Use **Busca** para encontrar termos específicos
5. Alterne entre **Mural livre** e **Por categorias** conforme preferência
6. Adicione termos personalizados no campo "+ Adicionar"
7. Com palavras selecionadas, clique **🤖 Organizar com IA** para agrupamento automático

## 11.6 Agenda

### Agendar Sessão
1. Menu esquerdo → **Agenda** → **Hoje / Amanhã** ou **Calendário**
2. Botão **+ Agendar** (canto superior direito)
3. Selecione o paciente, data, horário e tipo
4. Para recorrência: escolha frequência (semanal, quinzenal, mensal)
5. Clique **Agendar**

### Gerenciar Agendamentos
- Calendário: clique no agendamento para editar ou cancelar
- Hoje / Amanhã: lista de sessões do dia com status

## 11.7 Convidando o Paciente para o App

1. Selecione o paciente → aba **Perfil**
2. Na seção "App do paciente", clique **Gerar link de convite**
3. Copie o link gerado
4. Envie ao paciente por WhatsApp, e-mail, etc.
5. O paciente clica no link, cria conta e tem acesso automático

## 11.8 Configurações do Perfil

1. Menu esquerdo → **Configurações** (ícone ⚙️ na base do menu)
2. Atualize: Nome completo, Telefone, CRP
3. O e-mail não pode ser alterado por aqui
4. Clique **Salvar alterações**

## 11.9 Solução de Problemas Comuns

| Problema | Solução |
|---|---|
| "Erro ao gerar plano" | Verifique sua conexão; tente novamente em alguns segundos |
| Paciente não aparece na lista | Verifique se está logado com a conta correta |
| Sessão desaparece ao trocar de paciente | Bug conhecido corrigido; atualize a página se ocorrer |
| App do paciente não recebe a tarefa | Verifique se o convite foi aceito e o paciente tem conta ativa |
| Calendário não mostra agendamentos | Verifique o range de datas — padrão é 1 mês atrás + 3 meses à frente |
| Plano não aparece no Dashboard | Execute a migração `dashboard_planos_status.sql` no Supabase |

---

# 12. Guia de Treinamento para o Cliente

## 12.1 Entendendo o Sistema

O Copiloto Terapeuta é uma ferramenta de suporte ao trabalho clínico. Ele **não substitui o julgamento clínico** — todos os dados gerados pela IA são sugestões que o terapeuta deve revisar e validar antes de usar.

### O que a IA faz:
- Extrai dados estruturados de anotações de texto livre
- Gera sugestões de plano clínico baseadas no histórico do paciente
- Agrupa palavras-chave por categoria terapêutica

### O que a IA NÃO faz:
- Tomar decisões clínicas
- Substituir avaliação diagnóstica formal
- Garantir precisão clínica sem revisão do profissional

## 12.2 Responsabilidades do Cliente (Terapeuta)

| Responsabilidade | Descrição |
|---|---|
| **Precisão dos dados** | O terapeuta é responsável por revisar e validar todos os dados extraídos pela IA antes de salvar |
| **Confidencialidade** | Não compartilhar credenciais de acesso; cada terapeuta tem conta própria |
| **Backup de dados** | Dados ficam no Supabase; recomendado exportar periodicamente quando disponível |
| **Uso ético** | Dados de pacientes são sensíveis; não usar a plataforma fora do contexto clínico |
| **Convites de pacientes** | Gerar convites apenas para pacientes reais em acompanhamento ativo |
| **Atualização de perfil** | Manter CRP e dados de contato atualizados |

## 12.3 O que o Sistema NÃO faz (limites importantes)

- **Não é prontuário eletrônico oficial**: Não substitui o prontuário exigido pelo CFP.
- **Não garante LGPD por si só**: O cliente é o controlador dos dados dos seus pacientes; usar a plataforma com responsabilidade.
- **Não faz cobrança**: Financeiro do consultório não está integrado.
- **Não faz laudos**: Documentos clínicos formais devem ser gerados pelo terapeuta.
- **Não monitora crises em tempo real**: O app do paciente não envia alertas automáticos por notificação push em crises.

## 12.4 Boas Práticas de Uso

1. **Mantenha sessões atualizadas**: Registre ou importe cada sessão no mesmo dia ou no máximo no dia seguinte — a memória é mais precisa.

2. **Revise sempre o plano gerado**: A IA não conhece nuances da relação terapêutica. Sempre adapte o plano ao que você conhece do paciente.

3. **Use o Mural durante a sessão**: Ter o mural aberto durante a sessão ajuda a capturar vocabulário clínico em tempo real.

4. **Confirme os planos revisados**: O status "Confirmado" no Dashboard indica que o plano passou pelo seu olhar crítico — isso serve como registro de revisão.

5. **Gerencie convites com cuidado**: Um convite dá acesso ao app do paciente. Revogue convites de pacientes que encerraram o acompanhamento.

6. **Monitore o Dashboard semanalmente**: A visão geral do consultório ajuda a identificar pacientes que precisam de atenção especial.

---

# 13. Matriz RACI

**R** = Responsável (executa) | **A** = Aprovador (decide) | **C** = Consultado | **I** = Informado

## 13.1 Responsabilidades por Atividade

| Atividade | Terapeuta | Desenvolvedor | Supabase | Vercel | Google AI |
|---|---|---|---|---|---|
| Cadastro de paciente | **R/A** | — | I | — | — |
| Registro de sessão | **R/A** | — | I | — | — |
| Geração de plano IA | R | — | — | — | **A** |
| Revisão e confirmação do plano | **R/A** | — | — | — | I |
| Envio de tarefa ao paciente | **R/A** | — | I | — | — |
| Gestão de convites | **R/A** | — | I | — | — |
| Deploy de nova versão | I | **R/A** | — | **A** | — |
| Migração de banco de dados | I | **R/A** | **A** | — | — |
| Manutenção da infraestrutura | I | C | **R/A** | **R/A** | **R/A** |
| Monitoramento de disponibilidade | I | **R** | R | R | — |
| Backup de dados | I | I | **R/A** | — | — |
| Atualização de variáveis de ambiente | I | **R/A** | — | R | — |
| Gestão da chave da IA | I | **R/A** | — | I | — |
| Compliance LGPD | **A** | C | C | — | — |
| Treinamento de novos usuários | I | **A/R** | — | — | — |

## 13.2 Responsabilidades por Dado

| Dado | Controlador | Processador | Armazenamento |
|---|---|---|---|
| Dados de pacientes | **Terapeuta** | Sistema | Supabase |
| Credenciais de acesso | **Terapeuta** | Supabase Auth | Supabase |
| Planos gerados por IA | **Terapeuta** | Google AI | Supabase |
| Registros do app (paciente) | **Paciente** | Sistema | Supabase |
| Código-fonte | **Desenvolvedor** | — | Git / Vercel |

---

# 14. Glossário Técnico

| Termo | Definição |
|---|---|
| **BaaS** | Backend-as-a-Service — provedor que oferece banco de dados, autenticação e APIs sem servidor próprio (ex: Supabase) |
| **JWT** | JSON Web Token — token assinado usado para autenticar requisições sem estado de sessão no servidor |
| **RLS** | Row Level Security — políticas no banco de dados que restringem quais linhas cada usuário pode ver/modificar |
| **SPA** | Single Page Application — aplicação que roda inteiramente no browser, sem recarregamento de página |
| **PWA** | Progressive Web App — aplicativo web com capacidades offline e instalação no celular |
| **CDN** | Content Delivery Network — rede global de servidores que distribui o app estaticamente com baixa latência |
| **Prompt** | Instrução textual enviada à IA para guiar a geração de resposta |
| **LLM** | Large Language Model — modelo de linguagem de grande escala (ex: Gemini, GPT) |
| **Gemini** | Modelo de linguagem da Google usado para geração de planos e extração de sessões |
| **ABCD** | Registro cognitivo: **A** (situação Ativadora) → **B** (crença/pensamento) → **C** (consequência emocional) → **D** (resposta racional) |
| **TCC** | Terapia Cognitivo-Comportamental — abordagem terapêutica baseada na relação entre pensamentos, emoções e comportamentos |
| **CRP** | Conselho Regional de Psicologia — registro profissional obrigatório para psicólogos no Brasil |
| **CFP** | Conselho Federal de Psicologia — órgão regulador máximo da psicologia no Brasil |
| **LGPD** | Lei Geral de Proteção de Dados — lei brasileira que regula o tratamento de dados pessoais |
| **Plano de sessão** | Documento estruturado preparado antes da sessão com objetivo, técnicas, perguntas e tarefa de casa |
| **Distorção cognitiva** | Padrão de pensamento disfuncional identificado na TCC (ex: catastrofização, leitura mental) |
| **Linha terapêutica** | Abordagem teórica usada pelo terapeuta (TCC, Psicanálise, Gestalt, etc.) |
| **Risco clínico** | Nível de atenção especial requerido para o paciente: baixo / médio / alto |
| **Convite** | Link único enviado pelo terapeuta que permite ao paciente acessar o app do paciente |
| **Terapeuta ID** | UUID do terapeuta no Supabase Auth, usado como chave em todas as tabelas |
| **Mock/Demo** | Modo de operação sem banco de dados real, com dados simulados para demonstração |
| **Trigger** | Código executado automaticamente pelo banco em resposta a um evento (INSERT, UPDATE) |
| **Cascade delete** | Quando um registro é excluído, os registros relacionados também são excluídos automaticamente |
| **UUID** | Identificador universalmente único — formato padrão para chaves primárias no sistema |
| **normalizeAIPlano** | Função que converte a resposta bruta da IA no formato interno do componente TelaPlano |
| **hasSupabase** | Variável booleana que indica se as credenciais do Supabase estão configuradas |
| **Status de plano** | Estado de revisão do plano: a_iniciar / proposto / confirmado |

---

# 15. Roadmap e Backlog Inicial

## 15.1 Releases Planejadas

### Release 1.0 — MVP ✅ (Atual)
- Autenticação completa
- Gestão de pacientes
- Histórico de sessões
- Importação via IA
- Plano de sessão com IA
- Envio de tarefa ao app do paciente
- App do paciente (PWA)
- Agenda e calendário
- Mural de palavras
- Insights e análise de padrões
- Dashboard de visão geral
- Status de planos (a_iniciar/proposto/confirmado)
- Configurações do terapeuta
- Suporte a 6 abordagens terapêuticas

### Release 1.1 — Qualidade e UX ✅ (Concluída — 2026-05-26)
- ✅ Proxy serverless para Gemini API + Claude fallback (`api/gemini.js`)
- ✅ Soft-delete de pacientes (campo `deleted_at` + restauração em 30 dias)
- ✅ Log de auditoria de alterações clínicas (tabela `audit_log` + triggers)
- ✅ Exportação de dados (JSON/CSV) — conformidade LGPD Art. 18 (portabilidade)
- ✅ Notificações push no app do paciente (VAPID + `push_subscriptions`)
- ✅ Onboarding guiado para novos terapeutas (5 steps, `onboarding_concluido`)
- ✅ Conquistas no app do paciente (desbloqueio por marcos)
- ✅ IA aprende edições do terapeuta nos planos (US-03, `buscarPlanosEditados`)
- ✅ Alerta de humor: badge quando paciente sem registro ≥ 3 dias (US-06)
- ✅ Ícones PWA válidos (192×192 e 512×512 PNG)
- ✅ Política de Privacidade e Termos de Uso (LGPD, vinculados no login)
- ⏳ Testes automatizados (unit + integration) — adiado para Release 2.0

---

### Sprint C — Quick Wins (incluída na v1.1)

| Item | Descrição | Status |
|---|---|---|
| Ícone PWA manifest | Geração de ícones válidos 192×512 px para `copiloto-paciente` | ✅ |
| Alerta de humor (US-06) | Badge ⚠️ na lista de pacientes quando ≥ 3 dias sem registro; sentinela 999 para sem registros | ✅ |
| IA aprende estilo (US-03) | `buscarPlanosEditados()` + `montarEstiloTerapeuta()` injetados no prompt de geração | ✅ |

### Sprint B — Beta Readiness (incluída na v1.1)

| Item | Descrição | Status |
|---|---|---|
| Documentos legais | `POLITICA_PRIVACIDADE.md` + `TERMOS_DE_USO.md` em `/public`; links no login de ambos os apps | ✅ |
| Onboarding guiado | Modal 5 steps ao primeiro login; `onboarding_concluido` persiste no banco; Pular/Concluir marcam como visto | ✅ |

---

### Release 1.2-beta — Correções e Fluxos de Onboarding (2026-05-26)

| Item | Descrição | Status |
|---|---|---|
| Bug fix: isolamento de dados demo | `useState(hasSupabase ? [] : PACIENTES)` — terapeutas autenticados não veem mais os pacientes simulados hardcoded; modo demo continua funcional sem Supabase | ✅ |
| Empty state de pacientes | Quando lista de pacientes está vazia (terapeuta novo autenticado), exibe botão "+ Adicionar primeiro paciente" centralizado em vez de lista em branco | ✅ |
| Fluxo "Já possui histórico" no cadastro | Ao criar paciente com a opção "Já possui histórico", o sistema navega automaticamente para a aba Importar do novo paciente. Implementado via estado `abaParaNavegar` + `useEffect([paciente?.id, abaParaNavegar])` para evitar override pelo reset de aba | ✅ |
| Bug fix: reset de estado ao trocar de usuário | `prevUid` ref em `onAuthStateChange` — ao fazer logout/login com conta diferente, estado de pacientes é completamente zerado, evitando vazamento de dados entre sessões de terapeutas distintos | ✅ |
| Bug fix: novo terapeuta → Configurações antes do Onboarding | Ao logar pela primeira vez, novo terapeuta é redirecionado para Configurações para completar perfil (nome, CRP); onboarding guiado abre em seguida via modal | ✅ |
| Modelo Gemini atualizado para `gemini-1.5-flash` | `gemini-2.0-flash` e `gemini-2.0-flash-lite` retornam 404 para novos usuários/projetos. Constante `GEMINI_MODEL` em `ia.js` e fallback em `api/gemini.js` atualizados para `gemini-1.5-flash` (estável) | ✅ |
| Fix texto onboarding step 4 | Label do step 4 do onboarding corrigido de "Plano" para "Próx. sessão" para refletir o nome real da aba na interface | ✅ |
| Bug fix: form de criação de paciente cobre tela de sucesso | Condição de renderização do modal corrigida de `passoCriar !== "sucesso"` para `!passoCriar` — o form agora fecha completamente ao entrar no estado de sucesso ("importar" ou "sucesso"), sem sobrepor a tela de confirmação | ✅ |

---

### Release 2.0 — Inteligência Longitudinal ✅ (Entregue — 2026-05-27)

| Item | Descrição | Status |
|---|---|---|
| US-01: Contexto multi-sessão | `gerarPlanoSessao` aceita janela de 1/3/4/5 sessões (configurável por terapeuta); prompt longitudinal com padrões, humor e adesão acumulados | ✅ |
| US-04: Exportação de plano em PDF | `exportarPlanoPDF()` via jsPDF + html2canvas; logo Vinculi, paleta da marca, paginação automática; botão "⬇ PDF" em TelaPlano | ✅ |
| Dashboard avançado (Recharts) | TelaInsights: LineChart (humor início vs. fim), BarChart horizontal (top 6 distorções), AreaChart (adesão acumulada), 4 cards de métricas | ✅ |
| Análise Clínica Longitudinal | Geração sob demanda via IA (todas as sessões); cache inteligente por sessoes_count; 5 seções de análise; feature flag acesso_analise_longitudinal | ✅ |
| janela_contexto por terapeuta | Campo `janela_contexto` em terapeutas; seletor 1/3/4/5 em TelaConfiguracoes; badge contextual em TelaPlano | ✅ |

**Bugs corrigidos na Release 2.0:**

| Bug | Correção |
|---|---|
| Tabs do paciente travadas | Hover popover com z-index inferior à nav bar |
| registros_abcd 400 Bad Request | Coluna `created_at` renomeada para `criado_em` |
| Gemini modelo descontinuado | `gemini-1.5-flash` → `gemini-2.5-flash` |
| hoverPaciente não resetado ao selecionar paciente | State limpo no handler de seleção |
| acesso_analise_longitudinal null tratado como false | Gate corrigido: apenas `=== false` bloqueia; null libera |

### Release 2.1 — Próxima

| Item | Descrição | Prioridade |
|---|---|---|
| US-14: Google Calendar | Sincronização via OAuth Google; requer VITE_GOOGLE_CLIENT_ID | Baixa |
| US-16: Relatório clínico PDF completo | PDF com gráficos de humor, distorções frequentes, histórico de sessões | Média |
| Validação clínica | Retorno Dra. Ana Clara sobre US-01 e Análise Longitudinal | Alta |

---

### Release 3.0 — Plataforma
- Multi-tenancy (clínicas com múltiplos terapeutas)
- Supervisor clínico com acesso de leitura
- Módulo financeiro básico (controle de sessões pagas)
- Conformidade com CFP para prontuário eletrônico
- Suporte a idiomas (EN, ES)

## 15.2 Backlog de Histórias de Usuário

### Épico: Planos e IA

| ID | História | Critérios de Aceite | Prioridade |
|---|---|---|---|
| US-01 | Como terapeuta, quero que a IA considere as últimas 3 sessões ao gerar o plano | Plano gerado menciona padrões recorrentes; contexto de 3 sessões visível no prompt | ✅ v2.0 |
| US-02 | Como terapeuta, quero salvar templates de plano reutilizáveis | Templates persistidos; selecionáveis ao gerar novo plano; editáveis | Média |
| US-03 | Como terapeuta, quero que o sistema aprenda minhas edições e reflita no próximo plano | Edições registradas; próximo plano para o mesmo paciente incorpora padrão | ✅ v1.1 |
| US-04 | Como terapeuta, quero exportar o plano em PDF para imprimir | PDF gerado com cabeçalho do terapeuta, dados do paciente e plano formatado | ✅ v2.0 |

### Épico: Paciente e Engajamento

| ID | História | Critérios de Aceite | Prioridade |
|---|---|---|---|
| US-05 | Como paciente, quero receber notificação push quando uma nova tarefa é enviada | Push notification via PWA; funciona em Android e iOS | Alta |
| US-06 | Como terapeuta, quero ver um alerta quando o paciente não registrou humor em 3 dias | Badge de alerta no card do paciente na lista; detalhado em TelaHistorico | Média |
| US-07 | Como paciente, quero ver meu progresso em gráfico de humor dos últimos 30 dias | Gráfico de linha visível no app do paciente; dados de humor_diario | Média |
| US-08 | Como terapeuta, quero enviar uma mensagem motivacional ao paciente pelo app | Campo de mensagem na tarefa; notificação push; exibida no app | Baixa |

### Épico: Segurança e Conformidade

| ID | História | Critérios de Aceite | Prioridade |
|---|---|---|---|
| US-09 | Como operador, quero que a chave Gemini não fique exposta no bundle JS | Proxy serverless implementado; chave não aparece no bundle | Alta |
| US-10 | Como terapeuta, quero log de tudo que foi alterado em dados de pacientes | Tabela `audit_log` com who/what/when; consulta no Dashboard | Alta |
| US-11 | Como terapeuta, quero exportar todos os dados de um paciente em JSON | Export disponível na aba Perfil; inclui sessões, planos, tarefas | Média |
| US-12 | Como terapeuta, quero deletar um paciente com soft-delete recuperável | `deleted_at` não nulo oculta paciente; opção de restaurar em 30 dias | Média |

### Épico: Agenda e Workflow

| ID | História | Critérios de Aceite | Prioridade |
|---|---|---|---|
| US-13 | Como terapeuta, quero que ao confirmar um agendamento o paciente receba confirmação | E-mail ou notificação enviada ao paciente quando status muda para 'confirmado' | Média |
| US-14 | Como terapeuta, quero sincronizar a agenda com Google Calendar | OAuth Google; agendamentos criados no app aparecem no Google Calendar | Baixa |
| US-15 | Como terapeuta, quero bloquear horários na agenda (sem paciente) | Agendamento do tipo 'bloqueado' sem paciente associado | Média |

### Épico: Relatórios e Insights

| ID | História | Critérios de Aceite | Prioridade |
|---|---|---|---|
| US-16 | Como terapeuta, quero exportar relatório de evolução do paciente em PDF | PDF com gráficos de humor, distorções frequentes, histórico de sessões | Média |
| US-17 | Como terapeuta, quero ver estatísticas mensais do consultório | Dashboard com: sessões por mês, pacientes novos, taxa de adesão | Baixa |
| US-18 | Como terapeuta, quero receber alerta quando a distorção X aparece em 3 sessões consecutivas | Alerta automático na TelaInsights; badge no card do paciente | Média |

---

*Documentação atualizada em 2026-05-27. Atualizar a cada release.*  
*Versão deste documento: 2.0 — correspondente à Release 2.0 (estável em produção).*

---

## Índice Detalhado (links internos)

| # | Documento | Seção |
|---|---|---|
| 1 | Visão Geral da Solução | [→](#1-visão-geral-da-solução) |
| 1.1 | Objetivo do Sistema | [→](#11-objetivo-do-sistema) |
| 1.2 | Problema que Resolve | [→](#12-problema-que-resolve) |
| 1.3 | Público-Alvo | [→](#13-público-alvo) |
| 1.4 | Escopo Funcional | [→](#14-escopo-funcional) |
| 1.5 | Escopo Não Funcional | [→](#15-escopo-não-funcional) |
| 2 | Arquitetura da Solução | [→](#2-arquitetura-da-solução) |
| 2.3 | Fluxos Principais | [→](#23-fluxos-principais) |
| 2.4 | Componentes e Responsabilidades | [→](#24-componentes-e-responsabilidades) |
| 3 | ADRs | [→](#3-adrs--architecture-decision-records) |
| 4 | Design Doc | [→](#4-design-doc-completo) |
| 4.2 | Estrutura de Dados | [→](#42-estrutura-de-dados) |
| 5 | APIs e Serviços | [→](#5-documentação-de-apis-e-serviços) |
| 6 | Banco de Dados | [→](#6-documentação-de-banco-de-dados) |
| 6.2 | Dicionário de Dados | [→](#62-dicionário-de-dados) |
| 7 | Segurança | [→](#7-documentação-de-segurança) |
| 7.2 | RLS | [→](#72-autorização--row-level-security) |
| 8 | DevOps / CI/CD | [→](#8-documentação-de-devops--cicd) |
| 9 | Runbooks | [→](#9-runbooks-operacionais) |
| 10 | Playbooks de Engenharia | [→](#10-playbooks-de-engenharia) |
| 11 | Manual do Usuário | [→](#11-manual-do-usuário-final) |
| 12 | Guia de Treinamento | [→](#12-guia-de-treinamento-para-o-cliente) |
| 13 | Matriz RACI | [→](#13-matriz-raci) |
| 14 | Glossário | [→](#14-glossário-técnico) |
| 15 | Roadmap e Backlog | [→](#15-roadmap-e-backlog-inicial) |
