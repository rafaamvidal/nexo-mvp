import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Plus, Search, Trash2, Truck, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { parsePackageMetadata, calculateUnitCost } from "@/lib/packageConversion";

type SupplierRow = { id: string; name: string; observations?: string | null };
type ProductRawRow = {
  id: string;
  name: string;
  price_cost: number | null;
  unit: string;
  type?: string;
  description?: string | null;
};

type PurchaseOrderRow = {
  id: string;
  created_at: string;
  code: string | null;
  status: string | null;
  total_amount: number | null;
  order_date: string | null;
  expected_delivery_date?: string | null;
  observations?: string | null;
  supplier_id?: string | null;
  suppliers?: { name: string | null } | null;
};

type PurchaseItemDraft = { product_id: string; quantity: number; unit_cost: number };
type PurchaseItemRow = { product_id: string | null; quantity: number; unit_cost: number };

function toQtyMap(items: Array<{ product_id: string; quantity: number }>) {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.product_id, (m.get(it.product_id) ?? 0) + Number(it.quantity ?? 0));
  return m;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "em cotação") return <Badge variant="secondary">Em Cotação</Badge>;
  if (s === "aprovado") return <Badge variant="outline">Aprovado</Badge>;
  if (s === "recebido") return <Badge>Recebido</Badge>;
  return <Badge variant="outline">{status ?? "—"}</Badge>;
}

async function fetchPurchaseOrders(orgId?: string): Promise<PurchaseOrderRow[]> {
  let query = supabase
    .from("purchase_orders")
    .select("id,created_at,code,status,total_amount,order_date,expected_delivery_date,observations,supplier_id,suppliers(name)")
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchPurchaseItems(poId: string): Promise<PurchaseItemRow[]> {
  const { data, error } = await supabase
    .from("purchase_items")
    .select("product_id,quantity,unit_cost")
    .eq("purchase_order_id", poId);
  if (error) throw error;
  return (data ?? []) as any;
}

async function upsertPagarForPO(params: {
  purchaseOrderId: string;
  supplierName: string | null;
  amount: number;
  nextStatus: string;
  dueDate: string;
  orgId?: string;
}) {
  const { data: existing, error: selErr } = await supabase
    .from("financial_records")
    .select("id,status")
    .eq("purchase_order_id", params.purchaseOrderId as any)
    .eq("type", "Pagar")
    .maybeSingle();
  if (selErr) throw selErr;

  const keepPaid = (existing?.status ?? "") === "Pago";
  const nextFinStatus = keepPaid ? "Pago" : params.nextStatus === "Cancelado" ? "Cancelado" : "Aberto";

  const payload: any = {
    type: "Pagar",
    purchase_order_id: params.purchaseOrderId,
    description: `Compra (${params.nextStatus}) - Pedido ${params.purchaseOrderId.slice(0, 8)}`,
    category: "Compras",
    entity_name: params.supplierName,
    amount: Number(params.amount),
    due_date: params.dueDate,
    status: nextFinStatus,
    organization_id: params.orgId,
  };

  if (existing?.id) {
    const { error } = await supabase.from("financial_records").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else if (params.nextStatus !== "Cancelado") {
    const { error } = await supabase.from("financial_records").insert(payload);
    if (error) throw error;
  }
}

async function fetchSuppliers(orgId?: string): Promise<SupplierRow[]> {
  let query = supabase.from("suppliers").select("id,name,observations").order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchRawMaterials(orgId?: string): Promise<ProductRawRow[]> {
  let query = supabase
    .from("products")
    .select("id,name,price_cost,unit,type,description")
    .eq("status", "Ativo")
    .neq("type", "Produto Final")
    .order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Compras() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase_orders", currentOrg?.id],
    queryFn: () => fetchPurchaseOrders(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "lite", currentOrg?.id],
    queryFn: () => fetchSuppliers(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const { data: raws } = useQuery({
    queryKey: ["products", "raw", currentOrg?.id],
    queryFn: () => fetchRawMaterials(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("Em Cotação");
  const [items, setItems] = React.useState<PurchaseItemDraft[]>([{ product_id: "", quantity: 1, unit_cost: 0 }]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PurchaseOrderRow | null>(null);
  const [editSupplierId, setEditSupplierId] = React.useState<string>("");
  const [editStatus, setEditStatus] = React.useState<string>("Em Cotação");
  const [editOrderDate, setEditOrderDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [editExpectedDate, setEditExpectedDate] = React.useState<string>("");
  const [editObs, setEditObs] = React.useState<string>("");
  const [editItems, setEditItems] = React.useState<PurchaseItemDraft[]>([{ product_id: "", quantity: 1, unit_cost: 0 }]);
  const [origStatus, setOrigStatus] = React.useState<string>("Em Cotação");
  const [origItems, setOrigItems] = React.useState<PurchaseItemDraft[]>([]);
  const [confirmImpactOpen, setConfirmImpactOpen] = React.useState(false);

  const total = React.useMemo(() => {
    return items.reduce((acc, it) => acc + Number(it.quantity ?? 0) * Number(it.unit_cost ?? 0), 0);
  }, [items]);

  const editTotal = React.useMemo(() => {
    return editItems.reduce((acc, it) => acc + Number(it.quantity ?? 0) * Number(it.unit_cost ?? 0), 0);
  }, [editItems]);

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((o) => {
      const supplier = (o.suppliers?.name ?? "").toLowerCase();
      return (
        supplier.includes(term) ||
        (o.status ?? "").toLowerCase().includes(term) ||
        (o.code ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, q]);

  const createPO = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Selecione um fornecedor");
      const validItems = items
        .filter((i) => i.product_id && Number(i.quantity) > 0)
        .map((i) => ({ ...i, unit_cost: Number(i.unit_cost ?? 0) }));
      if (validItems.length === 0) throw new Error("Adicione ao menos 1 item");
      if (validItems.some((i) => Number(i.unit_cost) <= 0)) throw new Error("Informe o custo unitário");

      const orderDate = new Date().toISOString().slice(0, 10);
      const { data: poInserted, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: supplierId,
          status,
          order_date: orderDate,
          total_amount: Number(total),
          organization_id: currentOrg?.id,
        } as any)
        .select("id")
        .single();
      if (poErr) throw poErr;

      const poId = (poInserted as any).id as string;
      const payload = validItems.map((it) => ({
        purchase_order_id: poId,
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost),
        total: Number(it.quantity) * Number(it.unit_cost),
        organization_id: currentOrg?.id,
      }));

      const { error: itemsErr } = await supabase.from("purchase_items").insert(payload as any);
      if (itemsErr) throw itemsErr;

      // Integração com financeiro: se já nasce Aprovado/Recebido, cria Pagar.
      const shouldCreatePayable = status === "Aprovado" || status === "Recebido";
      if (shouldCreatePayable) {
        await upsertPagarForPO({
          purchaseOrderId: poId,
          supplierName: (suppliers ?? []).find((s) => s.id === supplierId)?.name ?? null,
          amount: Number(total),
          nextStatus: status,
          dueDate: orderDate,
          orgId: currentOrg?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Pedido criado");
      setOpen(false);
      setSupplierId("");
      setStatus("Em Cotação");
      setItems([{ product_id: "", quantity: 1, unit_cost: 0 }]);
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const receivePO = useMutation({
    mutationFn: async (po: PurchaseOrderRow) => {
      if ((po.status ?? "") === "Recebido") return;

      const { data: itemsData, error: itErr } = await supabase
        .from("purchase_items")
        .select("product_id,quantity")
        .eq("purchase_order_id", po.id);
      if (itErr) throw itErr;
      const rows = (itemsData ?? []) as Array<{ product_id: string | null; quantity: number }>;
      const valid = rows.filter((r) => r.product_id && Number(r.quantity) > 0) as Array<{ product_id: string; quantity: number }>;
      if (valid.length === 0) throw new Error("Pedido sem itens");

      // Entrada em estoque
      for (const it of valid) {
        const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
          p_product_id: it.product_id,
          p_type: "Entrada",
          p_quantity: it.quantity,
          p_reason: "Compra (Recebimento)",
          p_reference_id: po.id,
        });
        if (mvErr) throw mvErr;
      }

      const { error: upErr } = await supabase.from("purchase_orders").update({ status: "Recebido" } as any).eq("id", po.id);
      if (upErr) throw upErr;

      // Integração com financeiro (Pagar) na confirmação/recebimento
      const amount = Number(po.total_amount ?? 0);
      if (amount > 0) {
        const dueDate = new Date().toISOString().slice(0, 10);
        await upsertPagarForPO({
          purchaseOrderId: po.id,
          supplierName: po.suppliers?.name ?? null,
          amount,
          nextStatus: "Recebido",
          dueDate,
          orgId: currentOrg?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Pedido recebido e estoque atualizado");
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao receber pedido"),
  });

  const deletePO = useMutation({
    mutationFn: async (poId: string) => {
      const { error: delItemsErr } = await supabase.from("purchase_items").delete().eq("purchase_order_id", poId);
      if (delItemsErr) throw delItemsErr;
      const { error: delErr } = await supabase.from("purchase_orders").delete().eq("id", poId);
      if (delErr) throw delErr;
    },
    onSuccess: async () => {
      toast.success("Pedido excluído");
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Compras/Estoque");
      toast.error(e?.message ?? "Erro ao excluir pedido");
    },
  });

  const cancelPO = useMutation({
    mutationFn: async (po: PurchaseOrderRow) => {
      const prev = po.status ?? "";
      if (prev === "Cancelado") return;

      // Se já recebeu antes, estorna estoque (Saída)
      if (prev === "Recebido") {
        const rows = await fetchPurchaseItems(po.id);
        const valid = rows
          .filter((r) => r.product_id && Number(r.quantity) > 0)
          .map((r) => ({ product_id: r.product_id as string, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost ?? 0) }));
        for (const it of valid) {
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: it.product_id,
            p_type: "Saída",
            p_quantity: it.quantity,
            p_reason: "Compra (Cancelamento)",
            p_reference_id: po.id,
          });
          if (mvErr) throw mvErr;
        }
      }

      const { error: upErr } = await supabase.from("purchase_orders").update({ status: "Cancelado" } as any).eq("id", po.id);
      if (upErr) throw upErr;

      // Financeiro: marca cancelado se existir e não estiver Pago
      const dueDate = (po.order_date ?? new Date().toISOString().slice(0, 10)) as string;
      await upsertPagarForPO({
        purchaseOrderId: po.id,
        supplierName: po.suppliers?.name ?? null,
        amount: Number(po.total_amount ?? 0),
        nextStatus: "Cancelado",
        dueDate,
        orgId: currentOrg?.id,
      });
    },
    onSuccess: async () => {
      toast.success("Pedido cancelado");
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar pedido"),
  });

  const saveEdit = useMutation({
    mutationFn: async (opts: { confirmedImpact?: boolean }) => {
      if (!editing) return;

      if (origStatus === "Cancelado") throw new Error("Pedido cancelado: itens travados (não é possível editar neste MVP)");

      const validItems = editItems
        .filter((i) => i.product_id && Number(i.quantity) > 0)
        .map((i) => ({ ...i, unit_cost: Number(i.unit_cost ?? 0) }));
      if (validItems.length === 0) throw new Error("Adicione ao menos 1 item");

      const oldMap = toQtyMap(origItems);
      const newMap = toQtyMap(validItems);
      const itemsChanged = (() => {
        if (oldMap.size !== newMap.size) return true;
        for (const [k, v] of oldMap) if ((newMap.get(k) ?? 0) !== v) return true;
        return false;
      })();

      if (origStatus === "Recebido" && itemsChanged && !opts.confirmedImpact) {
        throw new Error("CONFIRM_STOCK_IMPACT");
      }

      // Cancelamento: se estava Recebido, estorna estoque
      if (origStatus === "Recebido" && editStatus === "Cancelado") {
        for (const it of origItems) {
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: it.product_id,
            p_type: "Saída",
            p_quantity: Number(it.quantity),
            p_reason: "Compra (Cancelamento)",
            p_reference_id: editing.id,
          });
          if (mvErr) throw mvErr;
        }
      }

      // Ajuste de estoque por diff (pedido já recebido)
      if (origStatus === "Recebido" && itemsChanged && editStatus === "Recebido") {
        for (const [productId, oldQty] of oldMap) {
          const newQty = newMap.get(productId) ?? 0;
          const delta = Number(newQty) - Number(oldQty);
          if (delta === 0) continue;
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: productId,
            p_type: delta > 0 ? "Entrada" : "Saída",
            p_quantity: Math.abs(delta),
            p_reason: "Compra (Ajuste pós-recebimento)",
            p_reference_id: editing.id,
          });
          if (mvErr) throw mvErr;
        }
        for (const [productId, newQty] of newMap) {
          if (oldMap.has(productId)) continue;
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: productId,
            p_type: "Entrada",
            p_quantity: Number(newQty),
            p_reason: "Compra (Ajuste pós-recebimento)",
            p_reference_id: editing.id,
          });
          if (mvErr) throw mvErr;
        }
      }

      // Update cabeçalho
      const { error: upErr } = await supabase
        .from("purchase_orders")
        .update(
          {
            supplier_id: editSupplierId || null,
            status: editStatus,
            order_date: editOrderDate || null,
            expected_delivery_date: editExpectedDate || null,
            observations: editObs.trim() || null,
            total_amount: Number(editTotal),
          } as any,
        )
        .eq("id", editing.id);
      if (upErr) throw upErr;

      // Update itens (se não cancelado)
      if (editStatus !== "Cancelado") {
        const { error: delErr } = await supabase.from("purchase_items").delete().eq("purchase_order_id", editing.id);
        if (delErr) throw delErr;
        const payload = validItems.map((it) => ({
          purchase_order_id: editing.id,
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
          total: Number(it.quantity) * Number(it.unit_cost),
          organization_id: currentOrg?.id,
        }));
        const { error: insErr } = await supabase.from("purchase_items").insert(payload as any);
        if (insErr) throw insErr;
      }

      // Financeiro idempotente
      const supplierName = (suppliers ?? []).find((s) => s.id === editSupplierId)?.name ?? editing.suppliers?.name ?? null;
      if (editStatus === "Aprovado" || editStatus === "Recebido" || editStatus === "Cancelado") {
        await upsertPagarForPO({
          purchaseOrderId: editing.id,
          supplierName,
          amount: Number(editTotal),
          nextStatus: editStatus,
          dueDate: editOrderDate || new Date().toISOString().slice(0, 10),
          orgId: currentOrg?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Pedido atualizado");
      setEditOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => {
      if (e?.message === "CONFIRM_STOCK_IMPACT") {
        setConfirmImpactOpen(true);
        return;
      }
      toast.error(e?.message ?? "Erro ao salvar alterações");
    },
  });

  const openEditDialog = async (po: PurchaseOrderRow) => {
    try {
      const rows = await fetchPurchaseItems(po.id);
      const draft: PurchaseItemDraft[] = rows
        .filter((r) => r.product_id)
        .map((r) => ({ product_id: r.product_id as string, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost ?? 0) }));
      setEditing(po);
      setEditSupplierId(po.supplier_id ?? "");
      setEditStatus(po.status ?? "Em Cotação");
      setEditOrderDate(po.order_date ?? new Date().toISOString().slice(0, 10));
      setEditExpectedDate(po.expected_delivery_date ?? "");
      setEditObs(po.observations ?? "");
      setEditItems(draft.length ? draft : [{ product_id: "", quantity: 1, unit_cost: 0 }]);
      setOrigItems(draft);
      setOrigStatus(po.status ?? "Em Cotação");
      setEditOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar pedido");
    }
  };

  return (
    <AppShell title="Compras">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Compras</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pedidos de compra, recebimento e entrada automática em estoque.</p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fornecedor/status/código…" className="pl-9" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="hero" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Pedido
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Novo Pedido de Compra</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Fornecedor</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(suppliers ?? []).map((s) => {
                            const fornecMatch = s.observations?.match(/\[Fornece:\s*([^\]]+)\]/i);
                            const fornece = fornecMatch ? fornecMatch[1].trim() : null;
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} {fornece ? `— (${fornece})` : ""}
                              </SelectItem>
                            );
                          })}
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
                          <SelectItem value="Em Cotação">Em Cotação</SelectItem>
                          <SelectItem value="Aprovado">Aprovado</SelectItem>
                          <SelectItem value="Recebido">Recebido</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Se criar como Aprovado/Recebido, gera lançamento (Pagar).</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Itens (somente Matéria-prima)</Label>
                    <div className="grid gap-2">
                      {items.map((it, idx) => {
                        const prod = (raws ?? []).find((p) => p.id === it.product_id);
                        const unit = prod?.unit;
                        const pkg = parsePackageMetadata(prod?.description);
                        const qtyLabel = unit ? `Quantidade (${unit})` : "Quantidade";
                        return (
                        <div key={idx} className="rounded-lg border border-border/40 p-2 space-y-1 bg-muted/10">
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                              <Select
                                value={it.product_id}
                                onValueChange={(v) =>
                                  setItems((cur) =>
                                    cur.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            product_id: v,
                                            unit_cost:
                                              Number((raws ?? []).find((p) => p.id === v)?.price_cost ?? x.unit_cost ?? 0) || 0,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Produto…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(raws ?? []).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} <span className="text-muted-foreground">({p.unit})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2 grid gap-1">
                              <p className="text-xs text-muted-foreground">{qtyLabel}</p>
                              <Input
                                type="number"
                                min={1}
                                value={it.quantity}
                                onChange={(e) =>
                                  setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                                }
                              />
                            </div>
                            <div className="col-span-3 grid gap-1">
                              <p className="text-xs text-muted-foreground">Custo unitário (R$)</p>
                              <Input
                                type="number"
                                min={0}
                                step={0.0001}
                                value={it.unit_cost}
                                onChange={(e) =>
                                  setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, unit_cost: Number(e.target.value) } : x)))
                                }
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
                          {pkg && (
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                              <span>
                                📦 Embalagem: <strong>{pkg.packageName} com {pkg.packageSize} {unit}</strong> ({formatBRL(pkg.packagePrice)})
                              </span>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-[11px] text-primary font-semibold"
                                onClick={() => {
                                  setItems((cur) =>
                                    cur.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            quantity: pkg.packageSize,
                                            unit_cost: calculateUnitCost(pkg.packagePrice, pkg.packageSize),
                                          }
                                        : x
                                    )
                                  );
                                }}
                              >
                                Preencher 1 {pkg.packageName} ({pkg.packageSize}{unit})
                              </Button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <Button type="button" variant="outline" onClick={() => setItems((cur) => [...cur, { product_id: "", quantity: 1, unit_cost: 0 }])}>
                        Adicionar item
                      </Button>
                      <div className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        Total: <span className="font-extrabold">{formatBRL(total)}</span>
                      </div>
                    </div>
                  </div>

                  <Button type="button" variant="hero" onClick={() => createPO.mutate()} disabled={createPO.isPending}>
                    Salvar Pedido
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Editar Pedido de Compra</DialogTitle>
                </DialogHeader>

                {editing && (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Fornecedor</Label>
                        <Select value={editSupplierId} onValueChange={setEditSupplierId} disabled={editStatus === "Cancelado"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(suppliers ?? []).map((s) => {
                              const fornecMatch = s.observations?.match(/\[Fornece:\s*([^\]]+)\]/i);
                              const fornece = fornecMatch ? fornecMatch[1].trim() : null;
                              return (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} {fornece ? `— (${fornece})` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Em Cotação">Em Cotação</SelectItem>
                            <SelectItem value="Aprovado">Aprovado</SelectItem>
                            <SelectItem value="Recebido">Recebido</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        {origStatus === "Recebido" && (
                          <p className="text-xs text-muted-foreground">
                            Alterar itens/quantidades em um pedido Recebido pode afetar o estoque.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Data do pedido</Label>
                        <Input type="date" value={editOrderDate} onChange={(e) => setEditOrderDate(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Entrega prevista</Label>
                        <Input type="date" value={editExpectedDate} onChange={(e) => setEditExpectedDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Observações</Label>
                      <Input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Opcional" />
                    </div>

                    <div className="grid gap-2">
                      <Label>Itens</Label>
                      {editStatus === "Cancelado" && <p className="text-xs text-muted-foreground">Cancelado: itens travados.</p>}
                      <div className="grid gap-2">
                        {editItems.map((it, idx) => {
                          const prod = (raws ?? []).find((p) => p.id === it.product_id);
                          const unit = prod?.unit;
                          const pkg = parsePackageMetadata(prod?.description);
                          const qtyLabel = unit ? `Quantidade (${unit})` : "Quantidade";
                          return (
                          <div key={idx} className="rounded-lg border border-border/40 p-2 space-y-1 bg-muted/10">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-6">
                                <Select
                                  value={it.product_id}
                                  onValueChange={(v) =>
                                    setEditItems((cur) =>
                                      cur.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              product_id: v,
                                              unit_cost:
                                                Number((raws ?? []).find((p) => p.id === v)?.price_cost ?? x.unit_cost ?? 0) || 0,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                  disabled={editStatus === "Cancelado"}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Produto…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(raws ?? []).map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name} <span className="text-muted-foreground">({p.unit})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 grid gap-1">
                                <p className="text-xs text-muted-foreground">{qtyLabel}</p>
                                <Input
                                  type="number"
                                  min={1}
                                  value={it.quantity}
                                  onChange={(e) =>
                                    setEditItems((cur) => cur.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                                  }
                                  disabled={editStatus === "Cancelado"}
                                />
                              </div>
                              <div className="col-span-3 grid gap-1">
                                <p className="text-xs text-muted-foreground">Custo unitário (R$)</p>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.0001}
                                  value={it.unit_cost}
                                  onChange={(e) =>
                                    setEditItems((cur) => cur.map((x, i) => (i === idx ? { ...x, unit_cost: Number(e.target.value) } : x)))
                                  }
                                  disabled={editStatus === "Cancelado"}
                                />
                              </div>
                              <div className="col-span-1 flex items-center justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditItems((cur) => cur.filter((_, i) => i !== idx))}
                                  disabled={editItems.length === 1 || editStatus === "Cancelado"}
                                  aria-label="Remover item"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                            {pkg && editStatus !== "Cancelado" && (
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                <span>
                                  📦 Embalagem: <strong>{pkg.packageName} com {pkg.packageSize} {unit}</strong> ({formatBRL(pkg.packagePrice)})
                                </span>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-[11px] text-primary font-semibold"
                                  onClick={() => {
                                    setEditItems((cur) =>
                                      cur.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              quantity: pkg.packageSize,
                                              unit_cost: calculateUnitCost(pkg.packagePrice, pkg.packageSize),
                                            }
                                          : x
                                      )
                                    );
                                  }}
                                >
                                  Preencher 1 {pkg.packageName} ({pkg.packageSize}{unit})
                                </Button>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditItems((cur) => [...cur, { product_id: "", quantity: 1, unit_cost: 0 }])}
                          disabled={editStatus === "Cancelado"}
                        >
                          Adicionar item
                        </Button>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          Total: <span className="font-extrabold">{formatBRL(editTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <Button type="button" variant="hero" onClick={() => saveEdit.mutate({ confirmedImpact: false })} disabled={saveEdit.isPending}>
                      Salvar alterações
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <AlertDialog open={confirmImpactOpen} onOpenChange={setConfirmImpactOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Atenção: isso afetará o estoque</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você está alterando itens/quantidades de um pedido já <b>Recebido</b>. Isso fará ajustes automáticos no estoque.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => saveEdit.mutate({ confirmedImpact: true })}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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

          {!isLoading && !error && (filtered ?? []).length === 0 && (
            <Card className="glass p-8 text-center">
              <p className="text-base font-semibold">Nenhum pedido ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro pedido para começar.</p>
            </Card>
          )}

          {!isLoading && !error && (filtered ?? []).length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <ScrollArea className="max-h-[70vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filtered ?? []).map((o) => (
                      <TableRow key={o.id} className="odd:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold">{o.suppliers?.name ?? "—"}</TableCell>
                        <TableCell>{statusBadge(o.status)}</TableCell>
                        <TableCell className="text-right font-bold">{formatBRL(Number(o.total_amount ?? 0))}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button type="button" variant="outline" size="icon" aria-label="Editar" onClick={() => void openEditDialog(o)}>
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
                                  <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Se houver vínculos, a exclusão poderá ser bloqueada.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deletePO.mutate(o.id)} disabled={deletePO.isPending}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => receivePO.mutate(o)}
                              disabled={receivePO.isPending || (o.status ?? "") === "Recebido" || (o.status ?? "") === "Cancelado"}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Receber
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => cancelPO.mutate(o)}
                              disabled={cancelPO.isPending || (o.status ?? "") === "Cancelado"}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancelar
                            </Button>
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
    </AppShell>
  );
}
