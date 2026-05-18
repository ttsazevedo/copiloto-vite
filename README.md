# Copiloto TCC — MVP

Copiloto clínico para psicólogos TCC. Planejamento de sessão assistido por IA.

## Requisitos

- Node.js 18 ou superior (recomendado: 20+)
- npm 9+

Verificar versão instalada:
```bash
node --version
npm --version
```

Se não tiver Node instalado: https://nodejs.org (baixar versão LTS)

---

## Rodar localmente

```bash
# 1. Instalar dependências (só na primeira vez)
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

O browser abre automaticamente.

---

## Estrutura do projeto

```
copiloto-tcc/
├── index.html          # Ponto de entrada HTML
├── vite.config.js      # Configuração do servidor local
├── package.json        # Dependências
└── src/
    ├── main.jsx        # Bootstrap React
    └── App.jsx         # Aplicação completa (MVP)
```

Todo o código do MVP está em src/App.jsx.
Dados simulados (pacientes, sessões, planos) estão no topo desse arquivo.

---

## Para editar no VS Code

```bash
# Abrir o projeto direto no VS Code
code .
```

Extensões recomendadas:
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- Auto Rename Tag

---

## Pacientes disponíveis no MVP

| Paciente | Queixa | Risco | Sessões |
|----------|--------|-------|---------|
| Mariana Costa | Ansiedade generalizada + fobia social | Baixo | 18 |
| Rafael Souza | TOC + perfeccionismo clínico | Médio | 9 |
| Beatriz Lemos | Depressão moderada + burnout | Alto ⚠️ | 26 |

---

## Funcionalidades do MVP

- [x] Lista de pacientes com alertas de risco
- [x] Histórico longitudinal por sessão
- [x] Emoções, pensamentos automáticos, distorções cognitivas
- [x] Resultado de tarefas de casa com semáforo visual
- [x] Plano de sessão gerado por IA (simulado)
- [x] Perguntas socráticas contextualizadas
- [x] Edição inline de tarefa e observações
- [x] Importação com simulação de processamento NLP
- [x] Teaser da Fase 2 (app do paciente)

---

## Fase 2 — em desenvolvimento

- App do paciente (tarefas de casa digitais)
- Check-ins de humor entre sessões
- Alertas em tempo real ao terapeuta
- Psicoeducação prescrita pelo terapeuta
