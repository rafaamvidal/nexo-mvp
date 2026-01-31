
## Objetivo
Implementar a funcionalidade “Alterar Senha” para o usuário logado, via um modal (Dialog) acessível pela Sidebar, usando `supabase.auth.updateUser({ password })` e feedback via toast.

---

## O que vou inspecionar/seguir do projeto (para manter consistência)
- O app já usa **Radix Dialog** via `src/components/ui/dialog.tsx`.
- Inputs/Botões padrão já existem (`Input`, `Button`, `Label`).
- O projeto já usa **sonner** (`toast.success`, `toast.error`) em `src/pages/Auth.tsx` e outras páginas.
- A sidebar já tem componentes prontos para **Footer/Separator** (`SidebarFooter`, `SidebarSeparator`) exportados em `src/components/ui/sidebar.tsx`.
- O usuário logado está disponível via `useAuth()`.

---

## Implementação (Frontend)

### 1) Criar `src/components/profile/ProfileDialog.tsx`
**Responsabilidade**: Modal com formulário para atualização de senha.

**UI**
- Dialog com:
  - Título: “Perfil” ou “Alterar senha”
  - Campo 1: “Nova senha” (`type="password"`, `autoComplete="new-password"`)
  - Campo 2: “Confirmar nova senha” (`type="password"`, `autoComplete="new-password"`)
  - Botão “Salvar”
  - (Opcional) Texto pequeno: “Mínimo 6 caracteres”.

**Validação**
- Validar no submit:
  - `newPassword.length >= 6`
  - `newPassword === confirmPassword`
- Vou usar `zod` + `react-hook-form` (mesmo padrão do `Auth.tsx`) para:
  - Mensagens claras
  - Manter consistência de arquitetura
- Se o usuário tentar salvar com erro:
  - `toast.error("…")` com mensagem amigável (ex: “As senhas não conferem”, “Senha muito curta”).

**Lógica Supabase**
- Ao salvar:
  - `await supabase.auth.updateUser({ password: newPassword })`
- Em caso de sucesso:
  - `toast.success("Senha atualizada com sucesso")`
  - Fechar dialog e resetar campos (para não ficar senha em memória/DOM)
- Em caso de erro:
  - `toast.error(error.message ?? "Erro ao atualizar senha")`
  - Manter modal aberto para o usuário tentar novamente

**Estados**
- `isSubmitting` para desabilitar botão e evitar double submit.
- Ao fechar o Dialog (cancelar/esc), limpar os campos.

**Observação importante (edge case)**
- O Supabase pode exigir “login recente” para ações sensíveis. Se vier erro do tipo “requires recent login”, vamos apenas mostrar o `error.message` via toast (ponto de melhoria futura: fluxo de reautenticação).

---

### 2) Integrar acesso na Sidebar (`src/components/layout/AppSidebar.tsx`)
Hoje a `AppSidebar` só renderiza menu. Vamos adicionar:
- Um `SidebarSeparator` antes do rodapé (opcional, mas melhora visual).
- Um `SidebarFooter` com:
  - E-mail do usuário logado (`useAuth().user?.email`)
  - Botão discreto com ícone (Lucide: `Settings` ou `UserCog`)
  - Ao clicar: abre o `ProfileDialog`

**Comportamento com sidebar colapsada**
- Quando colapsada:
  - Esconder o texto do e-mail (para não quebrar layout)
  - Manter apenas o botão ícone
  - Tooltip no ícone: “Perfil / Alterar senha”

**Estrutura sugerida**
- Dentro do `AppSidebar`:
  - `const { user } = useAuth();`
  - `const [profileOpen, setProfileOpen] = useState(false);`
  - Renderizar `<ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />` junto ao footer (ou no final do Sidebar) para ficar “perto” do gatilho.

**Acessibilidade**
- Botão com `aria-label="Perfil"` e `title`/Tooltip.
- Labels vinculados aos inputs.

---

## Testes manuais (checklist)
1. Logar com qualquer usuário.
2. Abrir o modal pelo ícone na Sidebar.
3. Tentar salvar com senha < 6 → deve bloquear e mostrar toast de erro.
4. Tentar salvar com senhas diferentes → deve bloquear e mostrar toast de erro.
5. Salvar com senha válida → toast success + modal fecha.
6. Fazer logout e login com a nova senha → deve funcionar.
7. Testar no modo sidebar colapsado (ícone visível + tooltip).

---

## Arquivos que serão alterados/criados
- Criar: `src/components/profile/ProfileDialog.tsx`
- Editar: `src/components/layout/AppSidebar.tsx`

---

## Possíveis melhorias futuras (não vou fazer agora, mas deixo mapeado)
- Exigir “Senha atual” antes de permitir troca (mais segurança).
- Fluxo de reautenticação quando o Supabase retornar erro de “recent login”.
- Adicionar “Mostrar/ocultar senha” (ícone Eye) nos inputs.
