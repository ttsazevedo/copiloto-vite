-- RLS para registros_abcd e tarefas
-- Execute no SQL Editor do Supabase

ALTER TABLE public.registros_abcd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- ─── Paciente: lê seus próprios registros ───────────────────────────────────
DROP POLICY IF EXISTS "Paciente lê seus registros" ON public.registros_abcd;
CREATE POLICY "Paciente lê seus registros"
  ON public.registros_abcd FOR SELECT
  USING (
    paciente_id = (
      SELECT paciente_id FROM public.convites
      WHERE paciente_auth_id = auth.uid() AND status = 'usado'
      LIMIT 1
    )
  );

-- ─── Paciente: insere seus próprios registros ────────────────────────────────
DROP POLICY IF EXISTS "Paciente insere seus registros" ON public.registros_abcd;
CREATE POLICY "Paciente insere seus registros"
  ON public.registros_abcd FOR INSERT
  WITH CHECK (
    paciente_id = (
      SELECT paciente_id FROM public.convites
      WHERE paciente_auth_id = auth.uid() AND status = 'usado'
      LIMIT 1
    )
  );

-- ─── Terapeuta: lê registros dos seus pacientes ──────────────────────────────
DROP POLICY IF EXISTS "Terapeuta lê registros dos pacientes" ON public.registros_abcd;
CREATE POLICY "Terapeuta lê registros dos pacientes"
  ON public.registros_abcd FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid()
    )
  );

-- ─── Paciente: lê suas próprias tarefas ─────────────────────────────────────
DROP POLICY IF EXISTS "Paciente lê suas tarefas" ON public.tarefas;
CREATE POLICY "Paciente lê suas tarefas"
  ON public.tarefas FOR SELECT
  USING (
    paciente_id = (
      SELECT paciente_id FROM public.convites
      WHERE paciente_auth_id = auth.uid() AND status = 'usado'
      LIMIT 1
    )
  );

-- ─── Terapeuta: gerencia tarefas dos seus pacientes ─────────────────────────
DROP POLICY IF EXISTS "Terapeuta gerencia tarefas" ON public.tarefas;
CREATE POLICY "Terapeuta gerencia tarefas"
  ON public.tarefas FOR ALL
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());
