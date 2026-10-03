import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Download, Printer } from "lucide-react";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonthLabel(d: Date) {
  // Ex.: "jan/26"
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d).toLowerCase();
}

type SalesMonthPoint = { month: string; total: number };

async function fetchSalesByMonthLast6(): Promise<SalesMonthPoint[]> {
  const now = new Date();
  const start = startOfMonth(addMonths(now, -5)).toISOString();
  const end = endOfMonth(now).toISOString();

  const { data, error } = await supabase
    .from("sales")
    .select("total_amount,created_at,status")
    .gte("created_at", start)
    .lte("created_at", end);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ total_amount: number | null; created_at: string; status: string | null }>;
  const allowed = new Set(["faturado", "entregue"]);

  const buckets = Array.from({ length: 6 }).map((_, idx) => {
    const date = startOfMonth(addMonths(now, idx - 5));
    return { key: date.toISOString().slice(0, 7), label: formatMonthLabel(date), total: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b] as const));

  for (const r of rows) {
    const s = (r.status ?? "").toLowerCase();
    if (s && !allowed.has(s)) continue;
    const key = new Date(r.created_at).toISOString().slice(0, 7);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.total += Number(r.total_amount ?? 0);
  }

  return buckets.map((b) => ({ month: b.label, total: b.total }));
}

type PurchaseStatusSlice = { name: string; value: number };

async function fetchPurchaseStatus(): Promise<PurchaseStatusSlice[]> {
  const { data, error } = await supabase.from("purchase_orders").select("status");
  if (error) throw error;

  const rows = (data ?? []) as Array<{ status: string | null }>;
  let cotacao = 0;
  let recebido = 0;
  let outros = 0;
  for (const r of rows) {
    const s = (r.status ?? "").toLowerCase();
    if (s === "em cotação") cotacao += 1;
    else if (s === "recebido") recebido += 1;
    else outros += 1;
  }

  const out: PurchaseStatusSlice[] = [
    { name: "Em Cotação", value: cotacao },
    { name: "Recebido", value: recebido },
  ];
  if (outros > 0) out.push({ name: "Outros", value: outros });
  return out;
}

type CurveAItem = { product_id: string; product_name: string; total_value: number };

async function fetchCurveA(): Promise<CurveAItem[]> {
  const { data, error } = await supabase
    .from("sale_items")
    // tentamos enriquecer com nomes e status; se o PostgREST não retornar, seguimos com o que vier.
    .select("product_id,total,quantity,products(name),sales(status)")
    .limit(1000);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const allowed = new Set(["faturado", "entregue"]);

  const agg = new Map<string, { id: string; name: string; total: number }>();
  for (const r of rows) {
    const saleStatus = (r.sales?.status ?? "").toLowerCase();
    // Se o status vier, filtramos; se não vier, mantemos (MVP)
    if (saleStatus && !allowed.has(saleStatus)) continue;

    const id = String(r.product_id);
    const name = String(r.products?.name ?? "—");
    const total = Number(r.total ?? 0);
    const cur = agg.get(id) ?? { id, name, total: 0 };
    cur.total += total;
    if (cur.name === "—" && name !== "—") cur.name = name;
    agg.set(id, cur);
  }

  return Array.from(agg.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((x) => ({ product_id: x.id, product_name: x.name, total_value: x.total }));
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--primary-glow))", "hsl(var(--muted-foreground))"];

export default function Relatorios() {
  const salesQ = useQuery({ queryKey: ["reports", "sales-by-month"], queryFn: fetchSalesByMonthLast6 });
  const poQ = useQuery({ queryKey: ["reports", "purchase-status"], queryFn: fetchPurchaseStatus });
  const curveQ = useQuery({ queryKey: ["reports", "curve-a"], queryFn: fetchCurveA });

  const hasAnyError = salesQ.error || poQ.error || curveQ.error;

  return (
    <AppShell title="Relatórios">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-extrabold">Visão Analítica</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tendências e indicadores consolidados (últimos 6 meses).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const curveData = curveQ.data ?? [];
                exportToCsv({
                  filename: `relatorio_curva_abc_${new Date().toISOString().slice(0, 10)}`,
                  headers: ["Posição", "Produto", "Valor Total Vendido (R$)"],
                  rows: curveData.map((x, idx) => [idx + 1, x.product_name, x.total_value]),
                });
                toast.success("Relatório Curva ABC exportado em CSV!");
              }}
              disabled={!curveQ.data || curveQ.data.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="hero"
              onClick={() => {
                window.print();
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Relatório
            </Button>
          </div>
        </header>

        {hasAnyError && (
          <Card className="glass mt-5 p-6">
            <p className="text-sm text-muted-foreground">
              Erro ao carregar relatórios: {String((salesQ.error as any)?.message ?? (poQ.error as any)?.message ?? (curveQ.error as any)?.message ?? "")}
            </p>
          </Card>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          <Card className="glass border-border/60 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Vendas por Mês</CardTitle>
              <p className="text-xs text-muted-foreground">Somente vendas com status Faturado/Entregue.</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {salesQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesQ.data ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(v) => formatBRL(Number(v))} />
                    <RechartsTooltip formatter={(v) => formatBRL(Number(v))} />
                    <Bar dataKey="total" name="Vendas" fill="hsl(var(--primary))" radius={[10, 10, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Status dos Pedidos de Compra</CardTitle>
              <p className="text-xs text-muted-foreground">Em Cotação × Recebido.</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {poQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip />
                    <Pie dataKey="value" nameKey="name" data={poQ.data ?? []} innerRadius={70} outerRadius={105}>
                      {(poQ.data ?? []).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-5">
          <Card className="glass border-border/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Produtos Curva A</CardTitle>
              <p className="text-xs text-muted-foreground">Top 10 por valor total vendido.</p>
            </CardHeader>
            <CardContent>
              {curveQ.isLoading ? (
                <div className="grid gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (curveQ.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Sem dados suficientes para calcular Curva A ainda.
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Valor Total (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(curveQ.data ?? []).map((it, idx) => (
                      <TableRow key={it.product_id} className="odd:bg-muted/20">
                        <TableCell className="w-10 text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{it.product_name}</TableCell>
                        <TableCell className="text-right font-bold">{formatBRL(it.total_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
