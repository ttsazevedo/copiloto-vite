-- ─── SCHEMA: Tabela de agendamentos ───
-- Executar no SQL Editor do Supabase após schema.sql

create table if not exists public.agendamentos (
  id           uuid primary key default gen_random_uuid(),
  terapeuta_id uuid not null references public.terapeutas(id) on delete cascade,
  paciente_id  uuid references public.pacientes(id) on delete set null,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  tipo         text default 'sessao',    -- sessao | avaliacao | retorno | outro
  status       text default 'agendado', -- agendado | confirmado | cancelado | falta
  notas        text,
  created_at   timestamptz default now()
);

-- Índice para queries por terapeuta + intervalo de data (padrão de uso do serviço)
create index if not exists agendamentos_terapeuta_inicio_idx
  on public.agendamentos (terapeuta_id, inicio);

alter table public.agendamentos enable row level security;

drop policy if exists "Terapeuta gerencia seus agendamentos" on public.agendamentos;
create policy "Terapeuta gerencia seus agendamentos"
  on public.agendamentos for all
  using  (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);
