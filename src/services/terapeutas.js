import { supabase, hasSupabase } from './supabase.js';

export async function buscarTerapeuta(id) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('terapeutas')
    .select('nome, email, telefone, crp, onboarding_concluido, janela_contexto, acesso_analise_longitudinal')
    .eq('id', id)
    .maybeSingle();
  return { data, error };
}

export async function atualizarTerapeuta(id, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('terapeutas')
    .update(campos)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function marcarOnboardingConcluido(id) {
  if (!hasSupabase) return { error: null };
  const { error } = await supabase
    .from('terapeutas')
    .update({ onboarding_concluido: true })
    .eq('id', id);
  return { error };
}
