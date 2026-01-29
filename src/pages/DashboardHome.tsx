import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfDay, startOfMonth, subDays } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Package, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type DashboardData = {
  activeProducts: number;
  manufacturingInProgress: number;
  salesThisMonth: number;
  monthlyProfit: number;
  topProductsRevenue: { name: string; value: number }[];
  salesEvolution30d: { date: string; value: number }[];
  receitas: number;
  despesas: number;
  saldo: number;
};

type SaleItemJoinRow = {
  total: number | null;
  products?: { name: string | null } | null;
  sales?: { created_at: string | null } | null;
};

function isWithinRange(iso: string | null | undefined, startIso: string, endIso: string) {
  if (!iso) return false;
  return iso >= startIso && iso <= endIso;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const start = startOfMonth(new Date()).toISOString();
  const end = endOfMonth(new Date()).toISOString();
  const start30 = startOfDay(subDays(new Date(), 29)).toISOString();

  const [productsRes, moRes, salesRes, finRes, saleItemsRes, sales30Res] = await Promise.all([
    supabase.from("products").select("id,status,category", { count: "exact" }),
    supabase.from("manufacturing_orders").select("id,status", { count: "exact" }),
    supabase.from("sales").select("total_amount,created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("financial_records").select("amount,type,due_date").gte("due_date", start.slice(0, 10)).lte("due_date", end.slice(0, 10)),
    supabase.from("sale_items").select("total, products(name), sales(created_at)"),
    supabase.from("sales").select("total_amount,created_at").gte("created_at", start30).lte("created_at", new Date().toISOString()),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (moRes.error) throw moRes.error;
  if (salesRes.error) throw salesRes.error;
  if (finRes.error) throw finRes.error;
  if (saleItemsRes.error) throw saleItemsRes.error;
  if (sales30Res.error) throw sales30Res.error;

  const products = (productsRes.data ?? []) as Array<{ id: string; status: string | null; category: string | null }>;
  const activeProducts = products.filter((p) => (p.status ?? "").toLowerCase() === "ativo").length;

  const mos = (moRes.data ?? []) as Array<{ id: string; status: string | null }>;
  const manufacturingInProgress = mos.filter((m) => (m.status ?? "").toLowerCase() === "em produção").length;

  const salesThisMonth = (salesRes.data ?? []).reduce((acc, s: any) => acc + Number(s.total_amount ?? 0), 0);

  const fin = (finRes.data ?? []) as Array<{ amount: number; type: string; due_date: string }>;
  const receitas = fin.filter((r) => (r.type ?? "").toLowerCase() === "receber").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const despesas = fin.filter((r) => (r.type ?? "").toLowerCase() === "pagar").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const saldo = receitas - despesas;

  const monthlyProfit = saldo;

  const saleItems = (saleItemsRes.data ?? []) as unknown as SaleItemJoinRow[];
  const revenueMap = new Map<string, number>();
  for (const it of saleItems) {
    const createdAt = it.sales?.created_at ?? null;
    if (!isWithinRange(createdAt, start, end)) continue;

    const name = (it.products?.name ?? "Produto").trim() || "Produto";
    revenueMap.set(name, (revenueMap.get(name) ?? 0) + Number(it.total ?? 0));
  }
  const topProductsRevenue = Array.from(revenueMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reverse();

  const dailyTotals = new Map<string, number>();
  for (const s of sales30Res.data ?? []) {
    const iso = (s as any).created_at as string | null;
    const amount = Number((s as any).total_amount ?? 0);
    if (!iso) continue;
    const day = format(new Date(iso), "yyyy-MM-dd");
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + amount);
  }

  const days: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }
  let running = 0;
  const salesEvolution30d = days.map((d) => {
    running += dailyTotals.get(d) ?? 0;
    return { date: d, value: running };
  });

  return {
    activeProducts,
    manufacturingInProgress,
    salesThisMonth,
    monthlyProfit,
    topProductsRevenue,
    salesEvolution30d,
    receitas,
    despesas,
    saldo,
  };
}

export default function DashboardHome() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardData });

  return (
    <AppShell title="Dashboard">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-extrabold">Visão Geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">Indicadores e visão rápida do mês atual.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Dados em tempo real (Supabase)
          </div>
        </header>

        {error && (
          <Card className="glass mt-5 p-6">
            <p className="text-sm text-muted-foreground">Erro ao carregar dashboard: {(error as any)?.message ?? ""}</p>
          </Card>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Card className="glass border-border/60 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Produtos Ativos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-extrabold">{data?.activeProducts ?? 0}</div>}
              <p className="mt-1 text-xs text-muted-foreground">status = Ativo</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">OFs em Produção</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-3xl font-extrabold">{data?.manufacturingInProgress ?? 0}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">status = Em Produção</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Vendas do Mês</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-extrabold">{formatBRL(data?.salesThisMonth ?? 0)}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Soma de sales.total_amount</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Lucro Mensal</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-extrabold">{formatBRL(data?.monthlyProfit ?? 0)}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Receber − Pagar</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          <Card className="glass border-border/60 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Top 5 Produtos (Receita)</CardTitle>
              <p className="text-xs text-muted-foreground">Soma de sale_items.total no mês atual</p>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.topProductsRevenue ?? []}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatBRL(Number(v) || 0)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => formatBRL(Number(value) || 0)}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Fluxo de Caixa</CardTitle>
              <p className="text-xs text-muted-foreground">Baseado em financial_records (mês)</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Receitas</div>
                  {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <div className="mt-1 text-2xl font-extrabold text-primary">{formatBRL(data?.receitas ?? 0)}</div>}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Despesas</div>
                  {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <div className="mt-1 text-2xl font-extrabold text-destructive">{formatBRL(data?.despesas ?? 0)}</div>}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Saldo</div>
                  {isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <div className="mt-1 text-2xl font-extrabold">{formatBRL(data?.saldo ?? 0)}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5">
          <Card className="glass border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Evolução de Vendas (Últimos 30 Dias)</CardTitle>
              <p className="text-xs text-muted-foreground">Acumulado diário (soma cumulativa)</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.salesEvolution30d ?? []} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="sales30dGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-indigo))" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="hsl(var(--chart-indigo))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => {
                        const dt = new Date(`${d}T00:00:00`);
                        return format(dt, "dd/MM");
                      }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tickFormatter={(v) => formatBRL(Number(v) || 0)}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => formatBRL(Number(value) || 0)}
                      labelFormatter={(d) => {
                        const dt = new Date(`${d}T00:00:00`);
                        return format(dt, "dd/MM/yyyy");
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--chart-indigo))"
                      fillOpacity={1}
                      fill="url(#sales30dGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
