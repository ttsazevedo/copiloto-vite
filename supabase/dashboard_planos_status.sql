-- Adiciona coluna status à tabela planos para o sistema de dashboard
-- Execute no SQL Editor do Supabase

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'proposto';
