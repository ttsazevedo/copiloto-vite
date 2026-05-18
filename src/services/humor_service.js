import { supabase, hasSupabase } from './supabase.js';

export async function listarHumorPaciente(pacienteId, dias = 30) {
  if (!hasSupabase) return { data: [], error: null };
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);
  const { data, error } = await supabase
    .from('humor_diario')
    .select('*')
    .eq('paciente_id', pacienteId)
    .gte('data', dataInicio.toISOString().split('T')[0])
    .order('data', { ascending: true });
  return { data: data ?? [], error };
}

export async function mediaHumorSemana(pacienteId) {
  if (!hasSupabase) return { media: null, error: null };
  const seteDias = new Date();
  seteDias.setDate(seteDias.getDate() - 7);
  const { data, error } = await supabase
    .from('humor_diario')
    .select('valor')
    .eq('paciente_id', pacienteId)
    .gte('data', seteDias.toISOString().split('T')[0]);
  if (!data || data.length === 0) return { media: null, error };
  const media = data.reduce((acc, h) => acc + h.valor, 0) / data.length;
  return { media: Math.round(media * 10) / 10, error };
}

// Compara a média dos últimos N/2 dias com os N/2 anteriores
export async function detectarTendenciaHumor(pacienteId) {
  if (!hasSupabase) return { tendencia: 'estavel', error: null };
  const { data, error } = await supabase
    .from('humor_diario')
    .select('valor, data')
    .eq('paciente_id', pacienteId)
    .order('data', { ascending: false })
    .limit(14);
  if (!data || data.length < 4) return { tendencia: 'estavel', error };
  const meio = Math.floor(data.length / 2);
  const recentes = data.slice(0, meio);
  const anteriores = data.slice(meio);
  const mediaRecentes = recentes.reduce((a, h) => a + h.valor, 0) / recentes.length;
  const mediaAnteriores = anteriores.reduce((a, h) => a + h.valor, 0) / anteriores.length;
  const diff = mediaRecentes - mediaAnteriores;
  const tendencia = diff > 0.5 ? 'melhora' : diff < -0.5 ? 'piora' : 'estavel';
  return { tendencia, error };
}
