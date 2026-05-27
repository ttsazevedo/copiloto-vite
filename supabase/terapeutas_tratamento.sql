-- Adiciona coluna tratamento à tabela terapeutas (Dr. / Dra.)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.terapeutas
  ADD COLUMN IF NOT EXISTS tratamento text default 'Dr.';
