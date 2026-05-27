import { supabase, hasSupabase } from './supabase.js';

export async function buscarPlano(pacienteId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data } = await supabase
    .from('planos')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data ?? null, error: null };
}

export async function salvarPlano(terapeutaId, pacienteId, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { contextoUtilizado, ...resto } = campos;
  const { data, error } = await supabase
    .from('planos')
    .insert({
      terapeuta_id: terapeutaId,
      paciente_id: pacienteId,
      ...resto,
      sessoes_contexto: contextoUtilizado || 1,
    })
    .select()
    .single();
  return { data, error };
}

export async function atualizarPlano(planoId, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('planos')
    .update({ ...campos, editado: true })
    .eq('id', planoId)
    .select()
    .single();
  return { data, error };
}

export async function confirmarPlano(planoId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('planos')
    .update({ status: 'confirmado' })
    .eq('id', planoId)
    .select()
    .single();
  return { data, error };
}

export async function buscarPlanoDaSessao(pacienteId, sessaoId, numeroSessao) {
  if (!hasSupabase) return { data: null, error: null };

  // Tentativa 1: vínculo direto pelo id da sessão de origem
  if (sessaoId) {
    const { data } = await supabase
      .from('planos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('sessao_origem_id', sessaoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { data, error: null };
  }

  // Fallback: número da sessão (planos antigos sem sessao_origem_id)
  const { data, error } = await supabase
    .from('planos')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('numero_proxima', numeroSessao)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data ?? null, error };
}

export async function buscarPlanosEditados(pacienteId, limit = 3) {
  if (!hasSupabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('planos')
    .select('tarefa, perguntas, observacoes, created_at')
    .eq('paciente_id', pacienteId)
    .eq('editado', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

export async function buscarStatusPlanosPorTerapeuta(terapeutaId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('planos')
    .select('paciente_id, status, created_at')
    .eq('terapeuta_id', terapeutaId)
    .order('created_at', { ascending: false });
  return { data, error };
}
