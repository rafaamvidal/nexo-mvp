
## Diagnóstico (por que você ainda não consegue excluir o produto)
- O banco está bloqueando a exclusão do **produto** por causa do FK:
  - `stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`
- Isso significa: **se existir qualquer movimentação de estoque** (entrada/saída/ajuste rápido/recebimento/faturamento etc.) para aquele produto, o produto **nunca poderá ser apagado** — mesmo que você já tenha excluído Venda/Compra/Produção.
- Além disso, a tabela `stock_movements` está corretamente “imutável” (RLS nega DELETE/UPDATE), então “apagar o histórico para conseguir deletar o produto” não é uma opção segura (e nem recomendada).

## Decisão já confirmada
- Você escolheu: **“Inativar (recomendado)”** quando houver movimentações.
- E: **ocultar inativos por padrão** na listagem.

## Objetivo desta entrega
- Manter o comportamento seguro do banco (histórico de movimentações preservado).
- Fazer a UX do módulo **Produtos** ficar correta e intuitiva:
  - Quando não dá para excluir (por histórico), permitir **Inativar**.
  - Produtos inativos somem da lista (por padrão), mas podem ser exibidos via filtro.

---

## Alterações planejadas (Frontend)

### 1) Ajustar mensagem/fluxo quando falhar a exclusão por FK (23503)
**Onde:** `src/pages/Produtos.tsx` e `src/lib/supabaseErrors.ts`

- Em vez do toast genérico “atrelado a outro módulo”, vamos explicar o motivo real:
  - “Não é possível excluir porque existe histórico de movimentações de estoque para este produto.”
- A partir desse ponto, oferecer ação clara: **Inativar produto**.

Implementação proposta:
- Manter `isForeignKeyViolation` como está.
- Evoluir `toastDeleteBlocked(...)` (ou criar uma variante específica) para suportar um texto mais correto para Produto, por exemplo:
  - `toast.error("Não é possível excluir: este produto possui histórico de movimentações de estoque. Use 'Inativar' para removê-lo do cadastro sem perder histórico.")`

### 2) Criar ação “Inativar” no módulo Produtos
**Onde:** `src/pages/Produtos.tsx`

- Adicionar uma mutation `inactivateMutation`:
  - `update products set status = 'Inativo' where id = ...`
- UI:
  - No menu/coluna “Ações”, adicionar um botão/ícone para **Inativar** (com confirmação).
  - Alternativamente (e melhor UX): quando o usuário clicar Excluir e der 23503, abrir um `AlertDialog` oferecendo:
    - **Cancelar**
    - **Inativar produto**
  - Ao inativar:
    - toast success “Produto inativado”
    - invalidar query `["products"]`

Regras:
- Se o produto já estiver “Inativo”, esconder o botão de inativar (ou trocar para “Reativar”, se você quiser — posso deixar preparado, mas só implemento se você pedir).

### 3) Ocultar produtos Inativos por padrão + alternância para exibir
**Onde:** `src/pages/Produtos.tsx`

- Adicionar um estado local: `showInactive` (default `false`)
- Ajustar `fetchProducts()` ou o `useMemo` do filtro:
  - Por padrão: filtrar fora `status = 'Inativo'`
  - Se `showInactive = true`, mostrar tudo
- Na UI perto dos filtros/busca:
  - adicionar um `Switch` ou `Checkbox`: “Mostrar inativos”
- Quando inativos estiverem visíveis, mostrar um `Badge` “Inativo” na linha.

### 4) Ajustar contadores e cards para respeitar o filtro (ou explicitar)
**Onde:** `src/pages/Produtos.tsx`

Hoje:
- “Itens cadastrados” usa `(data ?? []).length` (inclui inativos, se existirem).
- “Estoque baixo” e “Valor total em estoque” também usam `data`.

Proposta:
- Por padrão, calcular esses cards com base apenas em **ativos** (para bater com o que o usuário vê).
- Se `showInactive = true`, você pode escolher:
  - (A) manter os cards considerando tudo (ativos + inativos), ou
  - (B) continuar considerando apenas ativos, mas mostrar um texto pequeno “Considera apenas ativos”.
Eu vou implementar (B) para evitar confusão e manter KPI coerente com operação.

---

## Alterações planejadas (Banco) — NÃO necessárias para resolver seu problema
- Nenhuma mudança de schema é necessária para esse ajuste.
- Não vamos mexer no FK `ON DELETE RESTRICT` (ele é o que garante integridade + auditoria).

---

## Teste end-to-end (roteiro de validação)
1) Criar produto, fazer um ajuste de estoque (+ / -).
2) Tentar excluir o produto:
   - Deve bloquear exclusão e oferecer opção de **Inativar** (sem erro técnico).
3) Inativar produto:
   - Deve sumir da lista (com “Mostrar inativos” desligado).
4) Ligar “Mostrar inativos”:
   - Produto aparece com badge “Inativo”.
5) Garantir que relatórios/módulos que listam produtos (Vendas/Compras/Produção) se comportam como esperado:
   - Se atualmente eles puxam produtos sem filtrar status, decidir depois se devemos esconder inativos também nesses selects (posso fazer isso numa próxima etapa, para não quebrar fluxos existentes).

---

## Arquivos que serão alterados
- `src/pages/Produtos.tsx`
- `src/lib/supabaseErrors.ts` (apenas mensagens/variações para ficar mais preciso no caso de produto)

---

## Observação importante (alinhamento de regra de negócio)
O comportamento correto é:
- **Documentos operacionais (vendas/compras/produção)** você pode excluir/cancelar.
- **Histórico de estoque (`stock_movements`)** deve permanecer para auditoria.
- Portanto, “Excluir produto” só será possível para produtos que **nunca tiveram movimentação**. Para os demais, o caminho correto é **Inativar**.
