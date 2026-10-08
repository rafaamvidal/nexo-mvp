import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/exportCsv";
import { SalePrintDialog } from "@/components/sales/SalePrintDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { isForeignKeyViolation, toastDeleteBlocked } from "@/lib/supabaseErrors";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatDateBR } from "@/lib/masks";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type SaleRow = {
  id: string;
  created_at: string;
  code: string | null;
  status: string | null;
  total_amount: number | null;
  clients?: { name: string | null } | null;
  client_id?: string | null;
  observations?: string | null;
};

const SKIP_STOCK_TAG = "[SEM_BAIXA_ESTOQUE]";
function isSkipStockSale(obs?: string | null): boolean {
  return Boolean(obs && obs.includes(SKIP_STOCK_TAG));
}

type ClientRow = { id: string; name: string };
type ProductRowLite = {
  id: string;
  name: string;
  price_sale: number | null;
  price_cost: number | null;
  unit: string | null;
};
type SaleItemRow = {
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  total: number | null;
};

const STOCK_MOVING_SALES_STATUSES = new Set(["Faturado", "Entregue"]);
function isStockMovingSaleStatus(status: string) {
  return STOCK_MOVING_SALES_STATUSES.has(status);
}

function toQtyMap(items: Array<{ product_id: string; quantity: number }>) {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.product_id, (m.get(it.product_id) ?? 0) + Number(it.quantity ?? 0));
  return m;
}

async function fetchSaleItems(saleId: string): Promise<SaleItemRow[]> {
  const { data, error } = await supabase
    .from("sale_items")
    .select("product_id,quantity,unit_price,total")
    .eq("sale_id", saleId);
  if (error) throw error;
  return (data ?? []) as any;
}

async function upsertReceberForSale(params: {
  saleId: string;
  clientName: string | null;
  amount: number;
  nextStatus: string;
  orgId?: string;
}) {
  const dueDate = new Date().toISOString().slice(0, 10);
  const { data: existing, error: selErr } = await supabase
    .from("financial_records")
    .select("id,status")
    .eq("sale_id", params.saleId as any)
    .eq("type", "Receber")
    .maybeSingle();
  if (selErr) throw selErr;

  const shouldCancel = params.nextStatus === "Cancelado";
  const keepPaid = (existing?.status ?? "") === "Pago";
  const nextFinStatus = keepPaid ? "Pago" : shouldCancel ? "Cancelado" : "Aberto";

  const payload: any = {
    type: "Receber",
    sale_id: params.saleId,
    description: `Venda (${params.nextStatus}) - ${params.saleId.slice(0, 8)}`,
    category: "Vendas",
    entity_name: params.clientName,
    amount: Number(params.amount),
    due_date: dueDate,
    status: nextFinStatus,
    organization_id: params.orgId,
  };

  if (existing?.id) {
    const { error } = await supabase.from("financial_records").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else if (!shouldCancel) {
    const { error } = await supabase.from("financial_records").insert(payload);
    if (error) throw error;
  }
}

async function fetchSales(orgId?: string): Promise<SaleRow[]> {
  let query = supabase
    .from("sales")
    .select("id,created_at,code,status,total_amount,client_id,observations,clients(name)")
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchClients(orgId?: string): Promise<ClientRow[]> {
  let query = supabase.from("clients").select("id,name").order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchProductsForSale(orgId?: string): Promise<ProductRowLite[]> {
  let query = supabase
    .from("products")
    .select("id,name,price_sale,price_cost,unit")
    .eq("status", "Ativo")
    .order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

type SaleItemDraft = { product_id: string; quantity: number; unit_price: number };

export default function Vendas() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales", currentOrg?.id],
    queryFn: () => fetchSales(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients", currentOrg?.id],
    queryFn: () => fetchClients(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const { data: products } = useQuery({
    queryKey: ["products", "for-sale", currentOrg?.id],
    queryFn: () => fetchProductsForSale(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editingSaleId, setEditingSaleId] = React.useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = React.useState<string>("Pedido");
  const [originalItems, setOriginalItems] = React.useState<SaleItemDraft[]>([]);
  const [clientId, setClientId] = React.useState<string>("");
  const [saleDate, setSaleDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<string>("Pedido");
  const [skipStockMovement, setSkipStockMovement] = React.useState<boolean>(false);
  const [originalSkipStock, setOriginalSkipStock] = React.useState<boolean>(false);
  const [observations, setObservations] = React.useState<string>("");
  const [items, setItems] = React.useState<SaleItemDraft[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  const total = React.useMemo(() => {
    return items.reduce((acc, it) => acc + Number(it.unit_price ?? 0) * Number(it.quantity ?? 0), 0);
  }, [items]);

  const saveSale = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente");
      const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
      if (validItems.length === 0) throw new Error("Adicione ao menos 1 item");
      if (validItems.some((i) => Number(i.unit_price) < 0)) {
        throw new Error("O preço unitário vendido não pode ser negativo");
      }

      if (originalStatus === "Cancelado") {
        throw new Error("Venda cancelada: itens travados (não é possível editar neste MVP)");
      }

      const computeItemsPayload = (saleId: string, its: SaleItemDraft[]) =>
        its.map((it) => {
          const unit = Number(it.unit_price ?? 0);
          return {
            sale_id: saleId,
            product_id: it.product_id,
            quantity: Number(it.quantity),
            unit_price: unit,
            total: unit * Number(it.quantity),
          };
        });

      const applyMovementBatch = async (opts: { type: "Entrada" | "Saída"; saleId: string; its: SaleItemDraft[]; reason: string }) => {
        for (const it of opts.its) {
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: it.product_id,
            p_type: opts.type,
            p_quantity: Number(it.quantity),
            p_reason: opts.reason,
            p_reference_id: opts.saleId,
          });
          if (mvErr) throw mvErr;
        }
      };

      const clientName = (clients ?? []).find((c) => c.id === clientId)?.name ?? null;
      const saleCreatedAt = saleDate ? new Date(`${saleDate}T12:00:00`).toISOString() : new Date().toISOString();

      let finalObs = observations.replace(SKIP_STOCK_TAG, "").trim();
      if (skipStockMovement) {
        finalObs = finalObs ? `${SKIP_STOCK_TAG} ${finalObs}` : SKIP_STOCK_TAG;
      }

      if (!editingSaleId) {
        const { data: saleInserted, error: saleErr } = await supabase
          .from("sales")
          .insert({
            client_id: clientId,
            status,
            total_amount: total,
            gross_amount: total,
            created_at: saleCreatedAt,
            observations: finalObs || null,
            organization_id: currentOrg?.id,
          } as any)
          .select("id")
          .single();
        if (saleErr) throw saleErr;

        const saleId = (saleInserted as any).id as string;
        const itemsPayload = computeItemsPayload(saleId, validItems).map((it) => ({
          ...it,
          organization_id: currentOrg?.id,
        }));
        const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload as any);
        if (itemsErr) throw itemsErr;

        // Estoque: só baixa em Faturado/Entregue se NÃO for venda sem baixa de estoque
        if (isStockMovingSaleStatus(status) && !skipStockMovement) {
          await applyMovementBatch({ type: "Saída", saleId, its: validItems, reason: `Venda (${status})` });
        }

        // Financeiro: Faturado/Entregue cria/atualiza Receber (mesmo sem baixa física)
        if (isStockMovingSaleStatus(status)) {
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: status, orgId: currentOrg?.id });
        }
      } else {
        const saleId = editingSaleId;
        const prevStatus = originalStatus;
        const nextStatus = status;

        const wasMoving = isStockMovingSaleStatus(prevStatus);
        const nextMoving = isStockMovingSaleStatus(nextStatus);

        const wasStockDeducted = wasMoving && !originalSkipStock;
        const willDeductStock = nextMoving && !skipStockMovement;

        // Se cancelar, trava itens (não permite mudar itens ao salvar como Cancelado)
        const oldMap = toQtyMap(originalItems);
        const newMap = toQtyMap(validItems);
        const itemsChanged = (() => {
          if (oldMap.size !== newMap.size) return true;
          for (const [k, v] of oldMap) if ((newMap.get(k) ?? 0) !== v) return true;
          return false;
        })();
        if (nextStatus === "Cancelado" && itemsChanged) {
          throw new Error("Venda cancelada: itens travados. Para ajustar itens, reabra o documento (fora do escopo do MVP).");
        }

        // Atualiza venda (totais, status, data da venda e observações)
        const updatePayload: any = {
          client_id: clientId,
          status: nextStatus,
          total_amount: total,
          gross_amount: total,
          observations: finalObs || null,
        };
        if (saleCreatedAt) {
          updatePayload.created_at = saleCreatedAt;
        }

        const { error: upSaleErr } = await supabase
          .from("sales")
          .update(updatePayload)
          .eq("id", saleId);
        if (upSaleErr) throw upSaleErr;

        // Atualiza itens (se não estiver cancelando)
        if (nextStatus !== "Cancelado") {
          const { error: delErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
          if (delErr) throw delErr;
          const itemsPayload = computeItemsPayload(saleId, validItems).map((it) => ({
            ...it,
            organization_id: currentOrg?.id,
          }));
          const { error: insErr } = await supabase.from("sale_items").insert(itemsPayload as any);
          if (insErr) throw insErr;
        }

        // Estoque (transição considerando skipStockMovement)
        if (!wasStockDeducted && willDeductStock) {
          await applyMovementBatch({ type: "Saída", saleId, its: validItems, reason: `Venda (${nextStatus})` });
        } else if (wasStockDeducted && !willDeductStock) {
          await applyMovementBatch({ type: "Entrada", saleId, its: originalItems, reason: `Estorno Venda (${nextStatus})` });
        } else if (wasStockDeducted && willDeductStock) {
          // Diff por produto
          for (const [productId, oldQty] of oldMap) {
            const newQty = newMap.get(productId) ?? 0;
            const delta = Number(newQty) - Number(oldQty);
            if (delta === 0) continue;
            const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
              p_product_id: productId,
              p_type: delta > 0 ? "Saída" : "Entrada",
              p_quantity: Math.abs(delta),
              p_reason: `Ajuste Venda (${nextStatus})`,
              p_reference_id: saleId,
            });
            if (mvErr) throw mvErr;
          }
          // Produtos adicionados
          for (const [productId, newQty] of newMap) {
            if (oldMap.has(productId)) continue;
            const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
              p_product_id: productId,
              p_type: "Saída",
              p_quantity: Number(newQty),
              p_reason: `Ajuste Venda (${nextStatus})`,
              p_reference_id: saleId,
            });
            if (mvErr) throw mvErr;
          }
        }

        // Financeiro: upsert quando Faturado/Entregue; ao Cancelar marca Cancelado se não estiver Pago
        if (nextMoving) {
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: nextStatus, orgId: currentOrg?.id });
        } else if (nextStatus === "Cancelado" && (wasMoving || wasStockDeducted)) {
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: "Cancelado", orgId: currentOrg?.id });
        }
      }
    },
    onSuccess: async () => {
      toast.success(editingSaleId ? "Venda atualizada" : "Venda registrada");
      setOpen(false);
      setEditingSaleId(null);
      setClientId("");
      setSaleDate(new Date().toISOString().slice(0, 10));
      setStatus("Pedido");
      setSkipStockMovement(false);
      setOriginalSkipStock(false);
      setObservations("");
      setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
      setOriginalItems([]);
      setOriginalStatus("Pedido");
      await qc.invalidateQueries({ queryKey: ["sales"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar venda"),
  });

  const deleteSale = useMutation({
    mutationFn: async (saleId: string) => {
      // remove itens primeiro para evitar FK
      const { error: delItemsErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
      if (delItemsErr) throw delItemsErr;
      const { error: delSaleErr } = await supabase.from("sales").delete().eq("id", saleId);
      if (delSaleErr) throw delSaleErr;
    },
    onSuccess: async () => {
      toast.success("Venda excluída");
      await qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Vendas/Financeiro/Estoque");
      toast.error(e?.message ?? "Erro ao excluir venda");
    },
  });

  const openForCreate = () => {
    setEditingSaleId(null);
    setOriginalStatus("Pedido");
    setOriginalItems([]);
    setClientId("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setStatus("Pedido");
    setSkipStockMovement(false);
    setOriginalSkipStock(false);
    setObservations("");
    setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
    setOpen(true);
  };

  const openForEdit = async (sale: SaleRow) => {
    try {
      setEditingSaleId(sale.id);
      setClientId(sale.client_id ?? "");
      setSaleDate(sale.created_at ? sale.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setStatus(sale.status ?? "Pedido");
      setOriginalStatus(sale.status ?? "Pedido");
      const obs = sale.observations ?? "";
      const skipped = isSkipStockSale(obs);
      setSkipStockMovement(skipped);
      setOriginalSkipStock(skipped);
      setObservations(obs.replace(SKIP_STOCK_TAG, "").trim());

      const its = await fetchSaleItems(sale.id);
      const prodMap = new Map((products ?? []).map((p) => [p.id, p]));
      const draft: SaleItemDraft[] = its
        .filter((x) => x.product_id)
        .map((x) => {
          const fallbackPrice = Number(prodMap.get(x.product_id!)?.price_sale ?? 0);
          return {
            product_id: x.product_id!,
            quantity: Number(x.quantity),
            unit_price: x.unit_price != null ? Number(x.unit_price) : fallbackPrice,
          };
        });
      setItems(draft.length ? draft : [{ product_id: "", quantity: 1, unit_price: 0 }]);
      setOriginalItems(draft);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar venda");
    }
  };

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((s) => {
      const client = (s.clients?.name ?? "").toLowerCase();
      return client.includes(term) || (s.status ?? "").toLowerCase().includes(term) || (s.code ?? "").toLowerCase().includes(term);
    });
  }, [data, q]);

  const [printSaleId, setPrintSaleId] = React.useState<string | null>(null);

  const handleExportCsv = () => {
    exportToCsv({
      filename: `vendas_${new Date().toISOString().slice(0, 10)}`,
      headers: ["Data", "Código", "Cliente", "Status", "Valor Total (R$)"],
      rows: (filtered ?? []).map((s) => [
        formatDateBR(s.created_at),
        s.code ?? s.id.slice(0, 8),
        s.clients?.name ?? "—",
        s.status ?? "—",
        s.total_amount ?? 0,
      ]),
    });
    toast.success("Vendas exportadas para CSV com sucesso!");
  };

  return (
    <AppShell title="Vendas">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Vendas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Lista de vendas (Orçamento, Pedido, Faturado) e criação rápida.</p>
          </div>

          <div className="relative w-full md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente/status…" className="pl-9" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={(filtered ?? []).length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="hero" className="gap-2" onClick={openForCreate}>
                  <Plus className="h-4 w-4" />
                  Nova Venda
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingSaleId ? "Editar Venda" : "Nova Venda"}</SheetTitle>
              </SheetHeader>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-2">
                  <Label>Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Data da Venda</Label>
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Orçamento">Orçamento</SelectItem>
                        <SelectItem value="Pedido">Pedido</SelectItem>
                        <SelectItem value="Faturado">Faturado</SelectItem>
                        <SelectItem value="Entregue">Entregue</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Estoque só é movimentado em <b>Faturado</b> e <b>Entregue</b>. Cancelado estorna se já havia movimentação.
                </p>

                {/* Opção especial: Venda sem baixa de estoque (Item 5) */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center space-x-2.5">
                    <Checkbox
                      id="skip-stock"
                      checked={skipStockMovement}
                      onCheckedChange={(c) => setSkipStockMovement(Boolean(c))}
                      disabled={status === "Cancelado"}
                    />
                    <label
                      htmlFor="skip-stock"
                      className="text-xs font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-foreground"
                    >
                      Não descontar do estoque atual (Venda sem baixa de estoque)
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                    Ideal para vendas realizadas <strong>antes de alimentar o estoque inicial</strong> (ex: trufas já prontas ou vendas antigas). O valor a receber é gerado no Financeiro, mas a quantidade física não será subtraída do estoque.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Observações (Opcional)</Label>
                  <Input
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Ex: Venda anterior ao inventário inicial"
                    className="h-8 text-xs"
                    disabled={status === "Cancelado"}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Itens da Venda</Label>
                    <span className="text-xs text-muted-foreground">
                      Consulte o custo e ajuste o preço vendido
                    </span>
                  </div>
                  {status === "Cancelado" && (
                    <p className="text-xs text-muted-foreground">Venda cancelada: itens travados.</p>
                  )}
                  <div className="grid gap-3">
                    {items.map((it, idx) => {
                      const prod = (products ?? []).find((p) => p.id === it.product_id);
                      const costPrice = Number(prod?.price_cost ?? 0);
                      const unitSalePrice = Number(it.unit_price ?? 0);
                      const subtotal = Number(it.quantity ?? 0) * unitSalePrice;
                      const hasCost = costPrice > 0;
                      const isBelowCost = hasCost && unitSalePrice > 0 && unitSalePrice < costPrice;

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/50 bg-muted/15 p-3 space-y-2.5 transition-colors"
                        >
                          {/* Linha superior: Produto e botão remover */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={it.product_id}
                                onValueChange={(v) => {
                                  const selectedProd = (products ?? []).find((p) => p.id === v);
                                  setItems((cur) =>
                                    cur.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            product_id: v,
                                            unit_price: Number(selectedProd?.price_sale ?? 0),
                                          }
                                        : x
                                    )
                                  );
                                }}
                                disabled={status === "Cancelado"}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione o produto…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(products ?? []).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} {p.unit ? `(${p.unit})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => setItems((cur) => cur.filter((_, i) => i !== idx))}
                              disabled={items.length === 1 || status === "Cancelado"}
                              aria-label="Remover item"
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Linha inferior: Quantidade, Custo (Informativo), Valor Vendido (Editável) e Subtotal */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end pt-1">
                            <div className="grid gap-1">
                              <Label className="text-xs text-muted-foreground">Qtd</Label>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={it.quantity}
                                onChange={(e) =>
                                  setItems((cur) =>
                                    cur.map((x, i) =>
                                      i === idx ? { ...x, quantity: Number(e.target.value) } : x
                                    )
                                  )
                                }
                                disabled={status === "Cancelado"}
                              />
                            </div>

                            <div className="grid gap-1">
                              <Label className="text-xs text-muted-foreground">Custo Unit.</Label>
                              <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center text-xs font-medium text-muted-foreground">
                                {it.product_id ? formatBRL(costPrice) : "—"}
                              </div>
                            </div>

                            <div className="grid gap-1">
                              <Label className="text-xs font-semibold text-foreground">Valor Vendido</Label>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={it.unit_price}
                                onChange={(e) =>
                                  setItems((cur) =>
                                    cur.map((x, i) =>
                                      i === idx ? { ...x, unit_price: Number(e.target.value) } : x
                                    )
                                  )
                                }
                                disabled={status === "Cancelado"}
                                className={isBelowCost ? "border-amber-500 focus-visible:ring-amber-500 font-semibold" : "font-semibold"}
                              />
                            </div>

                            <div className="grid gap-1">
                              <Label className="text-xs text-muted-foreground">Subtotal</Label>
                              <div className="h-9 px-3 rounded-md border border-border/40 bg-background/80 flex items-center justify-end text-xs font-bold">
                                {formatBRL(subtotal)}
                              </div>
                            </div>
                          </div>

                          {isBelowCost && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 pt-0.5">
                              ⚠️ Atenção: Valor vendido ({formatBRL(unitSalePrice)}) está abaixo do custo unitário ({formatBRL(costPrice)}).
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setItems((cur) => [...cur, { product_id: "", quantity: 1, unit_price: 0 }])}
                      disabled={status === "Cancelado"}
                    >
                      Adicionar item
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      Total
                    </div>
                    <div className="text-lg font-extrabold">{formatBRL(total)}</div>
                  </div>
                </div>

                <Button type="button" variant="hero" onClick={() => saveSale.mutate()} disabled={saveSale.isPending}>
                  {editingSaleId ? "Salvar alterações" : "Salvar Venda"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

        {error && (
          <Card className="glass mt-5 p-6">
            <p className="text-sm text-muted-foreground">Erro ao carregar: {(error as any)?.message ?? ""}</p>
          </Card>
        )}

        <div className="mt-5">
          {isLoading && (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && !error && (data ?? []).length === 0 && (
            <Card className="glass p-8 text-center">
              <p className="text-base font-semibold">Nenhuma venda ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie a primeira venda para começar.</p>
            </Card>
          )}

          {!isLoading && !error && (data ?? []).length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  ↔️ Arraste para o lado para ver ações e valores
                </span>
                <span className="font-semibold">{(filtered ?? []).length} vendas</span>
              </div>
              <Table containerClassName="max-h-[70vh]" className="min-w-[680px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filtered ?? []).map((s) => (
                    <TableRow key={s.id} className="odd:bg-muted/20">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateBR(s.created_at)}
                      </TableCell>
                      <TableCell className="font-semibold">{s.clients?.name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span>{s.status ?? "—"}</span>
                          {isSkipStockSale(s.observations) && (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Sem baixa estoque
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatBRL(Number(s.total_amount ?? 0))}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Imprimir comprovante"
                            title="Imprimir / Visualizar Comprovante"
                            onClick={() => setPrintSaleId(s.id)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => void openForEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Se a venda tiver vínculos, a exclusão poderá ser bloqueada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSale.mutate(s.id)} disabled={deleteSale.isPending}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </section>

      {printSaleId && (
        <SalePrintDialog
          open={!!printSaleId}
          onOpenChange={(v) => {
            if (!v) setPrintSaleId(null);
          }}
          saleId={printSaleId}
        />
      )}
    </AppShell>
  );
}
