import { supabase, hasSupabase } from './supabase.js';

const PACIENTE_APP_URL = import.meta.env.VITE_PACIENTE_APP_URL ?? 'http://localhost:5174';

export async function criarConvite(pacienteId, terapeutaId, emailPaciente) {
  if (!hasSupabase) return { data: null, error: null };
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('convites')
    .insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      email_paciente: emailPaciente,
      token,
      status: 'pendente',
      criado_em: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
}

export function gerarLinkConvite(token) {
  return `${PACIENTE_APP_URL}/convite/${token}`;
}

export async function revogarConvite(conviteId) {
  if (!hasSupabase) return { error: null };
  const { error } = await supabase
    .from('convites')
    .update({ status: 'revogado' })
    .eq('id', conviteId);
  return { error };
}

export async function listarConvitesPaciente(pacienteId) {
  if (!hasSupabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('convites')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: false });
  return { data: data ?? [], error };
}
