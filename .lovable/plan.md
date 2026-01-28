
Objetivo
- Evitar conflito de cadastro quando o usuário tenta cadastrar um produto que já existe:
  - Se já existir Ativo com mesmo nome: bloquear e mostrar “Produto já cadastrado.”
  - Se já existir Inativo com mesmo nome: não criar novo; oferecer “Reativar e recuperar histórico”; ao confirmar, reativar e atualizar os campos com o que foi digitado (incluindo estoque, conforme sua decisão).
- Opcional: adicionar botão “Reativar” na listagem quando “Mostrar inativos” estiver ligado.

Contexto do código atual (o que encontrei)
- A tela `src/pages/Produtos.tsx` usa o componente `ProductFormSheet` para “Cadastrar produto” e “Editar”.
- A criação/edição de produto acontece dentro de `src/components/inventory/ProductFormSheet.tsx` via `upsertMutation`:
  - Se `product` existe: `update`
  - Se `product` não existe: `insert`
- Portanto, a lógica “Verificar antes de Criar” precisa ser implementada no `ProductFormSheet` (não apenas em `Produtos.tsx`), pois é ali que o insert acontece.

Decisões confirmadas por você (usadas no desenho)
- Chave de duplicidade: “Apenas Nome”
- Reativação e estoque: “Usar estoque do formulário” (ou seja: na reativação, vamos atualizar `current_stock` com o valor digitado)

Escopo de implementação

1) Verificar antes de criar (no ProductFormSheet)
Arquivo: `src/components/inventory/ProductFormSheet.tsx`

1.1 Normalização do nome
- Antes de consultar e antes de salvar, normalizar o nome para reduzir falsos negativos por espaços:
  - `normalized = values.name.trim().replace(/\s+/g, " ")`
- Observação: o schema já faz `.trim()`, mas vamos reforçar para consulta e comparação.

1.2 Consulta silenciosa no Supabase
- Somente no cenário de “Novo Produto” (quando `product` não está definido).
- Executar uma query leve:
  - `from("products").select("id,name,status").ilike("name", normalized)`
  - `limit(5)` (por segurança)
- Como `ilike` aceita padrão, usaremos sem `%` para equivalência case-insensitive exata. Se houver risco de variações de espaços, fazemos a comparação final no client:
  - filtrar resultados com `normalizeName(row.name) === normalized`.

1.3 Cenário A: encontrou Ativo
- Critério: `(row.status ?? "Ativo") !== "Inativo"`
- Ação:
  - Não criar.
  - Mostrar erro no campo “Nome” usando `react-hook-form`:
    - `form.setError("name", { type: "validate", message: "Produto já cadastrado." })`
  - Manter o Sheet aberto.

1.4 Cenário B: encontrou Inativo (solução)
- Critério: `(row.status ?? "Ativo") === "Inativo"`
- Ação:
  - Não criar.
  - Abrir um `AlertDialog` controlado (novo estado local no `ProductFormSheet`) com texto:
    - “Encontramos um produto ‘{nome}’ inativo no sistema. Deseja reativá-lo e recuperar seu histórico?”
  - Guardar em estado:
    - `reactivateCandidateId` (id encontrado)
    - `pendingValues` (valores atuais do formulário que o usuário tentou salvar)

1.5 Confirmou reativação
- Criar uma mutation dedicada (ou reutilizar `upsertMutation` com um modo “reactivate”, mas prefiro separado para legibilidade):
  - `reactivateMutation`:
    - `update products set status='Ativo', ...camposDoFormulario... where id = reactivateCandidateId`
- Campos atualizados na reativação (conforme seu pedido + consistência do cadastro):
  - `status: "Ativo"`
  - `name`, `type`, `category`, `unit`, `min_stock`, `price_cost`, `price_sale`, `current_stock`
- Sucesso:
  - Toast: “Produto reativado com sucesso!”
  - Invalidar `["products"]`
  - Fechar AlertDialog e Sheet
  - Reset do form

1.6 Cancelou reativação
- Apenas fecha o AlertDialog e mantém o formulário aberto para o usuário ajustar (sem criar nada).

1.7 Tratamento de concorrência (edge case)
- Se por alguma razão, no momento da reativação o update falhar (ex.: RLS, rede), mostrar toast com `e.message`.
- Se existirem múltiplos produtos inativos com o mesmo nome (não deveria, mas pode ocorrer):
  - Vamos escolher o primeiro match (ordenar por `created_at desc` se necessário; hoje o select não traz `created_at`, então ou incluímos ou aceitamos o primeiro retornado).
  - Opcional futuro: apresentar lista de candidatos para escolher. Não faremos agora para manter simples.

2) Refinamento visual opcional: botão “Reativar” na listagem
Arquivo: `src/pages/Produtos.tsx`

2.1 UI
- Quando `showInactive` estiver ligado e a linha estiver `inactive === true`:
  - Exibir um botão de ação “Reativar” ao lado de Editar/Excluir/Ajuste Rápido.
  - Ícone sugerido: `RotateCcw` ou `RefreshCw` (lucide-react).

2.2 Comportamento
- `reactivateMutation` (novo no `Produtos.tsx`):
  - `update products set status='Ativo' where id = ...`
  - (Opcional: não mexer em outros campos aqui; é uma reativação simples)
- Sucesso:
  - Toast: “Produto reativado”
  - Invalidar `["products"]`
- Observação de UX:
  - Quando reativar, como a lista por padrão esconde inativos, se `showInactive` estiver false o item já voltará a aparecer normalmente. Se `showInactive` estiver true, ele seguirá visível, mas sem badge “Inativo”.

Arquivos que serão alterados
- `src/components/inventory/ProductFormSheet.tsx`
  - Implementar verificação antes de criar
  - Implementar AlertDialog de reativação
  - Implementar `reactivateMutation`
- `src/pages/Produtos.tsx` (opcional, conforme seu item 2)
  - Adicionar botão “Reativar” quando estiver exibindo inativos
  - Adicionar mutation de reativação simples

Sem alterações no banco
- Não vamos criar constraint unique agora.
- A solução é toda no fluxo do app (como você solicitou).

Roteiro de teste end-to-end (para você validar)
1) Com “Mostrar inativos” ligado, inative um produto qualquer (ex.: “Açúcar”).
2) Tente cadastrar um novo produto com o mesmo nome “Açúcar”:
   - Deve abrir o AlertDialog perguntando se deseja reativar.
3) Confirme:
   - Deve reativar o produto existente (mesmo ID), atualizar campos (incluindo estoque), e mostrar toast “Produto reativado com sucesso!”.
4) Agora tente cadastrar novamente “Açúcar” (com ele Ativo):
   - Deve dar erro no campo “Nome”: “Produto já cadastrado.”
5) (Opcional) Com “Mostrar inativos” ligado, clique “Reativar” direto na linha:
   - Deve voltar para Ativo e atualizar a listagem.

Notas técnicas (para evitar bugs comuns)
- Usar `form.setError` para o erro “Produto já cadastrado” garante que o feedback fica no campo como você pediu.
- Não usar `.single()` na consulta de verificação, porque pode não haver resultado (melhor trabalhar com array).
- Garantir que a verificação só roda no fluxo “novo produto” para não atrapalhar edição.
