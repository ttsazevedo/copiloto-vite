import { supabase, hasSupabase } from './supabase.js';

export async function listarPacientes(terapeutaId) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('terapeuta_id', terapeutaId)
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

export async function excluirPaciente(pacienteId) {
  if (!hasSupabase) return { error: null };
  const { error } = await supabase
    .from('pacientes')
    .delete()
    .eq('id', pacienteId);
  return { error };
}
