-- Adiciona colunas que o formulário de perfil coleta mas não existiam na tabela
-- Execute no SQL Editor do Supabase

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS email     text,
  ADD COLUMN IF NOT EXISTS telefone  text,
  ADD COLUMN IF NOT EXISTS convenio  text,
  ADD COLUMN IF NOT EXISTS idade     integer;
