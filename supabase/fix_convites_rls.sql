-- Fix: políticas RLS para o fluxo de cadastro do paciente via convite
-- Execute no SQL Editor do Supabase

-- 1. Permite leitura de convite pendente sem autenticação
--    (o token UUID é efetivamente uma chave secreta — seguro para acesso público)
DROP POLICY IF EXISTS "Convite pendente legível por token" ON public.convites;
CREATE POLICY "Convite pendente legível por token"
  ON public.convites FOR SELECT
  USING (status = 'pendente');

-- 2. Permite que o paciente recém-registrado marque o convite como usado
--    (auth.email() bate com o email_paciente registrado pelo terapeuta)
DROP POLICY IF EXISTS "Paciente ativa convite por email" ON public.convites;
CREATE POLICY "Paciente ativa convite por email"
  ON public.convites FOR UPDATE
  USING (email_paciente = auth.email())
  WITH CHECK (email_paciente = auth.email());

-- 3. Permite leitura do perfil do paciente enquanto o convite ainda está pendente
--    (paciente pode ver seus dados antes de finalizar o cadastro)
DROP POLICY IF EXISTS "Leitura de paciente com convite pendente" ON public.pacientes;
CREATE POLICY "Leitura de paciente com convite pendente"
  ON public.pacientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.convites c
      WHERE c.paciente_id = id
        AND c.status = 'pendente'
    )
  );
