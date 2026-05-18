-- ─── Etapa 3: Integração com app do paciente ───
-- IMPORTANTE: Se você já executou schema_paciente.sql, este arquivo é desnecessário.
-- Execute apenas se precisar adicionar as políticas de acesso do terapeuta individualmente.
-- Executar no SQL Editor do Supabase

-- 1. Garante índices em tarefas
CREATE INDEX IF NOT EXISTS tarefas_paciente_id_idx  ON public.tarefas (paciente_id);
CREATE INDEX IF NOT EXISTS tarefas_terapeuta_id_idx ON public.tarefas (terapeuta_id);

-- 2. RLS adicional em tarefas: terapeuta acessa tarefas via paciente_id (complementa schema_paciente.sql)
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta gerencia tarefas" ON public.tarefas;
CREATE POLICY "Terapeuta gerencia tarefas"
  ON public.tarefas FOR ALL
  USING  (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

-- 3. RLS em registros_abcd: terapeuta lê registros dos seus pacientes
ALTER TABLE public.registros_abcd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta lê registros ABCD" ON public.registros_abcd;
CREATE POLICY "Terapeuta lê registros ABCD"
  ON public.registros_abcd FOR SELECT
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

-- 4. RLS em humor_diario: terapeuta lê humor dos seus pacientes
ALTER TABLE public.humor_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta lê humor" ON public.humor_diario;
CREATE POLICY "Terapeuta lê humor"
  ON public.humor_diario FOR SELECT
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

-- 5. RLS em convites: terapeuta gerencia convites dos seus pacientes
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta gerencia convites" ON public.convites;
CREATE POLICY "Terapeuta gerencia convites"
  ON public.convites FOR ALL
  USING  (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);
