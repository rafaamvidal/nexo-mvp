import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, startOfMonth } from "date-fns";
import { Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from "recharts";
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
  categoryCounts: { name: string; value: number }[];
  receitas: number;
  despesas: number;
  saldo: number;
};

async function fetchDashboardData(): Promise<DashboardData> {
  const start = startOfMonth(new Date()).toISOString();
  const end = endOfMonth(new Date()).toISOString();

  const [productsRes, moRes, salesRes, finRes] = await Promise.all([
    supabase.from("products").select("id,status,category", { count: "exact" }),
    supabase.from("manufacturing_orders").select("id,status", { count: "exact" }),
    supabase.from("sales").select("total_amount,created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("financial_records").select("amount,type,due_date").gte("due_date", start.slice(0, 10)).lte("due_date", end.slice(0, 10)),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (moRes.error) throw moRes.error;
  if (salesRes.error) throw salesRes.error;
  if (finRes.error) throw finRes.error;

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

  const categoryMap = new Map<string, number>();
  for (const p of products) {
    const key = (p.category ?? "Sem categoria").trim() || "Sem categoria";
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  }
  const categoryCounts = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    activeProducts,
    manufacturingInProgress,
    salesThisMonth,
    monthlyProfit,
    categoryCounts,
    receitas,
    despesas,
    saldo,
  };
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted))",
];

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
              <CardTitle className="text-base font-bold">Produtos por Categoria</CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição do catálogo (Top 10)</p>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip />
                    <Pie dataKey="value" nameKey="name" data={data?.categoryCounts ?? []} innerRadius={65} outerRadius={95}>
                      {(data?.categoryCounts ?? []).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
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
      </section>
    </AppShell>
  );
}
