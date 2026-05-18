import { supabase, hasSupabase } from './supabase.js';

export async function listarRegistrosDoPaciente(pacienteId) {
  if (!hasSupabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('registros_abcd')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: false });
  return { data: data ?? [], error };
}

export async function listarRegistrosPorTarefa(tarefaId) {
  if (!hasSupabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('registros_abcd')
    .select('*')
    .eq('tarefa_id', tarefaId)
    .order('criado_em', { ascending: false });
  return { data: data ?? [], error };
}

export async function contarRegistrosSemana(pacienteId) {
  if (!hasSupabase) return { count: 0, error: null };
  const seteDias = new Date();
  seteDias.setDate(seteDias.getDate() - 7);
  const { count, error } = await supabase
    .from('registros_abcd')
    .select('*', { count: 'exact', head: true })
    .eq('paciente_id', pacienteId)
    .gte('criado_em', seteDias.toISOString());
  return { count: count ?? 0, error };
}

// Retorna a média de redução de intensidade emocional (antes - depois) em pontos percentuais
export async function mediaReducaoAnsiedade(pacienteId) {
  if (!hasSupabase) return { media: null, error: null };
  const { data, error } = await supabase
    .from('registros_abcd')
    .select('intensidade_antes, intensidade_depois')
    .eq('paciente_id', pacienteId)
    .not('intensidade_antes', 'is', null)
    .not('intensidade_depois', 'is', null);
  if (!data || data.length === 0) return { media: null, error };
  const total = data.reduce((acc, r) => acc + (r.intensidade_antes - r.intensidade_depois), 0);
  return { media: Math.round(total / data.length), error };
}
