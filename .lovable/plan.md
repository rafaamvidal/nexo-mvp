
Objetivo: corrigir regras de negócio (estoque/financeiro), padronizar tratamento de erros (FK 23503) e adicionar ações de editar/excluir em todos os módulos (Vendas, Compras, Produção, Financeiro, Cadastros e Produtos), mantendo Supabase + React + Shadcn + Sonner toast.

---

## 0) Diagnóstico do estado atual (o que encontrei no código)
- **Exclusões (Produtos/Clientes/Fornecedores)** hoje fazem `delete()` e, em caso de falha, exibem `toast.error(e.message)`. Isso mostra erro técnico e “quebra a UX” quando ocorre **FK violation (SQLSTATE 23503)**.
- **Vendas**: ao salvar, o sistema dá baixa no estoque para qualquer status diferente de “Orçamento” (inclui “Pedido”) — **regra atual está errada**.
- **Compras**: “Receber Pedido” faz entrada no estoque e cria `financial_records` (Pagar), mas:
  - não há CRUD completo (editar/excluir),
  - não há lógica de **cancelamento com estorno**.
- **Produção**: “Finalizar” faz entrada no estoque; falta CRUD e cancelamento com estorno.
- **Financeiro**: não há editar/excluir; e a sincronização com documentos operacionais não é idempotente (não existe vínculo forte no schema).
- Você confirmou preferências:
  - Vendas terão: **Orçamento, Pedido, Faturado, Entregue, Cancelado**
  - Financeiro automático: **preferência por adicionar coluna no banco**
  - Cancelamento em Compras/Produção: **cancelar trava itens**

---

## 1) Mudança de banco (para sincronização idempotente do Financeiro)
### 1.1. O que será adicionado
Criar colunas em `financial_records` para vínculo estável:
- `sale_id uuid null`
- `purchase_order_id uuid null`

E FKs “não-bloqueantes”:
- `sale_id` → `sales(id)` **ON DELETE SET NULL**
- `purchase_order_id` → `purchase_orders(id)` **ON DELETE SET NULL**

Índices / unicidade (para evitar duplicação):
- Índice em `sale_id`
- Índice em `purchase_order_id`
- **Índice único parcial** para garantir 1 “Receber” por venda:
  - unique(sale_id) WHERE sale_id IS NOT NULL AND type='Receber'
- **Índice único parcial** para garantir 1 “Pagar” por compra:
  - unique(purchase_order_id) WHERE purchase_order_id IS NOT NULL AND type='Pagar'

RLS: manter “authenticated only” igual ao padrão atual (não abrir dados).

### 1.2. Impacto
- A sincronização do financeiro vira “cria ou atualiza” com segurança.
- Deletar venda/compra não ficará travado pelo financeiro (o FK faz SET NULL).

---

## 2) Tratamento Global de Erro de FK (23503) em todas exclusões
### 2.1. Implementação (frontend)
Criar um utilitário único, por exemplo:
- `src/lib/supabaseErrors.ts` (ou `src/lib/errors.ts`)

Funções previstas:
- `isForeignKeyViolation(err: unknown): boolean`
  - checa `err.code === "23503"` (PostgrestError)
  - fallback: `String(err.message).includes("23503")` ou `includes("violates foreign key constraint")`
- `toastDeleteBlocked(contextLabel: string)`
  - toast amigável:
    - **Título/Texto**: “Exclusão bloqueada: Este item possui movimentações. Cancele as vendas/compras associadas antes de excluir.”
  - opcional: ajustar a palavra final conforme o módulo:
    - Produto: “...vinculado a Estoque/Vendas/Compras.”
    - Cliente: “...vinculado a Vendas.”
    - Fornecedor: “...vinculado a Compras.”

### 2.2. Onde aplicar
Em **todas** as mutações de delete:
- `src/pages/Produtos.tsx`
- `src/pages/Cadastros.tsx` (clientes e fornecedores)
- `src/pages/Vendas.tsx` (vendas + sale_items)
- `src/pages/Compras.tsx` (purchase_orders + purchase_items)
- `src/pages/Producao.tsx` (manufacturing_orders)
- `src/pages/Financeiro.tsx` (financial_records)

Padrão por mutation:
- `mutationFn`: `try/catch` em volta da chamada Supabase
- `catch`: se `isForeignKeyViolation(e)` então `toastDeleteBlocked("Vendas/Compras/Estoque")`, senão `toast.error(...)`
- Observação: manter a UI sempre estável e sem expor mensagem técnica.

---

## 3) Vendas — Editar/Excluir + Correção crítica de Estoque + Cancelamento + Status novos
### 3.1. UI
Na tabela de listagem (`Vendas.tsx`):
- Adicionar coluna “Ações” com ícones:
  - Editar (Pencil)
  - Excluir (Trash2) com `AlertDialog` confirmando

### 3.2. Status suportados
Atualizar o Select de status para:
- Orçamento
- Pedido
- Faturado
- Entregue
- Cancelado

### 3.3. Regra nova (estoque)
Definição:
- “Status que movimenta estoque (Saída)”: **Faturado** e **Entregue**
- “Status que não movimenta”: Orçamento, Pedido
- “Cancelado”: se já tinha movimentado, faz **estorno (Entrada)**

### 3.4. Editar venda (lógica robusta)
Ao clicar Editar:
- Abrir Sheet/Modal “Editar Venda”
- Carregar:
  - `sales` (registro)
  - `sale_items` (itens atuais)
- Se status atual = Cancelado:
  - travar edição de itens (somente leitura)
  - permitir apenas atualizar campos “observations” (se existir) e talvez status (se você desejar permitir reabrir; como você pediu “cancelado trava itens”, vamos manter itens travados e permitir apenas visualizar)
  - por segurança: **não permitir voltar de Cancelado** neste MVP (ou permitir apenas voltar para Pedido/Orçamento sem mexer em itens, mas sem estoque automático). Vou implementar conforme “Cancelar trava itens”: Cancelado impede editar itens/quantidade; status pode ser mantido Cancelado apenas.

#### 3.4.1. Movimento de estoque por transição de status
No “Salvar edição”, comparar `prevStatus` e `nextStatus`:
- Caso A: `prev` não estava em {Faturado,Entregue} e `next` está em {Faturado,Entregue}
  - Para cada item: `apply_movement` Saída (quantidade)
- Caso B: `prev` estava em {Faturado,Entregue} e `next` NÃO está em {Faturado,Entregue}
  - Para cada item: `apply_movement` Entrada (estorno)
- Caso C: `prev` e `next` ambos em {Faturado,Entregue}
  - Se itens mudaram (produto/quantidade):
    - calcular diff item-a-item:
      - para cada product_id: `delta = newQty - oldQty`
      - se `delta > 0`: aplicar Saída de `delta`
      - se `delta < 0`: aplicar Entrada de `abs(delta)`
  - Isso evita “duplicar baixa” e corrige ajustes com venda já faturada/entregue.
- Caso D: `prev` e `next` ambos fora do conjunto {Faturado,Entregue}
  - Não mexe estoque.

Observação: usaremos `p_reference_id = saleId` e `p_reason` detalhando “Venda (Faturamento/Entrega/Estorno/Ajuste)”.

### 3.5. Financeiro (idempotente) em Vendas
Quando status passar para **Faturado** ou **Entregue**:
- Upsert em `financial_records`:
  - procurar `financial_records` onde `sale_id == saleId` e `type == 'Receber'`
  - se existe:
    - atualizar `amount`, `entity_name`, `status` (ex: manter “Aberto” se estava Aberto; se estava “Pago”, não rebaixar)
  - se não existe:
    - inserir com `sale_id = saleId`, `type='Receber'`, `category='Vendas'`, `due_date=today`, `status='Aberto'`

Quando status virar **Cancelado**:
- Atualizar o financeiro vinculado (se existir) para algo como:
  - `status = 'Cancelado'` (precisa confirmar se você aceita esse status no financeiro)
  - alternativa MVP: manter “Aberto” e adicionar “(Cancelado)” na descrição (menos ideal)
  
Como seu pedido exige vínculo mantido mas não exige “conta cancelada”, vou implementar:
- se existir e `status != 'Pago'`: setar `status = 'Cancelado'`
- se `status == 'Pago'`: não mexer (não “despaga”)

(Se hoje o campo `status` do financeiro é texto livre, isso funciona sem migração adicional.)

---

## 4) Compras — Editar/Excluir + Aviso pós-recebimento + Cancelamento com estorno
### 4.1. UI
Na listagem de `purchase_orders`:
- Adicionar coluna de ações:
  - Editar (Pencil) abre Dialog “Editar Pedido”
  - Excluir (Trash2) com AlertDialog
  - Manter “Receber Pedido” (CheckCircle2)
  - Adicionar “Cancelar” (XCircle) ou opção no status

### 4.2. Editar pedido
No Dialog de edição:
- Campos editáveis sempre:
  - `observations`, `order_date`, `expected_delivery_date`, `status` (com regras abaixo)
- Itens:
  - Se status != Recebido e != Cancelado: itens editáveis
  - Se status == Recebido: itens podem até aparecer editáveis, mas ao alterar quantidade/produto:
    - exibir `AlertDialog`: “Atenção: alterar quantidades de um pedido Recebido afetará o estoque.”
    - se confirmar:
      - aplicar correção no estoque via diff:
        - `delta = newQty - oldQty`
        - `delta > 0` → `apply_movement` Entrada (entrou a mais)
        - `delta < 0` → `apply_movement` Saída (estorno do excesso anterior)
- Se status == Cancelado: travar itens (somente leitura)

### 4.3. Regra de cancelamento
Se status mudar para **Cancelado** e o pedido **já foi Recebido** (prevStatus == Recebido):
- Fazer estorno automático removendo o que entrou:
  - para cada item: `apply_movement` tipo **Saída**
- Atualizar pedido: status Cancelado
- Financeiro: localizar `financial_records` com `purchase_order_id`:
  - se existe e não está Pago: set `status='Cancelado'` (ou similar)

### 4.4. Financeiro idempotente em Compras
Quando pedido for marcado como **Aprovado** ou **Recebido**:
- Upsert em `financial_records`:
  - `purchase_order_id = poId`, `type='Pagar'`
  - se existe: atualizar valor/datas/status (não rebaixar se Pago)
  - se não existe: inserir

Quando “Receber Pedido” for acionado:
- Garantir que:
  1) dá entrada em estoque (como hoje)
  2) atualiza status para Recebido
  3) chama upsert do financeiro

---

## 5) Produção — Editar/Excluir + Cancelamento com estorno do produto final
### 5.1. UI
Na listagem de `manufacturing_orders`:
- Adicionar ações:
  - Editar (Pencil)
  - Excluir (Trash2)
  - Cancelar (XCircle) / status Cancelada
- Manter controles existentes:
  - Select de status (Planejada, Em Produção, Finalizada)
  - Botão “Finalizar”

### 5.2. Regras
- Ao “Finalizar” (como hoje):
  - `apply_movement` Entrada para o produto final
  - status = Finalizada
- Ao cancelar uma ordem que já estava **Finalizada**:
  - chamar `apply_movement` **Saída** (remove o produto final que entrou)
  - status = Cancelada
- Se Cancelada:
  - travar edição e impedir finalizar novamente

### 5.3. Editar ordem
Permitir editar:
- `quantity`, `product_id` apenas quando status = Planejada (ou Em Produção, se você permitir)
- Se status Finalizada: bloquear edição de produto/quantidade (para não quebrar estoque no MVP)
- Se o usuário insistir em alterar quantidade de Finalizada (não recomendado):
  - (vamos evitar nesta entrega para manter estabilidade)

---

## 6) Financeiro — Editar/Excluir + vínculo preservado
### 6.1. UI
Na tabela de lançamentos:
- Coluna “Ações” com:
  - Editar (Pencil) → Dialog reaproveitando o formulário, com valores iniciais
  - Excluir (Trash2) → AlertDialog

### 6.2. Regras de sincronização
- Ao marcar venda como Faturada/Entregue e compra como Recebida/Aprovada:
  - se registro financeiro já existe (via `sale_id` / `purchase_order_id`), atualizar.
- Se usuário marcar “Pago” no Financeiro:
  - não mexer em estoque (como você pediu)
  - manter vínculo (sale_id/purchase_order_id permanece)

Nota: vamos manter a edição de `financial_records` sem mexer nesses campos de vínculo (somente leitura para evitar quebrar rastreabilidade).

---

## 7) Cadastros e Produtos — aplicar FK-friendly delete
### 7.1. Cadastros
- Ajustar `delClient` e `delSupplier` para `try/catch` + `23503`:
  - Mensagem amigável específica:
    - Cliente: “Não é possível excluir este cliente pois ele está vinculado a Vendas...”
    - Fornecedor: “...vinculado a Compras...”
- (Opcional) adicionar AlertDialog antes de excluir, para padrão Premium.

### 7.2. Produtos
- O botão de exclusão já existe; apenas trocar o `onError` para usar o handler de FK 23503 com mensagem amigável.
- Manter `StockQuickAdjust` e demais ações.

---

## 8) Sequência de implementação (para reduzir risco)
1) **Migração do banco**: adicionar colunas e índices em `financial_records`.
2) Criar util `isForeignKeyViolation()` + `toastDeleteBlocked()`.
3) Aplicar util em **Produtos** e **Cadastros** (impacto imediato e simples).
4) Implementar CRUD em **Financeiro** (edit/delete).
5) Refatorar **Vendas**:
   - adicionar status novos
   - corrigir regra de baixa de estoque
   - adicionar editar/excluir
   - implementar upsert financeiro via `sale_id`
6) Refatorar **Compras**:
   - adicionar editar/excluir
   - implementar cancelamento + estorno
   - upsert financeiro via `purchase_order_id`
7) Refatorar **Produção**:
   - editar/excluir
   - cancelamento com estorno do produto final
8) Revisar invalidações React Query:
   - após ações críticas, invalidar: `products`, `stock_movements` (se houver página), `financial_records`, e a lista do módulo.

---

## 9) Critérios de aceite / Testes end-to-end (roteiro)
- Exclusão:
  - tentar excluir Produto/Cliente/Fornecedor com vínculos → NÃO aparece erro técnico; aparece toast amigável.
- Vendas:
  - criar venda como Pedido → estoque NÃO muda
  - editar status para Faturado → estoque baixa; financeiro cria/atualiza “Receber”
  - editar status para Cancelado → estoque estorna; itens travados; financeiro status “Cancelado” (se não Pago)
  - editar itens enquanto Faturado/Entregue → estoque ajusta apenas pela diferença
- Compras:
  - receber pedido → estoque entra; financeiro “Pagar” cria/atualiza
  - cancelar pedido recebido → estoque estorna (Saída) do que entrou
  - editar itens de pedido recebido → alerta + ajuste de estoque por diff
- Produção:
  - finalizar → entrada
  - cancelar finalizada → saída (remove produto final do estoque)
- Financeiro:
  - editar lançamento manual → reflete na lista
  - excluir lançamento → toast amigável se houver bloqueio (se algum FK futuro existir)

---

## Arquivos que serão alterados/criados (estimativa)
- Novo util:
  - `src/lib/supabaseErrors.ts` (novo)
- Migração:
  - `supabase/migrations/YYYYMMDD..._financial_records_links.sql` (novo)
- Páginas:
  - `src/pages/Vendas.tsx`
  - `src/pages/Compras.tsx`
  - `src/pages/Producao.tsx`
  - `src/pages/Financeiro.tsx`
  - `src/pages/Cadastros.tsx`
  - `src/pages/Produtos.tsx`

---

## Observações técnicas (para manter estabilidade)
- Todas as chamadas a `apply_movement` continuarão passando quantidades > 0 e tipo “Entrada/Saída”.
- Em operações com múltiplos itens (venda/compra), o ideal é manter atomicidade; como `apply_movement` é 1 item por chamada, o MVP será “melhor esforço” com try/catch e mensagens claras. Se você quiser, depois podemos criar uma RPC “apply_sale_stock_movements(json)” para transação única.
- Para evitar duplicidade de registros financeiros, o vínculo via `sale_id/purchase_order_id` + índice único parcial será o mecanismo principal.

