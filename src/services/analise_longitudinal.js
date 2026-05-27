import { supabase } from './supabase.js';

export async function buscarAnalise(terapeutaId, pacienteId) {
  const { data, error } = await supabase
    .from('analises_longitudinais')
    .select('*')
    .eq('terapeuta_id', terapeutaId)
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function salvarAnalise(terapeutaId, pacienteId, conteudo, sessoesCount, geradoPor) {
  const existente = await buscarAnalise(terapeutaId, pacienteId);
  if (existente) {
    const { error } = await supabase
      .from('analises_longitudinais')
      .update({
        conteudo,
        sessoes_count: sessoesCount,
        gerado_por: geradoPor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existente.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('analises_longitudinais')
      .insert({ terapeuta_id: terapeutaId, paciente_id: pacienteId,
                conteudo, sessoes_count: sessoesCount, gerado_por: geradoPor });
    if (error) throw error;
  }
}
