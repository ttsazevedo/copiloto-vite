import { supabase, hasSupabase } from './supabase.js';

// ─── MOCK ──────────────────────────────────────────────────────────────────────
function _mockAgendamentos() {
  const hoje = new Date();
  const dt = (offsetDias, hora, min) =>
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + offsetDias, hora, min, 0).toISOString();

  return [
    {
      id: 'mock-1',
      paciente_id: 1,
      paciente_nome: 'Mariana Costa',
      paciente_iniciais: 'MC',
      terapeuta_id: 'demo',
      inicio: dt(0, 14, 0),
      fim:    dt(0, 15, 0),
      tipo: 'sessao',
      status: 'agendado',
      notas: '',
    },
    {
      id: 'mock-2',
      paciente_id: 2,
      paciente_nome: 'Rafael Souza',
      paciente_iniciais: 'RS',
      terapeuta_id: 'demo',
      inicio: dt(1, 10, 0),
      fim:    dt(1, 11, 0),
      tipo: 'sessao',
      status: 'agendado',
      notas: '',
    },
    {
      id: 'mock-3',
      paciente_id: 3,
      paciente_nome: 'Beatriz Lemos',
      paciente_iniciais: 'BL',
      terapeuta_id: 'demo',
      inicio: dt(4, 16, 0),
      fim:    dt(4, 17, 0),
      tipo: 'sessao',
      status: 'agendado',
      notas: '',
    },
  ];
}

function _normalizar(a) {
  const { pacientes, ...rest } = a;
  return {
    ...rest,
    paciente_nome:     pacientes?.nome     ?? '',
    paciente_iniciais: pacientes?.iniciais ?? '',
  };
}

const ts = (s) => new Date(s).getTime();

// ─── FUNÇÕES PÚBLICAS ──────────────────────────────────────────────────────────

export async function listarAgendamentos(terapeutaId, dataInicio, dataFim) {
  if (!hasSupabase) {
    const todos = _mockAgendamentos();
    return {
      data: todos.filter(a => ts(a.inicio) >= ts(dataInicio) && ts(a.inicio) <= ts(dataFim)),
      error: null,
    };
  }
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome, iniciais)')
    .eq('terapeuta_id', terapeutaId)
    .gte('inicio', dataInicio)
    .lte('inicio', dataFim)
    .order('inicio', { ascending: true });

  if (error) return { data: null, error };
  return { data: (data ?? []).map(_normalizar), error: null };
}

export async function criarAgendamento(terapeutaId, { pacienteId, inicio, fim, tipo = 'sessao', notas = '' }) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('agendamentos')
    .insert({ terapeuta_id: terapeutaId, paciente_id: pacienteId, inicio, fim, tipo, status: 'agendado', notas })
    .select('*, pacientes(nome, iniciais)')
    .single();

  if (error) return { data: null, error };
  return { data: _normalizar(data), error: null };
}

export async function atualizarAgendamento(id, campos) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('agendamentos')
    .update(campos)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function cancelarAgendamento(id) {
  if (!hasSupabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}
