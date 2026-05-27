-- Adiciona coluna telefone à tabela terapeutas
-- Execute no SQL Editor do Supabase

ALTER TABLE public.terapeutas
  ADD COLUMN IF NOT EXISTS telefone text;
