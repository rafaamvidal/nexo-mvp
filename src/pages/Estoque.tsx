import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Factory,
  History,
  Pencil,
  Search,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StockQuickAdjust } from "@/components/inventory/StockQuickAdjust";
import { StockEditDialog } from "@/components/inventory/StockEditDialog";
import { ProduceBatchDialog } from "@/components/inventory/ProduceBatchDialog";
import { StockMovementsHistory } from "@/components/inventory/StockMovementsHistory";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatBRL } from "@/lib/masks";
import { resolveProductClassification } from "@/lib/productClassification";

type ProductLite = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  category: string | null;
  price_cost: number | null;
  type?: string | null;
  description?: string | null;
};

async function fetchProductsLite(orgId?: string): Promise<ProductLite[]> {
  let query = supabase
    .from("products")
    .select("id,name,unit,current_stock,min_stock,category,price_cost,type,description")
    .eq("status", "Ativo")
    .order("name", { ascending: true });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Estoque() {
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("ajuste");
  const [q, setQ] = React.useState("");
  const [editProduct, setEditProduct] = React.useState<ProductLite | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", "lite", currentOrg?.id],
    queryFn: () => fetchProductsLite(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => p.name.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term));
  }, [data, q]);

  // Alertas e Sugestões de Reposição (apenas para matérias-primas e insumos com estoque mínimo > 0)
  const criticalItems = React.useMemo(() => {
    const list = data ?? [];
    return list.filter((p) => {
      const resolved = resolveProductClassification({
        type: p.type as any,
        category: p.category,
        description: p.description,
      });
      if (resolved.type === "Produto Final") return false;
      const min = Number(p.min_stock ?? 0);
      if (min <= 0) return false;
      return Number(p.current_stock) <= min;
    });
  }, [data]);

  const ruptureCount = React.useMemo(() => {
    return criticalItems.filter((p) => Number(p.current_stock) <= 0).length;
  }, [criticalItems]);

  const totalReplenishmentCost = React.useMemo(() => {
    return criticalItems.reduce((acc, p) => {
      const needed = Math.max(0, Number(p.min_stock) * 2 - Number(p.current_stock));
      const cost = Number(p.price_cost ?? 0);
      return acc + needed * cost;
    }, 0);
  }, [criticalItems]);

  const lowStockCount = criticalItems.length;

  return (
    <AppShell title="Controle de Estoque">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Estoque & Almoxarifado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste rápido de saldos, sugestão inteligente de reposição e histórico detalhado (Kardex).
            </p>
          </div>
          {activeTab === "ajuste" && (
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar produto/categoria…"
                className="pl-9"
              />
            </div>
          )}
        </div>

        <div className="mt-5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 sm:w-[520px] h-auto p-1 gap-1">
              <TabsTrigger value="ajuste" className="gap-2 text-xs py-2">
                <Boxes className="h-4 w-4" />
                Saldos & Ajustes
              </TabsTrigger>
              <TabsTrigger value="alertas" className="gap-2 text-xs">
                <ShoppingCart className="h-4 w-4" />
                Sugestão de Compra
                {lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                    {lowStockCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="extrato" className="gap-2 text-xs">
                <History className="h-4 w-4" />
                Extrato / Kardex
              </TabsTrigger>
            </TabsList>

            {/* ABA AJUSTE RÁPIDO */}
            <TabsContent value="ajuste" className="mt-5">
              {error && (
                <Card className="glass p-6">
                  <p className="text-sm text-muted-foreground">Erro ao carregar: {(error as any)?.message ?? ""}</p>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}

                {!isLoading && !error && filtered.length === 0 && (
                  <Card className="glass col-span-full p-6 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                  </Card>
                )}

                {!isLoading && !error && filtered.map((p) => {
                  const resolved = resolveProductClassification({
                    type: p.type as any,
                    category: p.category,
                    description: p.description,
                  });
                  const isFinished = resolved.type === "Produto Final";
                  const minVal = Number(p.min_stock ?? 0);
                  const low = !isFinished && minVal > 0 && Number(p.current_stock) < minVal;
                  return (
                    // min-w-0 impede que o nome (nowrap) alargue o card além da tela no mobile
                    <Card key={p.id} className="glass min-w-0 border-border/60 transition-shadow hover:shadow-sm">
                      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
                        <CardTitle className="flex min-w-0 items-center justify-between gap-2 text-base">
                          <span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 sm:h-8 sm:w-8"
                            aria-label="Editar estoque"
                            title="Editar estoque"
                            onClick={() => setEditProduct(p)}
                          >
                            <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </Button>
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={"text-sm font-bold " + (low ? "text-destructive" : "")}>
                            {p.current_stock}
                          </span>
                          <span className="text-xs text-muted-foreground">{p.unit}</span>
                          {low && <Badge variant="destructive">Estoque Baixo</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted-foreground">{p.category ?? "Sem categoria"}</p>
                          {isFinished ? (
                            <p className="mt-1 text-xs text-muted-foreground font-medium">Fabricação própria</p>
                          ) : minVal > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">Mínimo: {p.min_stock}</p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Sem mínimo</p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isFinished && (
                            <ProduceBatchDialog
                              product={{
                                id: p.id,
                                name: p.name,
                                unit: p.unit,
                                current_stock: Number(p.current_stock ?? 0),
                                price_cost: p.price_cost,
                              }}
                              trigger={
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 px-2 font-medium"
                                  title="Apontar Fabricação / Novo Lote"
                                >
                                  <Factory className="h-3.5 w-3.5" />
                                  <span>Produzir</span>
                                </Button>
                              }
                            />
                          )}
                          <StockQuickAdjust productId={p.id} step={1} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ABA SUGESTÃO DE COMPRA / ALERTA DE REPOSIÇÃO */}
            <TabsContent value="alertas" className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="glass border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Itens Abaixo do Mínimo
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Requerem reposição imediata</p>
                  </CardContent>
                </Card>

                <Card className={`glass ${ruptureCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/60"}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Itens Zerados (Ruptura)
                    </CardTitle>
                    <AlertOctagon className={`h-4 w-4 ${ruptureCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${ruptureCount > 0 ? "text-destructive" : "text-foreground"}`}>
                      {ruptureCount}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Paralisação potencial de vendas/produção</p>
                  </CardContent>
                </Card>

                <Card className="glass border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Custo Estimado de Reposição
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBRL(totalReplenishmentCost)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Para atingir margem de segurança</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass border border-border/60">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Tabela de Reposição Sugerida</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Calcula o déficit contra o estoque mínimo e sugere lote ideal de compra (2x estoque mínimo).
                    </p>
                  </div>
                  <Button
                    variant="hero"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/compras")}
                  >
                    Novo Pedido de Compra
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {criticalItems.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm font-medium text-emerald-600">
                        Nenhum item em estado crítico! Todos os produtos estão acima do estoque mínimo.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          ↔️ Arraste para o lado para ver sugestões e custos
                        </span>
                        <span className="font-semibold">{criticalItems.length} itens</span>
                      </div>
                      <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[780px] w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-center">Estoque Atual</TableHead>
                            <TableHead className="text-center">Estoque Mínimo</TableHead>
                            <TableHead className="text-center">Déficit</TableHead>
                            <TableHead className="text-center">Sugestão de Compra</TableHead>
                            <TableHead className="text-right">Custo Estimado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {criticalItems.map((p) => {
                            const current = Number(p.current_stock);
                            const min = Number(p.min_stock);
                            const deficit = Math.max(0, min - current);
                            const suggested = Math.max(0, min * 2 - current);
                            const estCost = suggested * Number(p.price_cost ?? 0);

                            return (
                              <TableRow key={p.id}>
                                <TableCell className="font-semibold">
                                  {p.name}
                                  {current <= 0 && (
                                    <Badge variant="destructive" className="ml-2 text-[10px]">
                                      Zerado
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {p.category ?? "-"}
                                </TableCell>
                                <TableCell className="text-center font-bold text-destructive">
                                  {current} {p.unit}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                  {min} {p.unit}
                                </TableCell>
                                <TableCell className="text-center font-medium text-amber-600">
                                  +{deficit} {p.unit}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="border-primary/40 text-primary font-bold">
                                    {suggested} {p.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatBRL(estCost)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditProduct(p)}
                                      title="Ajustar saldo manualmente"
                                    >
                                      Ajustar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => navigate("/compras")}
                                      title="Comprar com fornecedor"
                                    >
                                      Comprar
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA HISTÓRICO DE MOVIMENTAÇÕES */}
            <TabsContent value="extrato" className="mt-5">
              <StockMovementsHistory />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {editProduct && (
        <StockEditDialog
          open={!!editProduct}
          onOpenChange={(v) => { if (!v) setEditProduct(null); }}
          product={editProduct}
        />
      )}
    </AppShell>
  );
}
