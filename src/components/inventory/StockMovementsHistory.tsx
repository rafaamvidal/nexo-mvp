import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Download, History, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportCsv";
import { useOrganization } from "@/contexts/OrganizationContext";

export type StockMovementRow = {
  id: string;
  created_at: string;
  product_id: string;
  type: string;
  quantity: number;
  reason: string | null;
  reference_id: string | null;
  products?: {
    name: string | null;
    unit: string | null;
    sku: string | null;
    category: string | null;
  } | null;
};

async function fetchStockMovements(orgId?: string): Promise<StockMovementRow[]> {
  let query = supabase
    .from("stock_movements")
    .select(`
      id,
      created_at,
      product_id,
      type,
      quantity,
      reason,
      reference_id,
      products (
        name,
        unit,
        sku,
        category
      )
    `)
    .order("created_at", { ascending: false })
    .limit(250);

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as any;
}

export function StockMovementsHistory() {
  const { currentOrg } = useOrganization();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stock_movements", "audit", currentOrg?.id],
    queryFn: () => fetchStockMovements(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    return list.filter((m) => {
      const term = search.trim().toLowerCase();
      const productName = (m.products?.name ?? "").toLowerCase();
      const productSku = (m.products?.sku ?? "").toLowerCase();
      const reason = (m.reason ?? "").toLowerCase();

      const matchesSearch =
        !term ||
        productName.includes(term) ||
        productSku.includes(term) ||
        reason.includes(term);

      const mType = (m.type ?? "").toLowerCase();
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "entrada" && (mType.includes("entrada") || mType.includes("in") || mType.includes("purchase"))) ||
        (typeFilter === "saida" && (mType.includes("saída") || mType.includes("saida") || mType.includes("out") || mType.includes("sale"))) ||
        (typeFilter === "ajuste" && mType.includes("ajuste"));

      return matchesSearch && matchesType;
    });
  }, [data, search, typeFilter]);

  const renderTypeBadge = (type: string) => {
    const t = (type ?? "").toLowerCase();
    if (t.includes("entrada") || t.includes("in") || t.includes("purchase")) {
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1">
          <ArrowDownLeft className="h-3 w-3" />
          Entrada
        </Badge>
      );
    }
    if (t.includes("saída") || t.includes("saida") || t.includes("out") || t.includes("sale")) {
      return (
        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 gap-1">
          <ArrowUpRight className="h-3 w-3" />
          Saída
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <SlidersHorizontal className="h-3 w-3" />
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controles de busca e filtro */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto, SKU, motivo..."
              className="pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
              <SelectItem value="ajuste">Ajustes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              exportToCsv({
                filename: `extrato_estoque_${new Date().toISOString().slice(0, 10)}`,
                headers: ["Data e Hora", "Produto", "SKU", "Tipo", "Quantidade", "Unidade", "Motivo"],
                rows: filtered.map((m) => [
                  m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy HH:mm") : "",
                  m.products?.name ?? "",
                  m.products?.sku ?? "",
                  m.type,
                  m.quantity,
                  m.products?.unit ?? "un",
                  m.reason ?? "",
                ]),
              });
              toast.success("Extrato de estoque exportado em CSV!");
            }}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <span className="text-xs text-muted-foreground">
            {filtered.length} registro(s)
          </span>
        </div>
      </div>

      {error && (
        <Card className="glass p-6">
          <p className="text-sm text-destructive">
            Erro ao carregar movimentações: {(error as any)?.message ?? "Erro desconhecido"}
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <Card className="glass overflow-hidden rounded-xl border border-border/60">
          <ScrollArea className="max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Data / Hora</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Motivo / Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      <History className="mx-auto mb-2 h-6 w-6 opacity-40" />
                      Nenhuma movimentação encontrada para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => {
                    const isPositive =
                      m.type.toLowerCase().includes("entrada") ||
                      m.type.toLowerCase().includes("in") ||
                      m.type.toLowerCase().includes("purchase");

                    return (
                      <TableRow key={m.id} className="odd:bg-muted/15">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {m.products?.name ?? "Produto removido"}
                          </div>
                          {m.products?.sku && (
                            <span className="text-xs text-muted-foreground font-mono">
                              SKU: {m.products.sku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{renderTypeBadge(m.type)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                          </span>{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {m.products?.unit ?? "un"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {m.reason ?? "Sem motivo informado"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
