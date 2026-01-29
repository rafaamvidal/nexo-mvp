import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { StockQuickAdjust } from "@/components/inventory/StockQuickAdjust";
import { Badge } from "@/components/ui/badge";

type ProductLite = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  category: string | null;
};

async function fetchProductsLite(): Promise<ProductLite[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,unit,current_stock,min_stock,category")
    .eq("status", "Ativo")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Estoque() {
  const [q, setQ] = React.useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["products", "lite"], queryFn: fetchProductsLite });

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => p.name.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term));
  }, [data, q]);

  return (
    <AppShell title="Movimentação Rápida">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Estoque</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste rápido com botões grandes (+/−) por produto.</p>
          </div>
          <div className="relative w-full md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto/categoria…" className="pl-9" />
          </div>
        </div>

        {error && (
          <Card className="glass mt-5 p-6">
            <p className="text-sm text-muted-foreground">Erro ao carregar: {(error as any)?.message ?? ""}</p>
          </Card>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}

          {!isLoading && !error && filtered.map((p) => {
            const low = Number(p.current_stock) < Number(p.min_stock);
            return (
              <Card key={p.id} className="glass border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="truncate">{p.name}</span>
                    <Boxes className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={"text-sm font-bold " + (low ? "text-destructive" : "")}>{p.current_stock}</span>
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                    {low && <Badge variant="destructive">Baixo</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.category ?? "Sem categoria"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Mínimo: {p.min_stock}</p>
                  </div>
                  <div className="shrink-0">
                    <StockQuickAdjust productId={p.id} step={1} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
