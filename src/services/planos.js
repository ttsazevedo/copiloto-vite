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
  const { data, error } = await supabase
    .from('planos')
    .insert({ terapeuta_id: terapeutaId, paciente_id: pacienteId, ...campos })
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
