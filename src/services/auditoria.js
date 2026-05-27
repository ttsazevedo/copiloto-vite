import { supabase, hasSupabase } from './supabase.js';

const LABELS_OPERACAO = { INSERT: 'Criado', UPDATE: 'Alterado', DELETE: 'Excluído' };
const LABELS_TABELA   = { sessoes: 'Sessão', planos: 'Plano', pacientes: 'Paciente' };

export function formatarEntradaLog(entrada) {
  return {
    ...entrada,
    operacaoLabel:     LABELS_OPERACAO[entrada.operacao] ?? entrada.operacao,
    tabelaLabel:       LABELS_TABELA[entrada.tabela]   ?? entrada.tabela,
    criadoEmFormatado: new Date(entrada.criado_em).toLocaleString('pt-BR'),
  };
}

export async function buscarAuditLog({ registroId, tabela, limit = 20 } = {}) {
  if (!hasSupabase) return { data: null, error: null };

  let query = supabase
    .from('audit_log')
    .select('id, tabela, operacao, registro_id, criado_em, dados_anteriores, dados_novos')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (registroId) query = query.eq('registro_id', registroId);
  if (tabela)     query = query.eq('tabela', tabela);

  const { data, error } = await query;
  return { data, error };
}

// Histórico completo de um paciente: alterações no cadastro + sessões + planos.
// 2 queries paralelas para coletar IDs, depois 1 query no audit_log.
export async function buscarAuditLogPaciente(pacienteId, limit = 10) {
  if (!hasSupabase || !pacienteId) return { data: null, error: null };

  const [{ data: sessoes }, { data: planos }] = await Promise.all([
    supabase.from('sessoes').select('id').eq('paciente_id', pacienteId),
    supabase.from('planos').select('id').eq('paciente_id', pacienteId),
  ]);

  const registroIds = [
    pacienteId,
    ...(sessoes ?? []).map(s => s.id),
    ...(planos  ?? []).map(p => p.id),
  ];

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, tabela, operacao, registro_id, criado_em, dados_anteriores, dados_novos')
    .in('registro_id', registroIds)
    .order('criado_em', { ascending: false })
    .limit(limit);

  return { data, error };
}
