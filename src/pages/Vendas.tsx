import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
};

type ClientRow = { id: string; name: string };
type ProductRowLite = { id: string; name: string; price_sale: number | null };
type SaleItemRow = { product_id: string; quantity: number };

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
  const { data, error } = await supabase.from("sale_items").select("product_id,quantity").eq("sale_id", saleId);
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
    .select("id,created_at,code,status,total_amount,client_id,clients(name)")
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
    .select("id,name,price_sale")
    .eq("status", "Ativo")
    .order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

type SaleItemDraft = { product_id: string; quantity: number };

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
  const [status, setStatus] = React.useState<string>("Pedido");
  const [items, setItems] = React.useState<SaleItemDraft[]>([{ product_id: "", quantity: 1 }]);

  const total = React.useMemo(() => {
    const map = new Map((products ?? []).map((p) => [p.id, Number(p.price_sale ?? 0)]));
    return items.reduce((acc, it) => acc + (map.get(it.product_id) ?? 0) * Number(it.quantity ?? 0), 0);
  }, [items, products]);

  const saveSale = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente");
      const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
      if (validItems.length === 0) throw new Error("Adicione ao menos 1 item");

      if (originalStatus === "Cancelado") {
        throw new Error("Venda cancelada: itens travados (não é possível editar neste MVP)");
      }

      const map = new Map((products ?? []).map((p) => [p.id, Number(p.price_sale ?? 0)]));
      const computeItemsPayload = (saleId: string, its: SaleItemDraft[]) =>
        its.map((it) => {
          const unit = map.get(it.product_id) ?? 0;
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

      if (!editingSaleId) {
        const { data: saleInserted, error: saleErr } = await supabase
          .from("sales")
          .insert({
            client_id: clientId,
            status,
            total_amount: total,
            gross_amount: total,
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

        // Estoque: só baixa em Faturado/Entregue
        if (isStockMovingSaleStatus(status)) {
          await applyMovementBatch({ type: "Saída", saleId, its: validItems, reason: `Venda (${status})` });
        }

        // Financeiro: Faturado/Entregue cria/atualiza Receber
        if (isStockMovingSaleStatus(status)) {
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: status, orgId: currentOrg?.id });
        }
      } else {
        const saleId = editingSaleId;
        const prevStatus = originalStatus;
        const nextStatus = status;

        const wasMoving = isStockMovingSaleStatus(prevStatus);
        const nextMoving = isStockMovingSaleStatus(nextStatus);

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

        // Atualiza venda (totais e status)
        const { error: upSaleErr } = await supabase
          .from("sales")
          .update({ client_id: clientId, status: nextStatus, total_amount: total, gross_amount: total } as any)
          .eq("id", saleId);
        if (upSaleErr) throw upSaleErr;

        // Atualiza itens (se não estiver cancelando)
        if (nextStatus !== "Cancelado") {
          const { error: delErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
          if (delErr) throw delErr;
          const { error: insErr } = await supabase.from("sale_items").insert(computeItemsPayload(saleId, validItems) as any);
          if (insErr) throw insErr;
        }

        // Estoque (transição)
        if (!wasMoving && nextMoving) {
          await applyMovementBatch({ type: "Saída", saleId, its: validItems, reason: `Venda (${nextStatus})` });
        } else if (wasMoving && !nextMoving) {
          await applyMovementBatch({ type: "Entrada", saleId, its: originalItems, reason: `Estorno Venda (${nextStatus})` });
        } else if (wasMoving && nextMoving) {
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
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: nextStatus });
        } else if (nextStatus === "Cancelado" && wasMoving) {
          await upsertReceberForSale({ saleId, clientName, amount: Number(total), nextStatus: "Cancelado" });
        }
      }
    },
    onSuccess: async () => {
      toast.success(editingSaleId ? "Venda atualizada" : "Venda registrada");
      setOpen(false);
      setEditingSaleId(null);
      setClientId("");
      setStatus("Pedido");
      setItems([{ product_id: "", quantity: 1 }]);
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
    setStatus("Pedido");
    setItems([{ product_id: "", quantity: 1 }]);
    setOpen(true);
  };

  const openForEdit = async (sale: SaleRow) => {
    try {
      setEditingSaleId(sale.id);
      setClientId(sale.client_id ?? "");
      setStatus(sale.status ?? "Pedido");
      setOriginalStatus(sale.status ?? "Pedido");

      const its = await fetchSaleItems(sale.id);
      const draft = its
        .filter((x) => x.product_id)
        .map((x) => ({ product_id: x.product_id, quantity: Number(x.quantity) }));
      setItems(draft.length ? draft : [{ product_id: "", quantity: 1 }]);
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
        new Date(s.created_at).toLocaleDateString("pt-BR"),
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
            <SheetContent side="right" className="w-full sm:max-w-xl">
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
                  <p className="text-xs text-muted-foreground">
                    Estoque só é movimentado em <b>Faturado</b> e <b>Entregue</b>. Cancelado estorna se já havia movimentação.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Itens</Label>
                  {status === "Cancelado" && (
                    <p className="text-xs text-muted-foreground">Venda cancelada: itens travados.</p>
                  )}
                  <div className="grid gap-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-8">
                          <Select
                            value={it.product_id}
                            onValueChange={(v) =>
                              setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, product_id: v } : x)))
                            }
                            disabled={status === "Cancelado"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Produto…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(products ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              setItems((cur) =>
                                cur.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)),
                              )
                            }
                            disabled={status === "Cancelado"}
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setItems((cur) => cur.filter((_, i) => i !== idx))}
                            disabled={items.length === 1}
                            aria-label="Remover item"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Button type="button" variant="outline" onClick={() => setItems((cur) => [...cur, { product_id: "", quantity: 1 }])}>
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
              <ScrollArea className="max-h-[70vh]">
                <Table>
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
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold">{s.clients?.name ?? "—"}</TableCell>
                        <TableCell>{s.status ?? "—"}</TableCell>
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
              </ScrollArea>
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
