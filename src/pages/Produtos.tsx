import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChefHat, Package, Pencil, RefreshCw, Search, Trash2, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow, ProductType } from "@/types/inventory";
import { resolveProductClassification } from "@/lib/productClassification";
import { ProductFormSheet, type EditableProduct } from "@/components/inventory/ProductFormSheet";
import { PriceHistoryDialog } from "@/components/inventory/PriceHistoryDialog";
import { BomManagerDialog } from "@/components/production/BomManagerDialog";
import { SpreadsheetDataImporter } from "@/components/organization/SpreadsheetDataImporter";
import { StockQuickAdjust } from "@/components/inventory/StockQuickAdjust";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { isForeignKeyViolation, toastProductDeleteBlocked } from "@/lib/supabaseErrors";
import { parsePackageMetadata, formatPackageSummary } from "@/lib/packageConversion";

type Filter = "Todos" | ProductType;

type Product = ProductRow & {
  category: string | null;
  description: string | null;
  price_cost: number | null;
  price_sale: number | null;
  status: string | null;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

import { useOrganization } from "@/contexts/OrganizationContext";

async function fetchProducts(orgId?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("id,name,type,category,description,current_stock,min_stock,unit,price_cost,price_sale,created_at,status")
    .order("name", { ascending: true });

  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

function FilterChips({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const items: Filter[] = [
    "Todos",
    "Produto Final",
    "Matéria-Prima",
    "Embalagem",
    "Rótulo / Etiqueta",
    "Insumo de Produção",
    "Utensílio / Ferramenta",
    "Limpeza e Higiene",
    "Material de Apoio",
    "Outro",
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const active = it === value;
        return (
          <Button
            key={it}
            type="button"
            variant={active ? "soft" : "outline"}
            size="sm"
            onClick={() => onChange(it)}
            className="rounded-full text-xs h-7 px-3"
          >
            {it}
          </Button>
        );
      })}
    </div>
  );
}

export default function Produtos() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const [filter, setFilter] = React.useState<Filter>("Todos");
  const [q, setQ] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [inactivateTarget, setInactivateTarget] = React.useState<{ id: string; name: string } | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", currentOrg?.id],
    queryFn: () => fetchProducts(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const resolvedProducts = React.useMemo(() => {
    return (data ?? []).map((p) => {
      const resolved = resolveProductClassification(p);
      return {
        ...p,
        type: resolved.type,
        category: resolved.category,
      };
    });
  }, [data]);

  const activeProducts = React.useMemo(() => {
    return resolvedProducts.filter((p) => (p.status ?? "Ativo") !== "Inativo");
  }, [resolvedProducts]);

  const products = React.useMemo(() => {
    const list = showInactive ? resolvedProducts : activeProducts;
    const term = q.trim().toLowerCase();
    const byType = filter === "Todos" ? list : list.filter((p) => p.type === filter);
    if (!term) return byType;
    return byType.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.category ?? "").toLowerCase().includes(term) ||
        p.type.toLowerCase().includes(term)
    );
  }, [activeProducts, resolvedProducts, filter, q, showInactive]);

  const lowStockCount = React.useMemo(
    () => activeProducts.filter((p) => Number(p.current_stock) < Number(p.min_stock)).length,
    [activeProducts],
  );

  const totalStockValue = React.useMemo(() => {
    return activeProducts.reduce((acc, p) => {
      const qty = Number(p.current_stock ?? 0);
      const cost = Number(p.price_cost ?? 0);
      return acc + qty * cost;
    }, 0);
  }, [activeProducts]);

  const mappedEditable = React.useCallback((p: Product): EditableProduct => {
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      unit: p.unit,
      current_stock: Number(p.current_stock ?? 0),
      min_stock: Number(p.min_stock ?? 0),
      category: p.category,
      description: p.description,
      price_cost: p.price_cost,
      price_sale: p.price_sale,
    };
  }, []);

  const getTypeBadge = React.useCallback((type: ProductType | string) => {
    switch (type) {
      case "Produto Final":
        return <Badge className="bg-primary/90 text-primary-foreground">Produto Final</Badge>;
      case "Matéria-Prima":
        return <Badge variant="secondary">Matéria-Prima</Badge>;
      case "Embalagem":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">Embalagem</Badge>;
      case "Rótulo / Etiqueta":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">Rótulo / Etiqueta</Badge>;
      case "Insumo de Produção":
        return <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">Insumo Produtivo</Badge>;
      case "Utensílio / Ferramenta":
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30">Utensílio</Badge>;
      case "Limpeza e Higiene":
        return <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30">Limpeza / Higiene</Badge>;
      case "Material de Apoio":
        return <Badge variant="outline">Material de Apoio</Badge>;
      default:
        return <Badge variant="outline">{type || "Outro"}</Badge>;
    }
  }, []);

  const inactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ status: "Inativo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto inativado");
      setInactivateTarget(null);
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao inativar");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ status: "Ativo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto reativado");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao reativar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto excluído");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) {
        toastProductDeleteBlocked();
        // se houver histórico de estoque, a alternativa correta é inativar
        return;
      }
      toast.error(e?.message ?? "Erro ao excluir");
    },
  });

  return (
    <AppShell title="Cadastro / Gerenciamento">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Produtos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lowStockCount > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {lowStockCount} item(ns) abaixo do mínimo
                </span>
              ) : (
                "Tudo certo — nenhum item abaixo do mínimo"
              )}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto/categoria…" className="pl-9" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2 md:w-[360px]">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">Mostrar inativos</p>
                <p className="mt-1 text-xs text-muted-foreground">Exibe produtos com status Inativo</p>
              </div>
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label="Mostrar inativos" />
            </div>
            <FilterChips value={filter} onChange={setFilter} />
            <div className="flex flex-wrap items-center gap-2">
              <SpreadsheetDataImporter />
              <BomManagerDialog />
              <ProductFormSheet />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Valor total em estoque</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{formatBRL(totalStockValue)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Soma de custo × estoque atual (apenas ativos)</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Itens com estoque baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{lowStockCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Abaixo do estoque mínimo (apenas ativos)</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Itens cadastrados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{activeProducts.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">Produtos ativos no catálogo</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5">
          {isLoading && (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <Card className="glass p-6">
              <p className="text-sm text-muted-foreground">Erro ao carregar produtos: {(error as any)?.message ?? ""}</p>
            </Card>
          )}

          {!isLoading && !error && products.length === 0 && (
            <Card className="glass p-8 text-center">
              <p className="text-base font-semibold">Nenhum produto ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro produto para começar.</p>
              <div className="mt-4 flex justify-center">
                <ProductFormSheet />
              </div>
            </Card>
          )}

          {!isLoading && !error && products.length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <Table containerClassName="max-h-[460px] md:max-h-[500px] lg:max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur shadow-sm [&_th]:bg-card/95 [&_th]:backdrop-blur">
                  <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Estoque atual</TableHead>
                      <TableHead className="text-right">Custo unitário</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => {
                      const low = Number(p.current_stock) < Number(p.min_stock);
                      const inactive = (p.status ?? "Ativo") === "Inativo";
                      const pkg = parsePackageMetadata(p.description);
                      return (
                        <TableRow key={p.id} className="odd:bg-muted/20">
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{p.name}</span>
                              {low && <Badge variant="destructive">Baixo</Badge>}
                              {showInactive && inactive && <Badge variant="outline">Inativo</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                          <TableCell>{getTypeBadge(p.type)}</TableCell>
                          <TableCell className={"text-right font-bold " + (low ? "text-destructive" : "")}>
                            <div>
                              {p.current_stock}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">{p.unit}</span>
                            </div>
                            {Number(p.current_stock) > 0 && Number(p.price_cost ?? 0) > 0 && (
                              <span className="text-[11px] font-normal text-muted-foreground block">
                                Total: {formatBRL(Number(p.current_stock) * Number(p.price_cost))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">
                              {formatBRL(Number(p.price_cost ?? 0))}
                              <span className="text-xs font-normal text-muted-foreground">/{p.unit}</span>
                            </div>
                            {pkg && (
                              <span
                                className="text-[11px] text-muted-foreground block truncate max-w-[140px] ml-auto"
                                title={formatPackageSummary(pkg, p.unit)}
                              >
                                {pkg.packageName} {pkg.packageSize}{p.unit}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatBRL(Number(p.price_sale ?? 0))}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              {p.type === "Produto Final" && (
                                <BomManagerDialog
                                  defaultProductId={p.id}
                                  trigger={
                                    <Button type="button" variant="outline" size="icon" title="Ficha Técnica / Receita">
                                      <ChefHat className="h-4 w-4 text-primary" />
                                    </Button>
                                  }
                                />
                              )}
                              <ProductFormSheet
                                product={mappedEditable(p)}
                                trigger={
                                  <Button type="button" variant="outline" size="icon" aria-label="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <PriceHistoryDialog
                                productId={p.id}
                                productName={p.name}
                                productUnit={p.unit}
                                productType={p.type}
                                currentCost={p.price_cost}
                                trigger={
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="Histórico de Preços e Sazonalidade"
                                    className="hover:text-emerald-600 hover:border-emerald-500/40"
                                  >
                                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  </Button>
                                }
                              />
                              {showInactive && inactive && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  aria-label="Reativar"
                                  onClick={() => reactivateMutation.mutate(p.id)}
                                  disabled={reactivateMutation.isPending}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" aria-label="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O produto será removido do cadastro.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        deleteMutation.mutate(p.id, {
                                          onError: (e: any) => {
                                            if (isForeignKeyViolation(e)) {
                                              setInactivateTarget({ id: p.id, name: p.name });
                                              return;
                                            }
                                          },
                                        });
                                      }}
                                      disabled={deleteMutation.isPending}
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <StockQuickAdjust productId={p.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
                  <span>
                    Mostrando <strong className="text-foreground">{products.length}</strong> de{" "}
                    <strong className="text-foreground">{showInactive ? resolvedProducts.length : activeProducts.length}</strong> produtos
                  </span>
                  {products.length > 5 && (
                    <span className="text-[11px] text-muted-foreground">
                      Role a tabela para ver mais produtos ↓
                    </span>
                  )}
                </div>
              </Card>
            )}
        </div>

        {/* Dialog controlado para oferecer Inativar quando delete for bloqueado por movimentações */}
        <AlertDialog open={!!inactivateTarget} onOpenChange={(open) => (!open ? setInactivateTarget(null) : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Não é possível excluir</AlertDialogTitle>
              <AlertDialogDescription>
                O produto <span className="font-semibold">{inactivateTarget?.name}</span> possui histórico de movimentações de estoque.
                Para manter a rastreabilidade, você pode inativá-lo (ele será ocultado da lista por padrão).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => inactivateTarget && inactivateMutation.mutate(inactivateTarget.id)}
                disabled={inactivateMutation.isPending}
              >
                Inativar produto
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AppShell>
  );
}
