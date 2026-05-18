# Instruções para executar o schema no Supabase

## Pré-requisitos
- Projeto Supabase criado e ativo
- `.env.local` preenchido com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

---

## Passo a passo

### 1. Abrir o SQL Editor
1. Acesse [app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral esquerdo, clique em **SQL Editor** (ícone de terminal `>_`)

### 2. Criar um novo script
1. Clique em **New query** (botão no topo esquerdo do editor)
2. Um editor em branco será aberto

### 3. Colar e executar o schema
1. Abra o arquivo `supabase/schema.sql` deste projeto
2. Selecione **todo o conteúdo** (`Ctrl+A`) e copie (`Ctrl+C`)
3. Cole no editor do Supabase (`Ctrl+V`)
4. Clique no botão verde **Run** (ou `Ctrl+Enter`)

> Execute o arquivo **inteiro de uma vez** — a ordem das instruções importa
> (tabelas antes de triggers, funções antes de triggers).

### 4. Resultado esperado (sucesso)
O painel inferior mostrará:
```
Success. No rows returned
```
ou
```
Results: 0 rows
```

Todas as instruções devem rodar sem erros em vermelho.

### 5. Verificar as tabelas criadas
Após executar, vá em **Table Editor** no menu lateral.
Você deve ver 4 tabelas:
- `terapeutas`
- `pacientes`
- `sessoes`
- `planos`

### 6. Verificar o trigger de auth
No SQL Editor, execute esta query de verificação:
```sql
select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
```
Deve retornar 1 linha com `event_object_table = users`.

---

## Erros comuns e soluções

### `ERROR: relation "terapeutas" already exists`
O schema já foi executado antes. Como todas as instruções usam
`create table if not exists` e `drop ... if exists`, isso **não deve ocorrer**.
Se ocorrer, execute apenas o bloco que causou erro separadamente.

### `ERROR: permission denied for table users`
O trigger em `auth.users` requer permissão especial. Verifique que você
está usando o **Service Role** ou executando pelo SQL Editor (que roda
como `postgres`). O SQL Editor do Supabase já tem essas permissões.

### `ERROR: function gen_random_uuid() does not exist`
Seu projeto usa PostgreSQL < 13 (raro no Supabase atual). Substitua
`gen_random_uuid()` por `uuid_generate_v4()` e adicione no topo:
```sql
create extension if not exists "uuid-ossp";
```

### `ERROR: policy "..." already exists`
Cada `create policy` é precedido de `drop policy if exists`, então isso
não deve ocorrer. Se ocorrer, execute manualmente:
```sql
drop policy if exists "nome da policy" on public.nome_tabela;
```

---

## Após executar o schema

1. **Testar o registro:** abra o app (`npm run dev`), clique em "Cadastre-se",
   crie uma conta com e-mail e senha
2. **Verificar o perfil:** no Supabase → Table Editor → `terapeutas`,
   deve aparecer uma linha com o `id` e `email` do usuário registrado
3. **Verificar o auth:** Authentication → Users, deve listar o usuário criado

O app funciona em **modo demo** (dados simulados) mesmo sem executar o schema,
enquanto as chaves API estiverem no `.env.local` e o login for realizado.
