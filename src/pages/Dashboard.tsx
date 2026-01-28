import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow, ProductType } from "@/types/inventory";
import { MovementDialog } from "@/components/inventory/MovementDialog";
import { ProductFormSheet } from "@/components/inventory/ProductFormSheet";

type Filter = "Todos" | ProductType;

async function fetchProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,type,current_stock,min_stock,unit,created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductRow[];
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

export default function Dashboard() {
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

  return (
    <AppShell title="Dashboard de Estoque">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-balance text-2xl font-extrabold">Produtos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lowStockCount > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-primary" />
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

        <div className="mt-5">
          {isLoading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const low = Number(p.current_stock) < Number(p.min_stock);
                return (
                  <Card key={p.id} className="glass rounded-xl border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-bold">{p.name}</h3>
                          {low && (
                            <Badge className="bg-primary-soft text-foreground">Baixo</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.type} • Unidade: {p.unit}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        Min {p.min_stock}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Estoque</p>
                        <p className="text-2xl font-extrabold">{p.current_stock}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <MovementDialog
                          product={p}
                          movementType="Saída"
                          trigger={
                            <Button variant="glass" size="icon" aria-label="Registrar saída">
                              <Minus />
                            </Button>
                          }
                        />
                        <MovementDialog
                          product={p}
                          movementType="Entrada"
                          trigger={
                            <Button variant="hero" size="icon" aria-label="Registrar entrada">
                              <Plus />
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
