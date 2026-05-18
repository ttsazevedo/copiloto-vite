-- Fix: garante que a coluna de e-mail do paciente nos convites é nullable
-- Execute este script se você recebeu o erro:
-- "null value in column 'email' violates not-null constraint"

-- Remove NOT NULL caso a coluna se chame 'email'
ALTER TABLE public.convites ALTER COLUMN email DROP NOT NULL;

-- Remove NOT NULL caso a coluna se chame 'email_paciente'
ALTER TABLE public.convites ALTER COLUMN email_paciente DROP NOT NULL;
