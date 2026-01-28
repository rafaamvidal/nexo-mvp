import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Package, Trash2, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow, ProductType } from "@/types/inventory";
import { ProductFormSheet, type EditableProduct } from "@/components/inventory/ProductFormSheet";
import { StockQuickAdjust } from "@/components/inventory/StockQuickAdjust";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type Filter = "Todos" | ProductType;

type Product = ProductRow & {
  category: string | null;
  price_cost: number | null;
  price_sale: number | null;
  status: string | null;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,type,category,current_stock,min_stock,unit,price_cost,price_sale,created_at,status")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

function FilterChips({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const items: Filter[] = ["Todos", "Matéria-Prima", "Produto Final"];
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

export default function Produtos() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>("Todos");
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const products = React.useMemo(() => {
    if (!data) return [];
    if (filter === "Todos") return data;
    return data.filter((p) => p.type === filter);
  }, [data, filter]);

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
      price_cost: p.price_cost,
      price_sale: p.price_sale,
    };
  }, []);

  const getTypeBadge = React.useCallback((type: ProductType) => {
    if (type === "Matéria-Prima") return <Badge variant="secondary">Matéria-prima</Badge>;
    return <Badge>Produto final</Badge>;
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto excluído");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
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
              <p className="mt-1 text-xs text-muted-foreground">Produtos no catálogo</p>
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
                        <TableCell className={"text-right font-bold " + (low ? "text-destructive" : "")}>
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm" aria-label="Excluir">
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
                                    onClick={() => deleteMutation.mutate(p.id)}
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
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
