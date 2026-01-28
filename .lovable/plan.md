
Objetivo (o que será entregue)
- Criar 2 novas páginas (rotas) acessíveis pela Sidebar:
  1) `/relatorios`: visão analítica (vendas por mês, status compras, Curva A, exportar)
  2) `/custos`: análise de margem por produto final + edição rápida de custo/preço
- Integrar na Sidebar com ícones apropriados.
- Manter padrões existentes do projeto: React Router + `RequireAuth`, `AppShell`, React Query (`useQuery`/`useMutation`), Supabase client, UI shadcn, Recharts.

Contexto do projeto (padrões já existentes que vamos seguir)
- Páginas seguem o layout `AppShell title="..."` (ex.: `DashboardHome`, `Produtos`, `Financeiro`).
- Dados são buscados via `useQuery` com funções `fetchX()` e renderização com `Card`/`Table`/`Skeleton`.
- Mutations (edição rápida) seguem `useMutation` + `qc.invalidateQueries(...)` + `toast`.
- Sidebar já é baseada em `items[]` em `src/components/layout/AppSidebar.tsx` e destaca rota ativa via `useLocation`.

Escopo de implementação

1) Nova rota `/relatorios`
Arquivos (novos e existentes)
- Novo: `src/pages/Relatorios.tsx`
- Alterar: `src/App.tsx` (rotas)
- Alterar: `src/components/layout/AppSidebar.tsx` (link na Sidebar)

1.1 Conteúdo da página
UI (estrutura)
- `AppShell title="Relatórios"`
- Cabeçalho da página com título/subtítulo e botão “Exportar”:
  - Botão “Exportar” (MVP): `window.print()` ou `toast("Em breve")` (conforme você preferir; vou usar `window.print()` por ser direto).
- Grid com cards/containers para:
  A) Gráfico de Barras (Recharts): “Vendas por Mês (últimos 6 meses)”
  B) Gráfico de Pizza (Recharts): “Status dos Pedidos de Compra”
  C) Tabela: “Produtos Curva A” (Top 10 por valor total vendido)

1.2 Lógica de dados (Supabase + client-side aggregation)
A) Vendas por mês (últimos 6 meses)
- Buscar `sales` com:
  - `select("total_amount,created_at,status")` (status opcional, mas ajuda)
  - `gte("created_at", startDateISO)` e `lte("created_at", endDateISO)`
- Agregar no frontend em 6 buckets mensais (ex.: “Ago/2025”, “Set/2025”, …):
  - Soma `total_amount` por mês
- Decisão de negócio (assumida no MVP):
  - Considerar apenas status “Faturado” e “Entregue” para refletir venda concluída.
  - Se você quiser incluir “Pedido/Orçamento” também, isso vira um parâmetro simples no filtro; deixarei o filtro claro no código.

B) Status dos pedidos de compra
- Buscar `purchase_orders` com `select("status")`
- Agrupar contagem por status:
  - Foco do card: “Em Cotação” vs “Recebido” (como você pediu)
  - Outros status (ex.: “Aprovado”, “Cancelado”) podem aparecer como “Outros” para não distorcer o gráfico.

C) Produtos Curva A (Top 10 mais vendidos por valor)
- Buscar `sale_items` com:
  - `select("product_id,total,quantity,products(name),sales(status)")` se o relacionamento estiver disponível no PostgREST
  - Caso o join com `sales(status)` não funcione no projeto (depende de FK exposto), fallback robusto:
    1) Buscar vendas concluídas (ids de `sales` com status em “Faturado/Entregue” dentro de um período amplo, ex. últimos 12 meses ou “sem filtro de data” no MVP)
    2) Buscar `sale_items` filtrando por `sale_id in (...)` em lotes (para não estourar tamanho de query)
- Agregar por `product_id`:
  - `valor_total = soma(sale_items.total)`
  - Também podemos exibir `qtd_total = soma(quantity)` opcionalmente (não pedido, mas útil)
- Renderizar tabela com colunas:
  - Produto | Valor Total Vendido (R$) | (Opcional: Quantidade)

Observação importante (limite de 1000 linhas por query)
- Se a base crescer, podemos bater o limite padrão do Supabase (1000). Para o MVP, ok.
- Se você quiser blindar isso já agora, a evolução correta é criar uma view/RPC no banco para agregações. Não entra neste escopo, mas deixo previsto como evolução.

2) Nova rota `/custos` (Precificação e margem)
Arquivos (novos e existentes)
- Novo: `src/pages/Custos.tsx`
- Alterar: `src/App.tsx`
- Alterar: `src/components/layout/AppSidebar.tsx`

2.1 Dados e cálculo
- Buscar `products` filtrando:
  - `type = 'Produto Final'`
  - `status = 'Ativo'` (por padrão; podemos incluir inativos com um toggle depois)
  - Campos necessários: `id,name,price_cost,price_sale,type,status`
- Calcular por produto:
  - `custo_real = price_cost` (no MVP assumimos que já é o custo real)
  - `preco_venda = price_sale`
  - `lucro_unitario = preco_venda - custo_real`
  - `margem% = ((preco_venda - custo_real) / preco_venda) * 100`
- Tratamento de casos:
  - “Sem custo definido” quando `price_cost` é `null` ou `<= 0`
  - Evitar divisão por zero quando `price_sale` é `null` ou `<= 0`:
    - margem fica “—” e entra em “Sem custo/Preço inválido” (vou seguir sua regra principal e classificar como “Sem custo definido” apenas pelo custo; e deixar “Preço inválido” como badge discreto na linha).

2.2 UI da página
Topo: cards de resumo
- “Margem Média da Empresa”
  - média das margens válidas (somente onde preço_venda > 0 e custo definido)
- “Produtos com Prejuízo”
  - count onde `margem < 0`
- “Produtos Sem Custo Definido”
  - count onde `price_cost` <= 0 ou null

Tabela de análise
- Colunas:
  - Produto
  - Custo (R$)
  - Preço Venda (R$)
  - Lucro Unitário (R$)
  - Margem (%)
  - Ação: “Editar Preço”
- Formatação condicional (como solicitado):
  - margem < 0: classes com `text-destructive` (vermelho)
  - margem < 15%: `text-amber-500`/`text-yellow-500` (atenção)
  - margem >= 30%: `text-emerald-500` ou `text-primary` (saudável)
- Também adicionaremos uma badge/label pequena quando “Sem custo definido”.

2.3 Ação rápida: “Editar Preço”
- Implementar um `Dialog` pequeno controlado por estado local:
  - Ao clicar “Editar Preço” na linha:
    - abre modal com inputs numéricos para `price_cost` e `price_sale`
    - botão “Salvar”
- Mutation:
  - `supabase.from("products").update({ price_cost, price_sale }).eq("id", productId)`
  - `onSuccess`: toast “Preço atualizado”, fecha modal, invalida query `["costs-products"]` (ou `["products","costs"]` dependendo do key que definirmos)
- Validações mínimas:
  - impedir valores negativos
  - permitir 0 se você quiser marcar “sem custo”; como você usa “Sem Custo Definido”, manter 0 permitido para sinalização (mas sempre alertar visualmente).

3) Integração na Sidebar
Arquivo: `src/components/layout/AppSidebar.tsx`
- Adicionar 2 itens no array `items`:
  - “Relatórios” -> `/relatorios` com ícone `BarChart3` (ou `BarChart` se disponível; confirmarei no import do lucide já usado no projeto)
  - “Custos/Precificação” -> `/custos` com ícone `Calculator` ou `DollarSign`
- Manter lógica de “active” igual aos demais.

4) Rotas protegidas
Arquivo: `src/App.tsx`
- Adicionar rotas:
  - `/relatorios` -> `<RequireAuth><Relatorios /></RequireAuth>`
  - `/custos` -> `<RequireAuth><Custos /></RequireAuth>`
- Importar as novas páginas.

Estratégia técnica (para manter consistente e estável)
- Reaproveitar utilitários de formatação de moeda (há vários `formatBRL` duplicados; vou manter local por página como já está, para não aumentar escopo com refactor agora).
- Recharts:
  - Usar `ResponsiveContainer` e componentes básicos (BarChart/PieChart) como em `DashboardHome`.
- React Query:
  - Chaves separadas para evitar invalidar listagens grandes sem necessidade:
    - `["reports", "sales-by-month"]`, `["reports", "purchase-status"]`, `["reports", "curve-a"]`
    - `["costs", "products"]`

Checklist de testes (end-to-end)
1) Sidebar:
- Ver “Relatórios” e “Custos/Precificação” com ícones e navegação correta.
2) `/relatorios`:
- Carrega sem erro (mesmo com base vazia)
- Gráficos renderizam com 0 (ou estado “Sem dados”)
- Curva A lista corretamente quando houver vendas
- Botão Exportar chama `window.print()` (abre diálogo de impressão)
3) `/custos`:
- Cards de resumo batem com a tabela
- Linhas com margem negativa ficam vermelhas; <15% amarelas; >=30% verdes
- Editar Preço abre modal, salva, atualiza a tabela imediatamente após sucesso

Arquivos a serem criados/alterados
- Criar:
  - `src/pages/Relatorios.tsx`
  - `src/pages/Custos.tsx`
- Alterar:
  - `src/App.tsx`
  - `src/components/layout/AppSidebar.tsx`

Evoluções recomendadas (fora do escopo, mas já deixo mapeado)
- Criar views/RPC no Postgres para agregações (vendas por mês, curva A) para performance e evitar limite de 1000 linhas.
- Permitir filtros de período em `/relatorios` (últimos 6/12 meses) e filtro de status.
- Em `/custos`, incluir custo “real” por ficha técnica/BOM quando o módulo de produção estiver com consumo de insumos (aí sim custo_real deixa de ser `price_cost` simples).
