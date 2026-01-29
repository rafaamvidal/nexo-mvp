
Objetivo
- Corrigir 2 comportamentos:
  1) Em **Compras > Novo Pedido**, exibir corretamente a **unidade de medida** (kg, L, un, g) para cada item.
  2) Em **Estoque (Movimentação Rápida)**, **não listar produtos Inativos**.

Diagnóstico rápido (onde está o problema hoje)
1) Compras
- A tela `src/pages/Compras.tsx` monta os itens do pedido com: **produto + quantidade + custo**, mas:
  - `fetchRawMaterials()` busca apenas `id,name,price_cost` (não traz `unit`)
  - A UI do item não mostra unidade em lugar nenhum.

2) Estoque
- A página `src/pages/Estoque.tsx` faz:
  - `supabase.from("products").select(...).order("name")`
  - Sem filtro de status ⇒ produtos “Inativo” continuam aparecendo.

Decisão confirmada por você
- “Padronizar no cadastro do produto”:
  - Vamos padronizar o campo **Unidade** no cadastro/edição de produto (kg, L, un, g) e refletir automaticamente em Compras.

Plano de correção (passo a passo)

1) Padronizar unidade no cadastro de produto (kg, L, un, g)
Arquivo: `src/components/inventory/ProductFormSheet.tsx`

1.1 UI
- Trocar o campo “Unidade” de `<Input>` para um **Select** com opções:
  - `un`, `kg`, `g`, `L`
- Para não quebrar produtos antigos que tenham unidade diferente:
  - Se ao editar o produto a unidade atual **não estiver** na lista, mostrar uma opção “Outra (manter atual)” e permitir editar via input (fallback).
  - Assim você consegue padronizar aos poucos sem travar a edição.

1.2 Validação
- Manter o schema como `z.string().trim().min(1)` (não transformar em `z.enum`), justamente para:
  - não bloquear edição de registros antigos com unidade fora do padrão.
- (Opcional) Normalizar unidade no submit:
  - Ex.: garantir `L` maiúsculo; `kg`/`g` minúsculo.

Resultado esperado
- Todo produto novo passa a sair com unidade padronizada.
- Produtos antigos continuam editáveis (sem quebrar o formulário).

2) Mostrar unidade de medida no Novo Pedido/Editar Pedido de Compra
Arquivo: `src/pages/Compras.tsx`

2.1 Dados
- Alterar `ProductRawRow` para incluir `unit`:
  - de: `{ id; name; price_cost }`
  - para: `{ id; name; price_cost; unit }`
- Alterar `fetchRawMaterials()` para selecionar também `unit`:
  - `select("id,name,price_cost,unit")`

2.2 UI (Novo Pedido)
- Para cada linha de item:
  - Detectar o produto selecionado e sua unidade (via `(raws ?? []).find(p => p.id === it.product_id)?.unit`)
  - Exibir a unidade de forma clara:
    - Ajustar placeholder da quantidade para algo como `Qtd (kg)` / `Qtd (L)` / `Qtd (un)` / `Qtd (g)`
    - E/ou mostrar um pequeno texto/badge ao lado do input (ex.: “kg”)
- Repetir o mesmo ajuste na seção de **Editar Pedido**, pois ela usa o mesmo layout de itens.

Resultado esperado
- Ao selecionar “Açúcar (kg)” a linha mostra “Qtd (kg)”.
- Unidades padronizadas vindas do cadastro.

3) Remover produtos inativos do Estoque (Movimentação Rápida)
Arquivo: `src/pages/Estoque.tsx`

3.1 Ajuste de query
- Alterar `fetchProductsLite()` para filtrar apenas ativos:
  - adicionar `.eq("status", "Ativo")`
- Assim a aba Estoque não mostra itens inativados/excluídos logicamente.

3.2 Garantir consistência de cache
- A query key `["products","lite"]` é usada apenas no Estoque (confirmado).
- Portanto, o ajuste não deve afetar outras páginas.

Checklist de testes (end-to-end)
1) Produtos
- Criar um produto novo e selecionar unidade no Select (ex.: kg).
- Editar um produto antigo com unidade fora do padrão e confirmar que ainda dá para salvar.

2) Compras
- Abrir “Novo Pedido de Compra”
- Selecionar um item e confirmar que aparece “Qtd (un/kg/L/g)” conforme o produto.
- Abrir “Editar Pedido de Compra” e confirmar o mesmo.

3) Estoque
- Inativar um produto na aba Produtos.
- Ir na aba Estoque e confirmar que ele não aparece mais.

Arquivos que serão alterados
- `src/components/inventory/ProductFormSheet.tsx` (padronização do campo Unidade)
- `src/pages/Compras.tsx` (mostrar unidade em Novo/Editar pedido + buscar unit)
- `src/pages/Estoque.tsx` (filtrar status=Ativo)

Observação extra (não é parte da correção, mas apareceu no console)
- Existe um warning de `ref` no `Skeleton` dentro de `DashboardHome`. Não bloqueia o uso, mas vale tratar depois (provável forwardRef em um componente de UI). Posso resolver em uma tarefa separada para não misturar com as correções acima.
