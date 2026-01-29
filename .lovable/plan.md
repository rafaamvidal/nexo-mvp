
Objetivo
- Fazer a aba “Usuários / Staff” funcionar de ponta a ponta no /cadastros, com CRUD completo (Novo/Editar/Excluir) e acesso restrito a administradores, sem criar usuários no Auth agora.
- Corrigir o motivo principal de “não aparecer nada” hoje: o seu usuário (admin@erp.com.br) não está com o papel “admin” cadastrado na tabela segura de papéis (user_roles), então a aba fica bloqueada.

O que encontrei no código atual
- O componente `src/components/staff/StaffTab.tsx` já está implementado com CRUD e modal (Novo/Editar/Excluir) usando Supabase + React Query.
- A página `src/pages/Cadastros.tsx` já renderiza `<StaffTab />` no tab `usuarios`.
- O hook `src/hooks/useIsAdmin.ts` verifica admin pela tabela `public.user_roles`.
- Nos logs de rede, a query `GET /rest/v1/user_roles?...` está retornando `[]` (vazio) para o seu user_id, então `useIsAdmin()` retorna falso e a aba fica restrita.
- Existe um alerta de segurança nas instruções: “Roles MUST be stored in a separate table”. Hoje o `StaffTab` grava `role` diretamente em `user_profiles`, o que é arriscado se alguém futuramente usar isso para permissão.

Decisões (alinhadas com sua resposta)
- Fonte de permissões: `user_roles` (correto e mais seguro).
- `user_profiles` continua sendo a allowlist (nome, e-mail, status), mas vamos separar o “cargo” em uma tabela específica de allowlist para não violar a regra de segurança.

Plano de implementação

1) Desbloquear o acesso de admin para o seu usuário atual (admin@erp.com.br)
- Problema: você está logado, mas não existe registro de role “admin” em `public.user_roles` para o seu `user_id`, por isso o StaffTab não carrega.
- Ação: inserir o papel admin para o seu usuário na tabela `public.user_roles`.
  - Você pode fazer isso no Supabase SQL Editor (ação de DADOS, não é migração de estrutura), com um comando como:
    - `INSERT INTO public.user_roles (user_id, role) VALUES ('SEU_USER_ID', 'admin') ON CONFLICT DO NOTHING;`
  - Eu vou confirmar o `user_id` correto lendo o usuário atual (via logs/consulta) e te entregar o SQL exato.
- Resultado esperado: ao recarregar /cadastros, o tab “Usuários/Staff” passa a exibir a listagem e o botão “Novo”.

2) Corrigir o modelo de dados da allowlist para separar “Cargo/Perfil” em tabela própria (segurança)
- Problema: hoje existe `user_profiles.role` e o CRUD grava “role” direto nele. Isso conflita com a regra de segurança (“não guardar roles em tabela de profiles/users”).
- Ação (mudança de ESQUEMA via migration):
  2.1) Criar uma tabela para roles da allowlist (por perfil)
  - Exemplo de estrutura:
    - `public.user_profile_roles`:
      - `id uuid pk default gen_random_uuid()`
      - `user_profile_id uuid not null references public.user_profiles(id) on delete cascade`
      - `role public.app_role not null`
      - `unique(user_profile_id)` (um papel por allowlist; se quiser múltiplos, vira `unique(user_profile_id, role)`)
  2.2) (Opcional, recomendado) Tornar `public.user_profiles.email` único
  - Criar índice/constraint unique em `lower(email)` para evitar duplicidade por caixa alta/baixa.
  2.3) Ajustar RLS da nova tabela `user_profile_roles`
  - Permitir ALL somente para admin, usando `has_role(auth.uid(), 'admin')`.
- Resultado: “Cargo” fica tecnicamente separado, e o app continua mostrando/gerenciando o cargo na UI.

3) Ajustar o StaffTab para usar a nova tabela de roles (sem depender de user_profiles.role)
- Ação (código):
  - Atualizar `fetchAllowlistUsers()` para buscar:
    - `user_profiles` (id, email, full_name, status, created_at)
    - e o role via relação `user_profile_roles(role)` (select com join do Supabase).
  - Atualizar o schema/validação do formulário:
    - Continuar exigindo role e status no modal.
  - Atualizar `upsertUser`:
    - Quando “Novo”:
      1) inserir em `user_profiles` (full_name, email, status)
      2) inserir em `user_profile_roles` com o `user_profile_id` retornado e `role`
    - Quando “Editar”:
      1) update em `user_profiles`
      2) upsert/update em `user_profile_roles` (trocar role)
  - Atualizar `deleteUser`:
    - deletar de `user_profiles` deve cascatar em `user_profile_roles` (por FK on delete cascade).
- Resultado: CRUD completo continua igual para você, mas internamente fica seguro e alinhado à regra de roles em tabela separada.

4) Garantir UX consistente com as outras abas (Clientes/Fornecedores)
- Verificar se:
  - Botão “Novo” aparece no topo do StaffTab (como já está no componente).
  - Listagem com colunas: Nome, Email, Cargo, Status, Ações (Editar/Excluir).
  - Remover qualquer “placeholder/trava” remanescente (se existir em algum outro arquivo/branch).
- Observação: como a frase “Por enquanto, apenas visualização” não existe no código atual que eu li, a causa mais provável do “placeholder” é o bloqueio de admin (item 1). Mesmo assim, vou fazer uma busca final no projeto e remover qualquer fallback antigo se estiver em outro componente.

5) Testes (checklist)
- Logado como admin@erp.com.br (com role admin em `user_roles`):
  - Abrir Cadastros → Usuários/Staff
  - Criar um novo registro (Novo) e confirmar que aparece na tabela após salvar
  - Editar (alterar nome, status, role) e confirmar atualização
  - Excluir e confirmar remoção
- Logado com um usuário não-admin:
  - Confirmar que não vê a lista completa e não consegue CRUD (apenas card restrito)
- Teste de duplicidade:
  - Tentar cadastrar o mesmo e-mail duas vezes e garantir erro amigável (se aplicarmos unique)

Riscos e cuidados
- Se você já tem dados em `user_profiles.role`, a migração deve prever:
  - Migrar os valores existentes para `user_profile_roles` antes de remover/ignorar a coluna `role`.
  - Eu vou incluir um passo de “migração de dados” (UPDATE/INSERT) separado do migration de schema, para não perder nada.
- Importante: mesmo mantendo allowlist, o “cargo” da allowlist não deve ser usado para autorizar telas sensíveis; as permissões do app devem continuar vindo de `user_roles` (como você escolheu). A allowlist serve para permitir/bloquear acesso por e-mail/status.

Entregáveis quando você aprovar este plano (na fase de implementação)
- Migration SQL criando `user_profile_roles` + RLS + unique email (se aprovado).
- Ajustes no `StaffTab.tsx` para ler/escrever role via `user_profile_roles`.
- Um comando SQL pronto para você rodar e marcar o seu usuário como admin em `user_roles`.
