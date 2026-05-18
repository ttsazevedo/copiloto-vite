import { supabase, hasSupabase } from './supabase.js';

export async function criarTarefa({ paciente_id, sessao_id, terapeuta_id, descricao, tipo_formulario = 'abcd', prazo }) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('tarefas')
    .insert({ paciente_id, sessao_id, terapeuta_id, descricao, tipo_formulario, prazo, status: 'pendente' })
    .select()
    .single();
  return { data, error };
}

export async function listarTarefas(pacienteId) {
  if (!hasSupabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('tarefas')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: false });
  return { data: data ?? [], error };
}

export async function atualizarTarefa(id, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('tarefas')
    .update(campos)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

// Notifica o terapeuta em tempo real quando o paciente envia um novo registro ABCD
export function inscreverEmRegistros(pacienteId, callback) {
  if (!hasSupabase) return { unsubscribe: () => {} };
  const canal = supabase
    .channel(`registros-terapeuta-${pacienteId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'registros_abcd',
      filter: `paciente_id=eq.${pacienteId}`,
    }, callback)
    .subscribe();
  return { unsubscribe: () => supabase.removeChannel(canal) };
}
