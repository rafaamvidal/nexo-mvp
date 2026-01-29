
Objetivo
- Finalizar a aba **“Usuários / Staff”** em **Cadastros**, permitindo que apenas **ADMIN**:
  - veja a listagem de usuários/staff
  - convide novos usuários por e-mail, atribuindo cargo (role) e status
- Implementar o fluxo de **convite + auto-aplicação do cargo** no primeiro login/cadastro do usuário convidado.
- Como combinado: **permissões por módulo = apenas UI** (não vamos mexer em RLS de cada tabela operacional agora), mas vamos **bloquear acesso ao app** para usuários com status **Inativo**.

O que existe hoje (diagnóstico)
- A aba “Usuários / Staff” em `src/pages/Cadastros.tsx` está como placeholder.
- O projeto tem Auth com Supabase, mas **a tela Auth é apenas Login** (`src/pages/Auth.tsx` não tem cadastro).
- No banco público **não existe** `profiles` e **não existe** `user_roles` (apesar de existir a função `public.has_role`, hoje ela depende de uma tabela inexistente).
- Exigência crítica de segurança: **roles devem ficar em tabela separada** (nunca em profiles).

Decisões confirmadas (suas respostas)
- Convite/Login: **Convite + auto-aplicar**
- Permissões por módulo: **Apenas UI**
- Status Inativo: **Bloquear acesso**

Arquitetura proposta (simples, segura e compatível com Supabase)
Vamos separar claramente 3 conceitos:

1) Dados do usuário (perfil público no app): `public.profiles`
- Guarda dados “não privilegiados” e úteis para UI (e-mail e status).
- Não guarda role.

2) Roles: `public.user_roles`
- Uma linha por user_id + role.
- Consultável pelo próprio usuário (para montar UI) e pelo admin (para administrar).
- Reaproveita a função `public.has_role(user_id, role)` com SECURITY DEFINER (já existe no seu banco).

3) Convites: `public.staff_invitations`
- Admin cria convite com `email` + `role`.
- Quando o usuário fizer cadastro/login com aquele e-mail, o app chama uma RPC segura que:
  - valida que existe convite pendente para esse e-mail
  - cria/atualiza profiles
  - atribui role em `user_roles`
  - marca convite como aceito

Isso evita tentar “inserir em profiles” antes do usuário existir (o que não funciona quando profiles é FK de auth.users).

Parte 1 — Banco de Dados (migração Supabase)
1.1) Enum de cargos (roles)
- Atualizar o enum existente `public.app_role` para incluir os cargos do ERP:
  - `admin`, `estoque`, `vendas`, `financeiro`
- Observação: como já existe `app_role` no projeto, a migração será “adicionar valores” (não remove os antigos, se existirem).

1.2) Criar tabela `public.user_roles`
Campos (mínimo):
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role app_role not null`
- `unique(user_id, role)`

RLS (foco em segurança + permitir UI):
- ENABLE RLS
- Policies:
  - Usuário autenticado pode **SELECT** apenas seus próprios roles: `user_id = auth.uid()`
  - Admin pode **SELECT/INSERT/UPDATE/DELETE** em todos (usando `public.has_role(auth.uid(),'admin')`)

1.3) Criar tabela `public.profiles`
Campos:
- `id uuid pk references auth.users(id) on delete cascade` (1:1 com auth.users)
- `email text not null`
- `status text not null default 'Ativo'` (ou enum, mas manteremos text no MVP)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS:
- ENABLE RLS
- Policies:
  - Usuário autenticado pode **SELECT** e **UPDATE** do próprio profile: `id = auth.uid()`
  - Admin pode **SELECT/INSERT/UPDATE** de todos (com `public.has_role(auth.uid(),'admin')`)
  - (Opcional) impedir DELETE via policy (mais seguro no MVP)

Trigger de updated_at:
- Reaproveitar a função `public.update_updated_at_column()` (já existe) e criar trigger na `profiles`.

1.4) Criar tabela `public.staff_invitations`
Campos:
- `id uuid pk default gen_random_uuid()`
- `email text not null` (armazenar normalizado: trim + lower)
- `role app_role not null`
- `status text not null default 'Pendente'` (Pendente/Aceito/Cancelado)
- `created_by uuid null` (auth.uid do admin que convidou)
- `created_at timestamptz not null default now()`
- `accepted_at timestamptz null`

RLS:
- ENABLE RLS
- Admin pode **SELECT/INSERT/UPDATE/DELETE** tudo
- Usuário comum não lê convites (não precisa)

1.5) RPC para auto-aplicar convite (server-side, segura)
Criar função `public.accept_staff_invitation() returns void`
- SECURITY DEFINER
- `set search_path = public`
Regras internas:
- Exigir `auth.uid() is not null`
- Obter `auth.email()` do usuário (via `auth.jwt()` claims ou `current_setting('request.jwt.claims', true)`), ou passar email como parâmetro e validar contra JWT (preferível não confiar no parâmetro).
- Buscar convite pendente por email (lowercase) e status = 'Pendente'
- Se existir:
  - Upsert em `profiles` com `id = auth.uid()`, `email`, `status = 'Ativo'`
  - Insert em `user_roles(user_id, role)` (on conflict do nothing)
  - Update convite: status='Aceito', accepted_at=now()
- Se não existir: não fazer nada (para usuários “não staff”)

Permissões:
- Grant execute para `authenticated` (a função faz validações internas)

Parte 2 — Frontend (Cadastros > Usuários / Staff)
Arquivos principais a alterar
- `src/pages/Cadastros.tsx`
- (provável) criar um hook utilitário: `src/hooks/useRole.ts` (ou similar)
- `src/components/auth/RequireAuth.tsx` (bloqueio por status)
- `src/pages/Auth.tsx` (adicionar cadastro)
- (opcional) `src/components/layout/AppSidebar.tsx` (ocultar itens por role, se desejado)

2.1) Como o frontend vai saber se é Admin
- Criar query React Query `useIsAdmin()` que:
  - lê `user_roles` onde `user_id = auth.uid()` e procura role `admin`
  - retorna `isAdmin`, `isLoading`, `error`
- Essa checagem será usada para:
  - Exibir/ocultar a aba “Usuários / Staff” ou mostrar “Sem permissão”
  - Proteger ações (invitar, editar role/status)

2.2) UI da Aba “Usuários / Staff”
Se NÃO for admin:
- Mostrar Card informando “Acesso restrito ao Administrador”.

Se for admin:
- Mostrar:
  - Botão “Convidar Usuário”
  - Tabela “Staff” com colunas:
    - Email
    - Cargo (role)
    - Status (Ativo/Inativo/Pendente)
    - Ações (Alterar role / Ativar/Inativar / Cancelar convite)

Fonte dos dados (MVP sem Edge Function):
- Listar “usuários ativos no sistema”: `profiles` + `user_roles`
  - Buscar `profiles` (email, status, id)
  - Buscar `user_roles` (user_id, role)
  - Combinar no frontend (map por user_id)
- Listar convites pendentes: `staff_invitations` (email, role, status)
  - Exibir como linhas com status “Pendente” (sem user_id)

2.3) Modal “Convidar Usuário”
Campos:
- Email (Input)
- Função (Select): Admin, Estoque, Vendas, Financeiro

Ação ao salvar:
- Insert em `staff_invitations` com:
  - email normalizado (trim/lower)
  - role
  - created_by = auth.uid
- Toast:
  - “Convite criado. Oriente o usuário a se cadastrar com este e-mail na tela de login.”

Validação (client-side + server-side)
- Client-side com zod:
  - email válido, max 255
  - role obrigatório
- Server-side:
  - RLS garante que só admin insere

2.4) Ações administrativas
- Alterar status Ativo/Inativo de um usuário existente:
  - Update em `profiles.status`
- Alterar role (opcional no MVP, mas alinhado com “níveis de acesso diferentes”):
  - Estratégia simples: manter 1 role por usuário (exceto admin)
  - Implementar como:
    - remover roles antigas (delete) e inserir a nova
  - Se preferir, podemos travar para “um usuário só pode ter 1 role” via lógica no app (sem constraint agora)

Parte 3 — Login/Cadastro + auto-aplicar convites
3.1) Atualizar a tela `src/pages/Auth.tsx`
- Adicionar modo “Cadastro” (Tabs ou Toggle):
  - Campos: email + senha
  - Chamar `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })`
- Manter o “Login” como está, só adicionando a opção de cadastro.

3.2) Após login/cadastro: aplicar convite automaticamente
- Depois de um login/signup bem-sucedido, chamar:
  - `supabase.rpc("accept_staff_invitation")`
- Em seguida navegar para “/”.
- Se a RPC falhar:
  - Não bloquear login, mas logar/toastar erro amigável (sem expor detalhes técnicos).

Parte 4 — Bloqueio de acesso para status Inativo
Arquivo: `src/components/auth/RequireAuth.tsx`
- Hoje ele só verifica “tem user”.
- Vamos adicionar:
  - Query ao `profiles` do usuário atual:
    - `select status where id = auth.uid()`
  - Se status == 'Inativo':
    - exibir uma tela simples: “Usuário inativo. Contate o administrador.”
    - e oferecer botão “Sair”
- Observação importante do MVP:
  - Isso bloqueia o app pelo frontend. Como você escolheu “apenas UI”, não alteraremos RLS de todas as tabelas agora.

Checklist de testes (end-to-end)
1) Admin
- Logar como admin
- Ir em Cadastros > Usuários / Staff
- Criar convite (email + role) e ver na tabela como “Pendente”
2) Usuário convidado
- Ir em /auth
- Cadastrar com o email convidado
- Confirmar que após entrar o sistema:
  - criou profile
  - aplicou role conforme convite
  - convite mudou para “Aceito”
3) Restrições
- Logar como usuário não-admin:
  - não deve ver/usar a aba de Usuários (ou deve ver bloqueado)
- Marcar usuário como Inativo:
  - ao tentar acessar app, deve cair na tela de bloqueio (RequireAuth) e conseguir apenas “Sair”.

Impacto/arquivos (resumo)
- Migração Supabase (SQL):
  - alterar enum `app_role`
  - criar `user_roles`, `profiles`, `staff_invitations`
  - políticas RLS
  - trigger updated_at em profiles
  - RPC `accept_staff_invitation()`
- Frontend:
  - `src/pages/Cadastros.tsx` (implementar aba completa)
  - `src/pages/Auth.tsx` (adicionar cadastro + chamar RPC)
  - `src/components/auth/RequireAuth.tsx` (bloqueio status inativo)
  - possivelmente novo hook utilitário em `src/hooks/` para roles/admin check

Notas de segurança (importantes)
- Roles ficam exclusivamente em `user_roles` (conforme exigência).
- Admin nunca será decidido por localStorage/hardcode.
- Atribuição de role via convite é feita por **RPC SECURITY DEFINER** com validação do email do JWT (não confiando em input do cliente).
