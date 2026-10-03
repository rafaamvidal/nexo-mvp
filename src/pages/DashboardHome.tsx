import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfDay, startOfMonth, subDays } from "date-fns";
import { Link } from "react-router-dom";
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
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Package,
  PackageX,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";

import { useOrganization } from "@/contexts/OrganizationContext";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/masks";

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
  criticalStock: Array<{
    id: string;
    name: string;
    current_stock: number;
    min_stock: number;
    unit: string;
  }>;
  urgentFinancial: Array<{
    id: string;
    description: string;
    amount: number;
    due_date: string;
    type: string;
  }>;
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

async function fetchDashboardData(orgId?: string): Promise<DashboardData> {
  const start = startOfMonth(new Date()).toISOString();
  const end = endOfMonth(new Date()).toISOString();
  const start30 = startOfDay(subDays(new Date(), 29)).toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);

  let pQuery = supabase.from("products").select("id,status,category", { count: "exact" });
  let moQuery = supabase.from("manufacturing_orders").select("id,status", { count: "exact" });
  let salesQuery = supabase.from("sales").select("total_amount,created_at").gte("created_at", start).lte("created_at", end);
  let finQuery = supabase.from("financial_records").select("amount,type,due_date").gte("due_date", start.slice(0, 10)).lte("due_date", end.slice(0, 10));
  let itemsQuery = supabase.from("sale_items").select("total, products(name), sales(created_at)");
  let sales30Query = supabase.from("sales").select("total_amount,created_at").gte("created_at", start30).lte("created_at", new Date().toISOString());
  let allProdsQuery = supabase.from("products").select("id,name,current_stock,min_stock,unit,status").eq("status", "Ativo");
  let urgentFinQuery = supabase.from("financial_records").select("id,description,amount,due_date,type").eq("status", "Aberto").lte("due_date", todayStr).order("due_date", { ascending: true }).limit(10);

  if (orgId) {
    pQuery = pQuery.eq("organization_id", orgId);
    moQuery = moQuery.eq("organization_id", orgId);
    salesQuery = salesQuery.eq("organization_id", orgId);
    finQuery = finQuery.eq("organization_id", orgId);
    itemsQuery = itemsQuery.eq("organization_id", orgId);
    sales30Query = sales30Query.eq("organization_id", orgId);
    allProdsQuery = allProdsQuery.eq("organization_id", orgId);
    urgentFinQuery = urgentFinQuery.eq("organization_id", orgId);
  }

  const [productsRes, moRes, salesRes, finRes, saleItemsRes, sales30Res, allProductsRes, urgentFinRes] =
    await Promise.all([
      pQuery,
      moQuery,
      salesQuery,
      finQuery,
      itemsQuery,
      sales30Query,
      allProdsQuery,
      urgentFinQuery,
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
  const receitas = fin
    .filter((r) => (r.type ?? "").toLowerCase() === "receber")
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const despesas = fin
    .filter((r) => (r.type ?? "").toLowerCase() === "pagar")
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);
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

  // Alertas críticos
  const allProds = (allProductsRes.data ?? []) as Array<{
    id: string;
    name: string;
    current_stock: number;
    min_stock: number;
    unit: string;
  }>;
  const criticalStock = allProds
    .filter((p) => Number(p.current_stock) <= Number(p.min_stock))
    .slice(0, 5);

  const urgentFinancial = ((urgentFinRes.data ?? []) as unknown as Array<{
    id: string;
    description: string;
    amount: number;
    due_date: string;
    type: string;
  }>).slice(0, 5);

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
    criticalStock,
    urgentFinancial,
  };
}

export default function DashboardHome() {
  const { currentOrg, organizations, isLoading: isOrgLoading, openSetupModal } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", currentOrg?.id],
    queryFn: () => fetchDashboardData(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  const hasAlerts =
    (data?.criticalStock && data.criticalStock.length > 0) ||
    (data?.urgentFinancial && data.urgentFinancial.length > 0);

  const hasNoOrg = !isOrgLoading && !currentOrg && organizations.length === 0;

  return (
    <AppShell title="Dashboard">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-extrabold">Visão Geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">Indicadores e visão operacional em tempo real.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Dados em tempo real
          </div>
        </header>

        {hasNoOrg && (
          <Card className="glass border-primary/40 bg-primary/5 p-8 text-center shadow-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <Building2 className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Configure sua Empresa no Agilix ERP</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Você ainda não possui uma empresa cadastrada. Para começar a cadastrar produtos, gerenciar clientes,
              registrar vendas e controlar seu estoque do zero, cadastre sua empresa.
            </p>
            <div className="mt-5 flex justify-center">
              <Button onClick={openSetupModal} variant="hero" size="lg" className="gap-2 shadow-sm">
                <Plus className="h-5 w-5" />
                Cadastrar Minha Empresa Agora
              </Button>
            </div>
          </Card>
        )}

        {error && (
          <Card className="glass p-6">
            <p className="text-sm text-muted-foreground">Erro ao carregar dashboard: {(error as any)?.message ?? ""}</p>
          </Card>
        )}

        {/* 4 CARDS PRINCIPAIS */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Produtos Ativos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-3xl font-extrabold">{data?.activeProducts ?? 0}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Cadastrados no catálogo</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                OFs em Produção
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-3xl font-extrabold">{data?.manufacturingInProgress ?? 0}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Ordens em fabricação</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vendas do Mês
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-extrabold text-primary">{formatBRL(data?.salesThisMonth ?? 0)}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Faturamento bruto mensal</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Resultado Operacional
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div
                  className={`text-3xl font-extrabold ${
                    (data?.monthlyProfit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {formatBRL(data?.monthlyProfit ?? 0)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Receitas − Despesas (Mês)</p>
            </CardContent>
          </Card>
        </div>

        {/* WIDGET CENTRAL DE ATENÇÃO / ALERTAS */}
        <Card className="glass border-border/60 overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${hasAlerts ? "text-amber-500" : "text-muted-foreground"}`} />
                <CardTitle className="text-base font-bold">Central de Alertas & Ações Necessárias</CardTitle>
              </div>
              {!isLoading && !hasAlerts && (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Operação 100% em dia
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </div>
            ) : !hasAlerts ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500/60" />
                <p className="font-semibold text-foreground">Nenhuma pendência crítica no momento</p>
                <p className="mt-1 text-xs">
                  Todos os produtos estão acima do estoque mínimo e não há contas vencidas para hoje.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Alerta de Estoque */}
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-destructive/10">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
                      <PackageX className="h-4 w-4" />
                      Estoque no Limite ({data?.criticalStock.length ?? 0})
                    </span>
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-destructive hover:bg-destructive/10">
                      <Link to="/estoque" className="gap-1">
                        Ver Estoque <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-2 divide-y divide-destructive/10">
                    {data?.criticalStock.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">Nenhum produto crítico.</p>
                    ) : (
                      data?.criticalStock.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                          <span className="font-medium text-foreground truncate max-w-[180px]">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-destructive">
                              {p.current_stock} {p.unit}
                            </span>
                            <span className="text-[11px] text-muted-foreground">(Mín: {p.min_stock})</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Alerta de Financeiro */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/10">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Contas Vencidas / Hoje ({data?.urgentFinancial.length ?? 0})
                    </span>
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-amber-600 hover:bg-amber-500/10">
                      <Link to="/financeiro" className="gap-1">
                        Ver Financeiro <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-2 divide-y divide-amber-500/10">
                    {data?.urgentFinancial.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">Nenhuma conta vencida ou para hoje.</p>
                    ) : (
                      data?.urgentFinancial.map((f) => {
                        const isOverdue = f.due_date < todayStr;
                        const isReceita = (f.type ?? "").toLowerCase() === "receber";
                        return (
                          <div key={f.id} className="flex items-center justify-between py-2 text-xs">
                            <div className="truncate max-w-[180px]">
                              <p className="font-medium text-foreground truncate">{f.description}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {isOverdue ? "Venceu em: " : "Vence hoje: "}
                                {new Date(f.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <span
                              className={`font-bold ${
                                isReceita ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {formatBRL(f.amount)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICOS: TOP PRODUTOS E FLUXO DE CAIXA */}
        <div className="grid gap-3 lg:grid-cols-5">
          <Card className="glass border-border/60 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Top 5 Produtos por Receita</CardTitle>
              <p className="text-xs text-muted-foreground">Mais vendidos no mês atual</p>
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
              <CardTitle className="text-base font-bold">Fluxo de Caixa Mensal</CardTitle>
              <p className="text-xs text-muted-foreground">Entradas e saídas registradas no período</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Receitas do Mês</div>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-32" />
                  ) : (
                    <div className="mt-1 text-2xl font-extrabold text-emerald-600">
                      {formatBRL(data?.receitas ?? 0)}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Despesas do Mês</div>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-32" />
                  ) : (
                    <div className="mt-1 text-2xl font-extrabold text-rose-600">
                      {formatBRL(data?.despesas ?? 0)}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Saldo Líquido</div>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-32" />
                  ) : (
                    <div
                      className={`mt-1 text-2xl font-extrabold ${
                        (data?.saldo ?? 0) >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {formatBRL(data?.saldo ?? 0)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* EVOLUÇÃO DE VENDAS (30 DIAS) */}
        <Card className="glass border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Evolução de Vendas (Últimos 30 Dias)</CardTitle>
            <p className="text-xs text-muted-foreground">Receita acumulada diária</p>
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
      </section>
    </AppShell>
  );
}
