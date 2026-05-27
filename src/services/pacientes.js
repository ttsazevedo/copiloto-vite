import { supabase, hasSupabase } from './supabase.js';

export async function listarPacientes(terapeutaId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('terapeuta_id', terapeutaId)
    .is('deleted_at', null)
    .order('nome');
  return { data, error };
}

export async function buscarPaciente(pacienteId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', pacienteId)
    .single();
  return { data, error };
}

export async function criarPaciente(terapeutaId, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('pacientes')
    .insert({ terapeuta_id: terapeutaId, ...campos })
    .select()
    .single();
  return { data, error };
}

export async function atualizarPaciente(pacienteId, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('pacientes')
    .update(campos)
    .eq('id', pacienteId)
    .select()
    .single();
  return { data, error };
}

export async function deletarPaciente(pacienteId) {
  if (!hasSupabase) return { error: null };
  const { error } = await supabase
    .from('pacientes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', pacienteId);
  return { error };
}

export async function restaurarPaciente(pacienteId) {
  if (!hasSupabase) return { error: null };
  const { error } = await supabase
    .from('pacientes')
    .update({ deleted_at: null })
    .eq('id', pacienteId);
  return { error };
}

export async function listarPacientesArquivados(terapeutaId) {
  if (!hasSupabase) return { data: null, error: null };
  const corte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nome, queixa, deleted_at')
    .eq('terapeuta_id', terapeutaId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', corte)
    .order('deleted_at', { ascending: false });
  return { data, error };
}
