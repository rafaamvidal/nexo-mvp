import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow, ProductType } from "@/types/inventory";
import { resolveProductClassification } from "@/lib/productClassification";
import { ProductFormSheet, type EditableProduct } from "@/components/inventory/ProductFormSheet";
import { StockQuickAdjust } from "@/components/inventory/StockQuickAdjust";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Filter = "Todos" | ProductType;

type Product = ProductRow & {
  category: string | null;
  description: string | null;
  price_cost: number | null;
  price_sale: number | null;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,type,category,description,current_stock,min_stock,unit,price_cost,price_sale,created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
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
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it === value;
        return (
          <Button
            key={it}
            type="button"
            variant={active ? "soft" : "outline"}
            size="sm"
            onClick={() => onChange(it)}
            className="rounded-full"
          >
            {it}
          </Button>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [filter, setFilter] = React.useState<Filter>("Todos");
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const resolvedData = React.useMemo(() => {
    return (data ?? []).map((p) => {
      const resolved = resolveProductClassification(p);
      return {
        ...p,
        type: resolved.type,
        category: resolved.category,
      };
    });
  }, [data]);

  const products = React.useMemo(() => {
    if (!resolvedData) return [];
    if (filter === "Todos") return resolvedData;
    return resolvedData.filter((p) => p.type === filter);
  }, [resolvedData, filter]);

  const lowStockCount = React.useMemo(
    () => (data ?? []).filter((p) => Number(p.current_stock) < Number(p.min_stock)).length,
    [data],
  );

  const totalStockValue = React.useMemo(() => {
    return (data ?? []).reduce((acc, p) => {
      const qty = Number(p.current_stock ?? 0);
      const cost = Number(p.price_cost ?? 0);
      return acc + qty * cost;
    }, 0);
  }, [data]);

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

  return (
    <AppShell title="Produtos & Estoque">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-balance text-2xl font-extrabold">Produtos</h2>
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

          <div className="flex flex-col gap-3 md:items-end">
            <FilterChips value={filter} onChange={setFilter} />
            <ProductFormSheet />
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
              <p className="mt-1 text-xs text-muted-foreground">Soma de custo × estoque atual</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Itens com estoque baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{lowStockCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Abaixo do estoque mínimo</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Itens cadastrados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{(data ?? []).length}</div>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const low = Number(p.current_stock) < Number(p.min_stock);
                    return (
                      <TableRow key={p.id} className="odd:bg-muted/20">
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{p.name}</span>
                            {low && <Badge variant="destructive">Baixo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                        <TableCell>{getTypeBadge(p.type)}</TableCell>
                        <TableCell className={"text-right font-bold " + (low ? "text-destructive" : "")}
                        >
                          {p.current_stock}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{p.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(Number(p.price_cost ?? 0))}</TableCell>
                        <TableCell className="text-right">{formatBRL(Number(p.price_sale ?? 0))}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <ProductFormSheet
                              product={mappedEditable(p)}
                              trigger={
                                <Button type="button" variant="outline" size="sm">
                                  Editar
                                </Button>
                              }
                            />
                            <StockQuickAdjust productId={p.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
