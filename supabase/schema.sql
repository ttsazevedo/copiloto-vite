-- ─── SCHEMA: Copiloto Terapeuta MVP ───
-- Executar no SQL Editor do Supabase (uma vez, inteiro)
-- Compatível com PostgreSQL 14+ (Supabase padrão)
-- gen_random_uuid() é nativo no PG13+ — não requer extensão

-- ─── TABELA: terapeutas ───
create table if not exists public.terapeutas (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  nome          text,
  crp           text,
  linha_default text default 'tcc',
  created_at    timestamptz default now()
);

alter table public.terapeutas enable row level security;

drop policy if exists "Terapeuta acessa apenas próprio perfil" on public.terapeutas;
create policy "Terapeuta acessa apenas próprio perfil"
  on public.terapeutas for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── TABELA: pacientes ───
create table if not exists public.pacientes (
  id            uuid primary key default gen_random_uuid(),
  terapeuta_id  uuid not null references public.terapeutas(id) on delete cascade,
  nome          text not null,
  iniciais      text,
  queixa        text,
  diagnostico   text,
  linha         text default 'tcc',
  risco         text default 'baixo',   -- baixo | medio | alto
  sessoes       integer default 0,
  sessoes_pagas integer default 0,
  inicio        text,
  meta          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.pacientes enable row level security;

drop policy if exists "Terapeuta acessa apenas próprios pacientes" on public.pacientes;
create policy "Terapeuta acessa apenas próprios pacientes"
  on public.pacientes for all
  using (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);

-- ─── TABELA: sessoes ───
create table if not exists public.sessoes (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid not null references public.pacientes(id) on delete cascade,
  terapeuta_id     uuid not null references public.terapeutas(id) on delete cascade,
  numero           integer not null,
  data             text not null,
  humor_inicio     integer,
  humor_fim        integer,
  resumo           text,
  temas            text[],
  distorcoes       text[],
  tecnicas         text[],
  emocoes          jsonb,    -- [{ nome, intensidade }]
  alertas          text[],
  resultado_tarefa text,
  tarefa_proxima   text,
  notas_raw        text,     -- texto bruto importado
  created_at       timestamptz default now()
);

alter table public.sessoes enable row level security;

drop policy if exists "Terapeuta acessa apenas sessões de seus pacientes" on public.sessoes;
create policy "Terapeuta acessa apenas sessões de seus pacientes"
  on public.sessoes for all
  using (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);

-- ─── TABELA: planos ───
create table if not exists public.planos (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes(id) on delete cascade,
  terapeuta_id    uuid not null references public.terapeutas(id) on delete cascade,
  sessao_id       uuid references public.sessoes(id) on delete set null,
  numero_proxima  integer not null,
  objetivo        text,
  tecnicas        text[],
  perguntas       text[],
  distorcoes_foco text[],
  tarefa          text,
  observacoes     text,
  gerado_por      text default 'gemini',  -- gemini | claude | manual
  editado         boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.planos enable row level security;

drop policy if exists "Terapeuta acessa apenas planos de seus pacientes" on public.planos;
create policy "Terapeuta acessa apenas planos de seus pacientes"
  on public.planos for all
  using (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);

-- ─── FUNÇÃO + TRIGGER: atualizar updated_at ───
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pacientes_updated_at on public.pacientes;
create trigger pacientes_updated_at
  before update on public.pacientes
  for each row execute function public.update_updated_at();

drop trigger if exists planos_updated_at on public.planos;
create trigger planos_updated_at
  before update on public.planos
  for each row execute function public.update_updated_at();

-- ─── FUNÇÃO + TRIGGER: criar perfil ao registrar ───
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.terapeutas (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
