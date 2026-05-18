-- Migração: vincular sessão ao agendamento correspondente
-- Executar no SQL Editor do Supabase

ALTER TABLE public.sessoes
  ADD COLUMN IF NOT EXISTS agendamento_id uuid
    REFERENCES public.agendamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessoes_agendamento_id_idx
  ON public.sessoes (agendamento_id);
