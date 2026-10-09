import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useOrganization } from "@/contexts/OrganizationContext";

type ProductCostRow = {
  id: string;
  name: string;
  price_cost: number | null;
  price_sale: number | null;
  status: string | null;
  type: string;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseBRNumber(input: string) {
  const normalized = input.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

async function fetchFinishedProducts(orgId?: string): Promise<ProductCostRow[]> {
  let query = supabase
    .from("products")
    .select("id,name,price_cost,price_sale,status,type")
    .eq("type", "Produto Final")
    .eq("status", "Ativo")
    .order("name", { ascending: true });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

function computeMarginPercent(priceSale: number, cost: number) {
  if (!Number.isFinite(priceSale) || priceSale <= 0) return null;
  if (!Number.isFinite(cost)) return null;
  return ((priceSale - cost) / priceSale) * 100;
}

function marginClass(margin: number | null, hasCost: boolean) {
  if (!hasCost) return "text-muted-foreground";
  if (margin === null) return "text-muted-foreground";
  if (margin < 0) return "text-destructive";
  if (margin < 15) return "text-warning";
  if (margin >= 30) return "text-success";
  return "";
}

export default function Custos() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["costs", "products", currentOrg?.id],
    queryFn: () => fetchFinishedProducts(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const rows = React.useMemo(() => {
    return (data ?? []).map((p) => {
      const cost = Number(p.price_cost ?? 0);
      const sale = Number(p.price_sale ?? 0);
      const hasCost = p.price_cost !== null && Number(p.price_cost) > 0;
      const profit = sale - cost;
      const margin = hasCost ? computeMarginPercent(sale, cost) : null;
      return { ...p, cost, sale, profit, margin, hasCost };
    });
  }, [data]);

  const summary = React.useMemo(() => {
    const validMargins = rows.filter((r) => r.hasCost && (r.margin ?? null) !== null && r.sale > 0).map((r) => r.margin as number);
    const avg = validMargins.length ? validMargins.reduce((a, b) => a + b, 0) / validMargins.length : 0;
    const loss = rows.filter((r) => r.hasCost && (r.margin ?? 0) < 0).length;
    const noCost = rows.filter((r) => !r.hasCost).length;
    return { avg, loss, noCost };
  }, [rows]);

  const [editing, setEditing] = React.useState<{ id: string; name: string; price_cost: number | null; price_sale: number | null } | null>(null);
  const [costInput, setCostInput] = React.useState<string>("");
  const [saleInput, setSaleInput] = React.useState<string>("");

  React.useEffect(() => {
    if (!editing) return;
    setCostInput(String(editing.price_cost ?? 0));
    setSaleInput(String(editing.price_sale ?? 0));
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string; price_cost: number; price_sale: number }) => {
      if (payload.price_cost < 0 || payload.price_sale < 0) throw new Error("Valores não podem ser negativos");
      const { error } = await supabase
        .from("products")
        .update({ price_cost: payload.price_cost, price_sale: payload.price_sale } as any)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Preço atualizado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["costs", "products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar preço"),
  });

  return (
    <AppShell title="Custos / Precificação">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-extrabold">Precificação e Margem</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entenda se você está lucrando em cada produto final.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="h-4 w-4" />
            Baseado em price_cost e price_sale
          </div>
        </header>

        {error && (
          <Card className="glass mt-5 p-6">
            <p className="text-sm text-muted-foreground">Erro ao carregar custos: {(error as any)?.message ?? ""}</p>
          </Card>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Margem Média da Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-extrabold">{summary.avg.toFixed(1)}%</div>}
              <p className="mt-1 text-xs text-muted-foreground">Somente produtos com custo definido e preço válido.</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Produtos com Prejuízo</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-extrabold text-destructive">{summary.loss}</div>}
              <p className="mt-1 text-xs text-muted-foreground">Margem &lt; 0</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Produtos Sem Custo Definido</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-extrabold">{summary.noCost}</div>}
              <p className="mt-1 text-xs text-muted-foreground">price_cost nulo ou ≤ 0</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5">
          <Card className="glass border-border/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Tabela de Análise</CardTitle>
              <p className="text-xs text-muted-foreground">Ajuste rapidamente custo e preço para melhorar margens.</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
                  Nenhum “Produto Final” ativo encontrado.
                </div>
              ) : (
                <>
                  <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground -mx-6 -mt-2 mb-2">
                    <span className="flex items-center gap-1 font-medium">
                      ↔️ Arraste para o lado para ver margens e ações
                    </span>
                    <span className="font-semibold">{rows.length} produtos</span>
                  </div>
                  <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[680px] w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Custo (R$)</TableHead>
                      <TableHead className="text-right">Preço Venda (R$)</TableHead>
                      <TableHead className="text-right">Lucro Unitário (R$)</TableHead>
                      <TableHead className="text-right">Margem (%)</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const marginText = r.margin === null ? "—" : `${r.margin.toFixed(1)}%`;
                      return (
                        <TableRow key={r.id} className="odd:bg-muted/20">
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{r.name}</span>
                              {!r.hasCost && <Badge variant="outline">Sem custo</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatBRL(r.cost)}</TableCell>
                          <TableCell className="text-right">{formatBRL(r.sale)}</TableCell>
                          <TableCell className={"text-right font-bold " + (r.hasCost && r.profit < 0 ? "text-destructive" : "")}>{formatBRL(r.profit)}</TableCell>
                          <TableCell className={"text-right font-bold " + marginClass(r.margin, r.hasCost)}>{marginText}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing({ id: r.id, name: r.name, price_cost: r.price_cost, price_sale: r.price_sale })}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar Preço
                            </Button>
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
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => (!o ? setEditing(null) : null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-md sm:p-6">
            <DialogHeader>
              <DialogTitle className="truncate pr-6 text-left leading-snug">Editar custo e preço</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <p className="text-sm font-semibold">{editing?.name ?? ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">Atualiza price_cost e price_sale no cadastro do produto.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cost">Custo (R$)</Label>
                <Input id="cost" value={costInput} onChange={(e) => setCostInput(e.target.value)} inputMode="decimal" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale">Preço de Venda (R$)</Label>
                <Input id="sale" value={saleInput} onChange={(e) => setSaleInput(e.target.value)} inputMode="decimal" />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!editing) return;
                    const nextCost = parseBRNumber(costInput);
                    const nextSale = parseBRNumber(saleInput);
                    if (!Number.isFinite(nextCost) || !Number.isFinite(nextSale)) {
                      toast.error("Informe valores válidos");
                      return;
                    }
                    saveMutation.mutate({ id: editing.id, price_cost: nextCost, price_sale: nextSale });
                  }}
                  disabled={saveMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </AppShell>
  );
}
