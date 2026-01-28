import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory, Plus, Search, CheckCircle2 } from "lucide-react";

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

type FinishedProductRow = { id: string; name: string };
type ManufacturingOrderRow = {
  id: string;
  created_at: string | null;
  code: string | null;
  product_id: string | null;
  quantity: number;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  products?: { name: string | null } | null;
};

function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "planejada") return <Badge variant="secondary">Planejada</Badge>;
  if (s === "em produção") return <Badge>Em Produção</Badge>;
  if (s === "finalizada") return <Badge variant="outline">Finalizada</Badge>;
  return <Badge variant="outline">{status ?? "—"}</Badge>;
}

async function fetchMOs(): Promise<ManufacturingOrderRow[]> {
  const { data, error } = await supabase
    .from("manufacturing_orders")
    .select("id,created_at,code,product_id,quantity,status,start_date,end_date,products(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchFinishedProducts(): Promise<FinishedProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name")
    .eq("status", "Ativo")
    .eq("type", "Produto Final")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Producao() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["manufacturing_orders"], queryFn: fetchMOs });
  const { data: finished } = useQuery({ queryKey: ["products", "finished"], queryFn: fetchFinishedProducts });

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState<string>("");
  const [quantity, setQuantity] = React.useState<number>(1);

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((o) => {
      const name = (o.products?.name ?? "").toLowerCase();
      return name.includes(term) || (o.status ?? "").toLowerCase().includes(term) || (o.code ?? "").toLowerCase().includes(term);
    });
  }, [data, q]);

  const createMO = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Selecione o produto final");
      if (!quantity || Number(quantity) <= 0) throw new Error("Quantidade inválida");
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("manufacturing_orders").insert({
        product_id: productId,
        quantity: Number(quantity),
        status: "Planejada",
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Ordem criada");
      setOpen(false);
      setProductId("");
      setQuantity(1);
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar ordem"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      const patch: any = { status: next };
      if (next === "Em Produção") patch.start_date = today;
      if (next === "Finalizada") patch.end_date = today;
      const { error } = await supabase.from("manufacturing_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar status"),
  });

  const finalizeMO = useMutation({
    mutationFn: async (mo: ManufacturingOrderRow) => {
      if (!mo.product_id) throw new Error("Ordem sem produto");
      if ((mo.status ?? "") === "Finalizada") return;

      const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
        p_product_id: mo.product_id,
        p_type: "Entrada",
        p_quantity: Number(mo.quantity ?? 0),
        p_reason: "Produção (Finalização)",
        p_reference_id: mo.id,
      });
      if (mvErr) throw mvErr;

      const today = new Date().toISOString().slice(0, 10);
      const { error: upErr } = await supabase
        .from("manufacturing_orders")
        .update({ status: "Finalizada", end_date: today } as any)
        .eq("id", mo.id);
      if (upErr) throw upErr;
    },
    onSuccess: async () => {
      toast.success("Ordem finalizada e estoque atualizado");
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao finalizar"),
  });

  return (
    <AppShell title="Produção">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Produção</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ordens de fabricação (Planejada → Em Produção → Finalizada).</p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto/status…" className="pl-9" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="hero" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Ordem
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Ordem de Fabricação</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Produto Final</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(finished ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Quantidade planejada</Label>
                    <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                  </div>

                  <Button type="button" variant="hero" onClick={() => createMO.mutate()} disabled={createMO.isPending}>
                    Criar Ordem
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
              <p className="text-base font-semibold">Nenhuma ordem ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie a primeira ordem para começar.</p>
            </Card>
          )}

          {!isLoading && !error && (filtered ?? []).length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <ScrollArea className="max-h-[70vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filtered ?? []).map((o) => (
                      <TableRow key={o.id} className="odd:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.created_at ?? new Date().toISOString()).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold">{o.products?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-bold">{Number(o.quantity ?? 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {statusBadge(o.status)}
                            <Select
                              value={o.status ?? "Planejada"}
                              onValueChange={(v) => updateStatus.mutate({ id: o.id, next: v })}
                              disabled={(o.status ?? "") === "Finalizada" || updateStatus.isPending}
                            >
                              <SelectTrigger className="h-8 w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Planejada">Planejada</SelectItem>
                                <SelectItem value="Em Produção">Em Produção</SelectItem>
                                <SelectItem value="Finalizada">Finalizada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => finalizeMO.mutate(o)}
                            disabled={finalizeMO.isPending || (o.status ?? "") === "Finalizada"}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Finalizar
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
