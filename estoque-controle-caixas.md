# Plano de Implementação: Controle de Estoque por Caixa e Unidade (`estoque-controle-caixas`)

## 1. Visão Geral (Overview)
Permitir que o controle de estoque funcione simultaneamente em **Unidades (`un`)** e **Caixas (`cx` / embalagens secundárias)** em todo o ERP, atendendo especialmente produtos acabados como a **Trufa (armazenada em caixas de 200 unidades)** e qualquer outro produto ou insumo com capacidade de caixa configurada.

### Decisões Alinhadas (Socratic Gate)
1. **Exibição Dupla Automática:** Mostrar o saldo simultaneamente em unidades e caixas (ex: `1.250 un` • `6 cx + 50 un` ou `6,25 cx`), mantendo a unidade base no banco para preservar fichas técnicas, custos unitários e vendas.
2. **Operações em Caixas ou Unidades em Todas as Telas:** Permitir lançar/ajustar quantidades tanto em **Caixas** quanto em **Unidades** no **Apontamento de Produção (Produzir Lote)**, **Ajuste Rápido (`+/- 1 cx` e `+/- 1 un`)** e **Edição Manual de Estoque**.
3. **Configuração por Produto (com suporte nativo a 200 un/cx para Trufas):** Permitir definir quantas unidades cabem na caixa no cadastro de cada produto (incluindo Produtos Finais) e também diretamente no modal de ajuste de estoque, com reconhecimento inteligente de `200 un/cx` para Trufas.

---

## 2. Tipo de Projeto (Project Type)
- **Tipo:** **WEB** (React + TypeScript + Tailwind CSS + Supabase)
- **Agentes Envolvidos:** `project-planner`, `frontend-specialist`
- **Skills Aplicadas:** `clean-code`, `brainstorming`, `frontend-design`

---

## 3. Critérios de Sucesso (Success Criteria)
- [x] Produtos podem ter capacidade de caixa (`packageSize`, ex: `200 un`) configurada mesmo sem preço de compra de fornecedor (caso de Produtos Finais fabricados internamente).
- [x] Produtos da linha "Trufa" reconhecem automaticamente `Caixa de 200 un` caso ainda não possuam metadado salvo, permitindo personalização a qualquer momento.
- [x] Telas de **Estoque** e **Produtos** (mobile e desktop) exibem o saldo em unidades e a conversão automática em caixas fechadas + unidades avulsas (ex: `6 cx + 50 un`).
- [x] **Ajuste Rápido (`StockQuickAdjust`)** permite incrementar/decrementar tanto `+1/-1 un` quanto `+1/-1 cx` quando o produto possui caixa configurada.
- [x] **Edição de Estoque (`StockEditDialog`)** permite informar o saldo em **Caixas + Unidades Soltas** ou em **Unidades Totais**, além de permitir configurar/alterar a capacidade da caixa ali mesmo.
- [x] **Apontar Produção (`ProduceBatchDialog`)** permite lançar a produção do lote em **Unidades**, **Caixas Fechadas** ou **Caixas + Unidades**, convertendo automaticamente para o saldo e histórico (Kardex).
- [x] **Extrato / Kardex (`StockMovementsHistory`)** exibe a equivalência em caixas nas movimentações de produtos que utilizam caixa.

---

## 4. Estrutura de Arquivos Afetados (File Structure)
```text
src/
├── lib/
│   └── packageConversion.ts               # Suporte a caixas sem custo obrigatório, cálculo de caixas fechadas + avulsas e fallback Trufa 200 un
├── components/
│   └── inventory/
│       ├── ProductFormSheet.tsx           # Configuração de Caixa/Embalagem habilitada também para Produto Final + entrada de estoque em caixas
│       ├── StockQuickAdjust.tsx           # Botões rápidos para +/- 1 un e +/- 1 cx
│       ├── StockEditDialog.tsx            # Edição de saldo por Caixas + Unidades e configuração rápida de un/caixa
│       ├── ProduceBatchDialog.tsx         # Lançamento de lote produzido em Caixas e/ou Unidades
│       └── StockMovementsHistory.tsx      # Exibição de equivalência em caixas no histórico Kardex
└── pages/
    ├── Estoque.tsx                        # Exibição dupla (un + cx) nos cards de estoque e tabela de reposição
    └── Produtos.tsx                       # Exibição dupla (un + cx) nos cards mobile e tabela desktop
```

---

## 5. Quebra de Tarefas (Task Breakdown)

### Task 1: Evoluir Utilitário de Conversão de Caixas (`src/lib/packageConversion.ts`)
- **Agente:** `frontend-specialist` | **Skill:** `clean-code`
- **Prioridade:** P0 | **Dependências:** Nenhuma
- **INPUT:** Funções atuais de `packageConversion.ts` (focadas apenas em custo de compra).
- **OUTPUT:**
  - Suporte a `packagePrice >= 0` (opcional para produtos finais).
  - Função `resolveProductPackage(description, name, unit)` que lê `PKG:` ou aplica default `Caixa c/ 200 un` para produtos "Trufa" em `un` (salvo se desativado com `PKG:NONE`).
  - Função `calculateBoxBreakdown(stock, unit, pkg)` retornando caixas inteiras (`fullBoxes`), unidades soltas (`looseUnits`), total decimal de caixas e textos formatados.
- **VERIFY:** Testes unitários e checagem de tipos (`tsc --noEmit`).

### Task 2: Habilitar Configuração de Caixa para Produtos Finais no Cadastro (`src/components/inventory/ProductFormSheet.tsx`)
- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`, `clean-code`
- **Prioridade:** P1 | **Dependências:** Task 1
- **INPUT:** `ProductFormSheet.tsx` onde produtos finais não exibiam configuração de caixa.
- **OUTPUT:**
  - Seção "Controle por Caixa / Embalagem de Armazenamento" para Produtos Finais (com botões de atalho `200 un`, `100 un`, `50 un`, etc.).
  - Conversor integrado no campo "Estoque Inicial / Atual" permitindo preencher por caixas + unidades soltas.
- **VERIFY:** Cadastro e edição de Produto Final salvam e carregam `PKG:` na descrição sem afetar custo unitário.

### Task 3: Atualizar Componentes Operacionais (`StockQuickAdjust`, `StockEditDialog`, `ProduceBatchDialog`, `StockMovementsHistory`)
- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`, `clean-code`
- **Prioridade:** P1 | **Dependências:** Task 1
- **INPUT:** Componentes de ajuste rápido, modal de edição, modal de produção e histórico Kardex.
- **OUTPUT:**
  - `StockQuickAdjust`: adiciona botões `-1 cx` / `+1 cx` quando o produto tem capacidade de caixa.
  - `StockEditDialog`: abas/modos "Por Caixas + Unidades" e "Total em Unidades" + edição rápida de capacidade da caixa.
  - `ProduceBatchDialog`: seletor para apontar produção em "Caixas + Unidades" ou "Unidades".
  - `StockMovementsHistory`: mostra equivalência em caixas nas movimentações.
- **VERIFY:** Ajustes e lotes calculam exatamente `caixas * tamanho + avulsas` e atualizam o Supabase.

### Task 4: Exibição Dupla nas Telas `Estoque.tsx` e `Produtos.tsx`
- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`, `clean-code`
- **Prioridade:** P2 | **Dependências:** Tasks 1, 2, 3
- **INPUT:** Páginas `src/pages/Estoque.tsx` e `src/pages/Produtos.tsx`.
- **OUTPUT:**
  - Exibição clara de `Unidades` + badge `📦 X cx + Y un` (ou `X cx fechadas`) e capacidade da caixa (`Caixa c/ 200 un`).
  - Passagem das propriedades de embalagem para os modais e botões rápidos.
- **VERIFY:** Build sem erros (`npm run build`), testes (`vitest`) e verificação visual.

### Task 5: Vendas por Caixa e Comprovante (`Vendas.tsx` e `SalePrintDialog.tsx`)
- **Agente:** `frontend-specialist` | **Skill:** `frontend-design`, `clean-code`
- **Prioridade:** P1 | **Dependências:** Task 1
- **INPUT:** Tela de Vendas (`src/pages/Vendas.tsx`) e Comprovante (`src/components/sales/SalePrintDialog.tsx`).
- **OUTPUT:**
  - Painel de venda em Caixas (`Qtd Caixas (cx)` + `Avulsas (un)` + `Valor da Caixa (R$)` + atalhos `1 cx`, `2 cx`, `5 cx`, `+1 cx`) sincronizado em tempo real com a quantidade total e o valor unitário vendido.
  - Exibição do estoque disponível em unidades e caixas no lançamento do pedido.
  - Registro da equivalência em caixas no motivo da movimentação de estoque (`apply_movement`) e no comprovante impresso / resumo WhatsApp.
- **VERIFY:** `npx tsc --noEmit`, `npx vitest run` e `npm run build` com 0 erros.

---

## 6. Phase X: Checklist de Verificação Final
- [x] `npx tsc --noEmit` sem erros de tipagem
- [x] Testes unitários da lógica de conversão de caixas passando (`5 passed`)
- [x] `npm run build` concluído com sucesso
- [x] Sem cores roxas/violetas novas (Purple Ban respeitado)
- [x] Socratic Gate respeitado

## ✅ PHASE X COMPLETE
- Lint & TypeScript: ✅ Pass
- Unit Tests (`vitest`): ✅ 5/5 Pass
- Build (`vite build`): ✅ Success
- Date: 2026-10-18
