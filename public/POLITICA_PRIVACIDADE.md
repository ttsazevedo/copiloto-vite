# Política de Privacidade — Vinculi / Copiloto Terapeuta

**Vigência:** 26 de maio de 2026  
**Versão:** 1.0

---

## 1. Quem somos

A **Vinculi** ("nós") é a operadora da plataforma Copiloto Terapeuta, ferramenta de suporte clínico digital para psicólogos e seus pacientes ("plataforma"). Nesta relação, o **terapeuta** atua como controlador dos dados de seus pacientes; a Vinculi atua como **operadora** nos termos do Art. 5º, VII da Lei 13.709/2018 (LGPD).

---

## 2. Dados coletados e finalidade

| Categoria | Dados | Finalidade |
|-----------|-------|------------|
| **Autenticação** | E-mail, senha (hash), token de sessão | Identificação e acesso seguro à plataforma |
| **Perfil do terapeuta** | Nome, CRP, telefone, especialidade | Personalização e identificação profissional |
| **Prontuário clínico** | Resumos de sessões, temas, distorções cognitivas, técnicas utilizadas, planos terapêuticos, tarefas | Suporte ao acompanhamento clínico longitudinal do paciente |
| **Registro de humor** | Data, valor numérico (1–10), nota opcional | Monitoramento de bem-estar entre sessões |
| **Registros ABCD** | Situação, emoção, pensamento automático, intensidade, resposta racional | Prática de técnicas de TCC e registro clínico |
| **Dados de uso** | Logs de acesso, timestamps de operações | Segurança, auditoria e conformidade LGPD (Art. 37) |
| **Notificações push** | Endpoint de assinatura do dispositivo | Envio de notificações sobre novas tarefas terapêuticas |

---

## 3. Base legal para tratamento de dados sensíveis de saúde

Os dados clínicos acima constituem **dados pessoais sensíveis** nos termos do Art. 5º, II da LGPD. Seu tratamento fundamenta-se em:

- **Art. 11, I — Consentimento** do titular, fornecido de forma livre, informada e inequívoca no momento do primeiro acesso ao aplicativo do paciente;
- **Art. 11, II, "f" — Exercício regular de direito** pelo profissional de psicologia no cumprimento de suas obrigações deontológicas (CFP, Resolução 09/2024 — prontuário eletrônico);
- **Art. 11, II, "b" — Obrigação legal** decorrente das normas do Conselho Federal de Psicologia que exigem manutenção de prontuário.

---

## 4. Prazo de retenção

| Dado | Prazo | Fundamento |
|------|-------|------------|
| Prontuário clínico (sessões, planos, registros) | **20 anos** após o encerramento do atendimento | Resolução CFP 09/2024, Art. 12 |
| Registros de humor e ABCD | **20 anos** (integram o prontuário) | Idem |
| Dados de autenticação | Até 90 dias após exclusão da conta | Segurança e auditoria |
| Logs de acesso | 6 meses | Art. 15 da Lei 12.965/2014 (Marco Civil) |
| Dados de push notification | Até revogação pelo titular ou exclusão da conta | — |

Pacientes arquivados pelo terapeuta são mantidos por **30 dias** em estado recuperável antes da exclusão definitiva.

---

## 5. Direitos do titular (Art. 18 LGPD)

O titular dos dados (paciente ou terapeuta) tem direito a:

1. **Confirmação** da existência de tratamento;
2. **Acesso** aos seus dados;
3. **Correção** de dados incompletos ou desatualizados;
4. **Anonimização, bloqueio ou eliminação** de dados desnecessários;
5. **Portabilidade** dos dados a outro serviço ou fornecedor;
6. **Eliminação** dos dados tratados com base em consentimento;
7. **Informação** sobre compartilhamentos realizados;
8. **Revogação do consentimento** a qualquer tempo.

### Como exercer seus direitos

- **Exportação (portabilidade):** disponível diretamente na plataforma via botão "Exportar dados" no perfil do paciente (formatos JSON e CSV);
- **Correção e exclusão:** enviar solicitação para **thiagoazevedo@hotmail.com**;
- **Revogação de consentimento:** o paciente pode revogar notificações push nas configurações do dispositivo; para revogar o acesso aos dados clínicos, solicitar ao terapeuta responsável ou diretamente à Vinculi.

---

## 6. Compartilhamento com terceiros

A Vinculi não vende dados pessoais. Os dados são compartilhados apenas com os seguintes **suboperadores** (processadores), todos vinculados por contratos de proteção de dados:

| Suboperador | País sede | Finalidade | Documentação |
|-------------|-----------|------------|--------------|
| **Supabase Inc.** | EUA | Banco de dados, autenticação, armazenamento | [DPA Supabase](https://supabase.com/privacy) |
| **Google LLC (Gemini API)** | EUA | Geração de planos terapêuticos pela IA | [Política Google](https://policies.google.com/privacy) |
| **Anthropic PBC (Claude API)** | EUA | Geração de planos terapêuticos (fallback IA) | [Política Anthropic](https://www.anthropic.com/privacy) |
| **Vercel Inc.** | EUA | Hospedagem da plataforma web | [Política Vercel](https://vercel.com/legal/privacy-policy) |

**Transferência internacional:** os suboperadores acima estão localizados nos EUA. A transferência baseia-se em **cláusulas contratuais padrão** e nas garantias de adequação previstas no Art. 33 da LGPD.

**Importante:** conteúdo de sessões clínicas enviado para as APIs de IA (Gemini/Claude) é processado para geração do plano e **não é usado para treinamento dos modelos** conforme contratos de API enterprise.

---

## 7. Segurança

Adotamos as seguintes medidas técnicas e organizacionais:

- Criptografia em trânsito (TLS 1.3) e em repouso (AES-256, Supabase);
- Autenticação com tokens JWT de curta duração;
- Row Level Security (RLS) no banco de dados: cada terapeuta acessa apenas seus próprios dados;
- Log de auditoria de todas as operações sensíveis (INSERT/UPDATE/DELETE);
- Acesso administrativo restrito ao Service Role Key, nunca exposto ao cliente.

---

## 8. Cookies e rastreamento

A plataforma utiliza apenas:

- **Cookies de sessão** (autenticação, expiração automática);
- **Service Worker** (PWA, cache local para funcionamento offline).

Não utilizamos cookies de rastreamento publicitário ou analytics de terceiros.

---

## 9. Crianças e adolescentes

A plataforma não é destinada a menores de 18 anos como usuários diretos (terapeutas). Dados de pacientes menores podem ser tratados apenas mediante consentimento do responsável legal, conforme Art. 14 da LGPD.

---

## 10. Contato e DPO

**Encarregado de Dados (DPO):**  
thiagoazevedo@hotmail.com  
Vinculi — Copiloto Terapeuta  
São Paulo, SP — Brasil

Respondemos solicitações de titulares em até **15 dias úteis**.

---

## 11. Alterações nesta Política

Notificaremos alterações relevantes por e-mail e/ou aviso na plataforma com antecedência mínima de 15 dias. O uso continuado após a vigência da nova versão implica concordância.

---

*Última atualização: 26 de maio de 2026*
