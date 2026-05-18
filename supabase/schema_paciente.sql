-- ─── SCHEMA: Tabelas do app do paciente ───
-- Executar no SQL Editor do Supabase após schema.sql
-- Ordem: convites → função helper → demais tabelas → RLS

-- ─── TABELA: convites ───
-- Criada primeiro pois get_paciente_id() a referencia
create table if not exists public.convites (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid references public.pacientes(id) on delete cascade,
  terapeuta_id     uuid,
  email_paciente   text,
  token            uuid unique default gen_random_uuid(),
  status           text default 'pendente', -- pendente | usado | revogado
  paciente_auth_id uuid,
  criado_em        timestamptz default now()
);

-- Garante que todas as colunas existem, independente de como a tabela foi criada
alter table public.convites add column if not exists paciente_id      uuid references public.pacientes(id) on delete cascade;
alter table public.convites add column if not exists terapeuta_id     uuid;
alter table public.convites add column if not exists email_paciente   text;
alter table public.convites add column if not exists token            uuid unique default gen_random_uuid();
alter table public.convites add column if not exists status           text default 'pendente';
alter table public.convites add column if not exists paciente_auth_id uuid;
alter table public.convites add column if not exists criado_em        timestamptz default now();

-- ─── HELPER: resolve paciente_id a partir do auth.uid() do paciente ───
-- Depende da tabela convites — deve ser criada após ela
create or replace function public.get_paciente_id()
returns uuid as $$
  select paciente_id
  from public.convites
  where paciente_auth_id = auth.uid()
    and status = 'usado'
  limit 1
$$ language sql stable security definer;

-- ─── TABELA: tarefas ───
create table if not exists public.tarefas (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid references public.pacientes(id) on delete cascade,
  sessao_id       uuid,
  terapeuta_id    uuid,
  descricao       text not null,
  tipo_formulario text default 'abcd',
  prazo           date,
  status          text default 'pendente', -- pendente | em_andamento | concluido
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

-- ─── TABELA: registros_abcd ───
create table if not exists public.registros_abcd (
  id                 uuid primary key default gen_random_uuid(),
  tarefa_id          uuid references public.tarefas(id) on delete set null,
  paciente_id        uuid not null,
  situacao           text,
  emocao             text,
  intensidade_antes  integer,
  pensamento         text,
  resposta_racional  text,
  intensidade_depois integer,
  criado_em          timestamptz default now()
);

-- ─── TABELA: humor_diario ───
create table if not exists public.humor_diario (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null,
  data          date not null,
  valor         integer not null check (valor between 1 and 10),
  nota          text,
  atualizado_em timestamptz default now(),
  unique (paciente_id, data)
);

-- ─── TABELA: conquistas ───
create table if not exists public.conquistas (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null,
  conquista_id    text not null,
  desbloqueado_em timestamptz default now(),
  unique (paciente_id, conquista_id)
);

-- ─── RLS: convites ───
alter table public.convites enable row level security;

drop policy if exists "Terapeuta gerencia seus convites" on public.convites;
create policy "Terapeuta gerencia seus convites"
  on public.convites for all
  using (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);

drop policy if exists "Paciente lê seu próprio convite" on public.convites;
create policy "Paciente lê seu próprio convite"
  on public.convites for select
  using (auth.uid() = paciente_auth_id);

-- Necessário para cadastrarViaCovite() atualizar status e paciente_auth_id
drop policy if exists "Paciente atualiza seu próprio convite" on public.convites;
create policy "Paciente atualiza seu próprio convite"
  on public.convites for update
  using (token in (
    select token from public.convites where status = 'pendente'
  ));

-- ─── RLS: tarefas ───
alter table public.tarefas enable row level security;

drop policy if exists "Terapeuta gerencia tarefas dos seus pacientes" on public.tarefas;
create policy "Terapeuta gerencia tarefas dos seus pacientes"
  on public.tarefas for all
  using (auth.uid() = terapeuta_id)
  with check (auth.uid() = terapeuta_id);

drop policy if exists "Paciente lê suas tarefas" on public.tarefas;
create policy "Paciente lê suas tarefas"
  on public.tarefas for select
  using (paciente_id = public.get_paciente_id());

drop policy if exists "Paciente atualiza status de suas tarefas" on public.tarefas;
create policy "Paciente atualiza status de suas tarefas"
  on public.tarefas for update
  using (paciente_id = public.get_paciente_id());

-- ─── RLS: registros_abcd ───
alter table public.registros_abcd enable row level security;

drop policy if exists "Paciente gerencia seus registros ABCD" on public.registros_abcd;
create policy "Paciente gerencia seus registros ABCD"
  on public.registros_abcd for all
  using (paciente_id = public.get_paciente_id())
  with check (paciente_id = public.get_paciente_id());

drop policy if exists "Terapeuta lê registros dos seus pacientes" on public.registros_abcd;
create policy "Terapeuta lê registros dos seus pacientes"
  on public.registros_abcd for select
  using (
    paciente_id in (
      select id from public.pacientes where terapeuta_id = auth.uid()
    )
  );

-- ─── RLS: humor_diario ───
alter table public.humor_diario enable row level security;

drop policy if exists "Paciente gerencia seu humor diário" on public.humor_diario;
create policy "Paciente gerencia seu humor diário"
  on public.humor_diario for all
  using (paciente_id = public.get_paciente_id())
  with check (paciente_id = public.get_paciente_id());

drop policy if exists "Terapeuta lê humor dos seus pacientes" on public.humor_diario;
create policy "Terapeuta lê humor dos seus pacientes"
  on public.humor_diario for select
  using (
    paciente_id in (
      select id from public.pacientes where terapeuta_id = auth.uid()
    )
  );

-- ─── RLS: conquistas ───
alter table public.conquistas enable row level security;

drop policy if exists "Paciente gerencia suas conquistas" on public.conquistas;
create policy "Paciente gerencia suas conquistas"
  on public.conquistas for all
  using (paciente_id = public.get_paciente_id())
  with check (paciente_id = public.get_paciente_id());

drop policy if exists "Terapeuta lê conquistas dos seus pacientes" on public.conquistas;
create policy "Terapeuta lê conquistas dos seus pacientes"
  on public.conquistas for select
  using (
    paciente_id in (
      select id from public.pacientes where terapeuta_id = auth.uid()
    )
  );
