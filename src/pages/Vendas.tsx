import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

async function fetchSales(): Promise<SaleRow[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("id,created_at,code,status,total_amount,client_id,clients(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase.from("clients").select("id,name").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchProductsForSale(): Promise<ProductRowLite[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price_sale")
    .eq("status", "Ativo")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

type SaleItemDraft = { product_id: string; quantity: number };

export default function Vendas() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["sales"], queryFn: fetchSales });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: products } = useQuery({ queryKey: ["products", "for-sale"], queryFn: fetchProductsForSale });

  const [open, setOpen] = React.useState(false);
  const [clientId, setClientId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("Pedido");
  const [items, setItems] = React.useState<SaleItemDraft[]>([{ product_id: "", quantity: 1 }]);

  const total = React.useMemo(() => {
    const map = new Map((products ?? []).map((p) => [p.id, Number(p.price_sale ?? 0)]));
    return items.reduce((acc, it) => acc + (map.get(it.product_id) ?? 0) * Number(it.quantity ?? 0), 0);
  }, [items, products]);

  const createSale = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente");
      const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
      if (validItems.length === 0) throw new Error("Adicione ao menos 1 item");

      const { data: saleInserted, error: saleErr } = await supabase
        .from("sales")
        .insert({ client_id: clientId, status, total_amount: total, gross_amount: total })
        .select("id")
        .single();
      if (saleErr) throw saleErr;

      const saleId = (saleInserted as any).id as string;

      const map = new Map((products ?? []).map((p) => [p.id, Number(p.price_sale ?? 0)]));
      const saleItemsPayload = validItems.map((it) => {
        const unit = map.get(it.product_id) ?? 0;
        return { sale_id: saleId, product_id: it.product_id, quantity: it.quantity, unit_price: unit, total: unit * it.quantity };
      });

      const { error: itemsErr } = await supabase.from("sale_items").insert(saleItemsPayload as any);
      if (itemsErr) throw itemsErr;

      // Subtrai do estoque ao concretizar (Pedido/Faturado). Para Orçamento, não movimenta.
      const shouldMove = status !== "Orçamento";
      if (shouldMove) {
        for (const it of validItems) {
          const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
            p_product_id: it.product_id,
            p_type: "Saída",
            p_quantity: it.quantity,
            p_reason: "Venda",
            p_reference_id: saleId,
          });
          if (mvErr) throw mvErr;
        }
      }
    },
    onSuccess: async () => {
      toast.success("Venda registrada");
      setOpen(false);
      setClientId("");
      setStatus("Pedido");
      setItems([{ product_id: "", quantity: 1 }]);
      await qc.invalidateQueries({ queryKey: ["sales"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar venda"),
  });

  return (
    <AppShell title="Vendas">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Vendas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Lista de vendas (Orçamento, Pedido, Faturado) e criação rápida.</p>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="hero" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Venda
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Nova Venda</SheetTitle>
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
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Para Orçamento, não movimenta estoque.</p>
                </div>

                <div className="grid gap-2">
                  <Label>Itens</Label>
                  <div className="grid gap-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-8">
                          <Select
                            value={it.product_id}
                            onValueChange={(v) =>
                              setItems((cur) => cur.map((x, i) => (i === idx ? { ...x, product_id: v } : x)))
                            }
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

                <Button type="button" variant="hero" onClick={() => createSale.mutate()} disabled={createSale.isPending}>
                  Salvar Venda
                </Button>
              </div>
            </SheetContent>
          </Sheet>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((s) => (
                    <TableRow key={s.id} className="odd:bg-muted/20">
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-semibold">{s.clients?.name ?? "—"}</TableCell>
                      <TableCell>{s.status ?? "—"}</TableCell>
                      <TableCell className="text-right font-bold">{formatBRL(Number(s.total_amount ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
