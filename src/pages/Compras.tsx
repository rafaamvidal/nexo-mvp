import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Search, Truck } from "lucide-react";

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

type SupplierRow = { id: string; name: string };
type ProductRawRow = { id: string; name: string; price_cost: number | null };

type PurchaseOrderRow = {
  id: string;
  created_at: string;
  code: string | null;
  status: string | null;
  total_amount: number | null;
  order_date: string | null;
  suppliers?: { name: string | null } | null;
};

type PurchaseItemDraft = { product_id: string; quantity: number; unit_cost: number };

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

async function fetchPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id,created_at,code,status,total_amount,order_date,suppliers(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers").select("id,name").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchRawMaterials(): Promise<ProductRawRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price_cost")
    .eq("status", "Ativo")
    .eq("type", "Matéria-Prima")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Compras() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["purchase_orders"], queryFn: fetchPurchaseOrders });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers", "lite"], queryFn: fetchSuppliers });
  const { data: raws } = useQuery({ queryKey: ["products", "raw"], queryFn: fetchRawMaterials });

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("Em Cotação");
  const [items, setItems] = React.useState<PurchaseItemDraft[]>([{ product_id: "", quantity: 1, unit_cost: 0 }]);

  const total = React.useMemo(() => {
    return items.reduce((acc, it) => acc + Number(it.quantity ?? 0) * Number(it.unit_cost ?? 0), 0);
  }, [items]);

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
        .insert({ supplier_id: supplierId, status, order_date: orderDate, total_amount: Number(total) } as any)
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
      }));

      const { error: itemsErr } = await supabase.from("purchase_items").insert(payload as any);
      if (itemsErr) throw itemsErr;

      // Integração com financeiro: se já nasce Aprovado/Recebido, cria Pagar.
      const shouldCreatePayable = status === "Aprovado" || status === "Recebido";
      if (shouldCreatePayable) {
        const { error: finErr } = await supabase.from("financial_records").insert({
          type: "Pagar",
          description: `Compra (${status}) - Pedido ${poId.slice(0, 8)}`,
          category: "Compras",
          entity_name: (suppliers ?? []).find((s) => s.id === supplierId)?.name ?? null,
          amount: Number(total),
          due_date: orderDate,
          status: "Aberto",
        } as any);
        if (finErr) throw finErr;
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
        const { error: finErr } = await supabase.from("financial_records").insert({
          type: "Pagar",
          description: `Compra (Recebido) - Pedido ${po.id.slice(0, 8)}`,
          category: "Compras",
          entity_name: po.suppliers?.name ?? null,
          amount,
          due_date: dueDate,
          status: "Aberto",
        } as any);
        if (finErr) throw finErr;
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
                          {(suppliers ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
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
                          <SelectItem value="Em Cotação">Em Cotação</SelectItem>
                          <SelectItem value="Aprovado">Aprovado</SelectItem>
                          <SelectItem value="Recebido">Recebido</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Se criar como Aprovado/Recebido, gera lançamento (Pagar).</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Itens (somente Matéria-prima)</Label>
                    <div className="grid gap-2">
                      {items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2">
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
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) =>
                                setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                              }
                              placeholder="Qtd"
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={it.unit_cost}
                              onChange={(e) =>
                                setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, unit_cost: Number(e.target.value) } : x)))
                              }
                              placeholder="Custo"
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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => receivePO.mutate(o)}
                            disabled={receivePO.isPending || (o.status ?? "") === "Recebido"}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Receber Pedido
                          </Button>
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
