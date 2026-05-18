import { supabase, hasSupabase } from './supabase.js';

export async function listarSessoes(pacienteId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('sessoes')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('numero', { ascending: false });
  return { data, error };
}

export async function buscarUltimaSessao(pacienteId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('sessoes')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('numero', { ascending: false })
    .limit(1)
    .single();
  return { data, error };
}

export async function criarSessao(terapeutaId, pacienteId, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('sessoes')
    .insert({ terapeuta_id: terapeutaId, paciente_id: pacienteId, ...campos })
    .select()
    .single();
  return { data, error };
}
