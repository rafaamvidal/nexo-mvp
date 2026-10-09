import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Download, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exportToCsv } from "@/lib/exportCsv";
import { getProductBom } from "@/lib/bom";
import { BomManagerDialog } from "@/components/production/BomManagerDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  if (s === "cancelada") return <Badge variant="destructive">Cancelada</Badge>;
  return <Badge variant="outline">{status ?? "—"}</Badge>;
}

async function fetchMOs(orgId?: string): Promise<ManufacturingOrderRow[]> {
  let query = supabase
    .from("manufacturing_orders")
    .select("id,created_at,code,product_id,quantity,status,start_date,end_date,products(name)")
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchFinishedProducts(orgId?: string): Promise<FinishedProductRow[]> {
  let query = supabase
    .from("products")
    .select("id,name")
    .eq("status", "Ativo")
    .eq("type", "Produto Final")
    .order("name", { ascending: true });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Producao() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["manufacturing_orders", currentOrg?.id],
    queryFn: () => fetchMOs(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const { data: finished } = useQuery({
    queryKey: ["products", "finished", currentOrg?.id],
    queryFn: () => fetchFinishedProducts(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState<string>("");
  const [quantity, setQuantity] = React.useState<number>(1);
  const [createDirectFinalized, setCreateDirectFinalized] = React.useState<boolean>(false);
  const [createSkipBom, setCreateSkipBom] = React.useState<boolean>(false);

  const [finalizeTarget, setFinalizeTarget] = React.useState<ManufacturingOrderRow | null>(null);
  const [finalizeSkipBom, setFinalizeSkipBom] = React.useState<boolean>(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ManufacturingOrderRow | null>(null);
  const [editProductId, setEditProductId] = React.useState<string>("");
  const [editQty, setEditQty] = React.useState<number>(1);

  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((o) => {
      const name = (o.products?.name ?? "").toLowerCase();
      return name.includes(term) || (o.status ?? "").toLowerCase().includes(term) || (o.code ?? "").toLowerCase().includes(term);
    });
  }, [data, q]);

  const handleExportCsv = () => {
    if (!filtered || filtered.length === 0) {
      toast.error("Nenhuma ordem para exportar");
      return;
    }
    const exportData = filtered.map((o) => ({
      Codigo: o.code ?? (o.id ? o.id.slice(0, 8) : "—"),
      Produto: o.products?.name ?? "—",
      Quantidade: o.quantity,
      Status: o.status ?? "—",
      Data_Inicio: o.start_date ?? "—",
      Data_Termino: o.end_date ?? "—",
      Criado_Em: o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—",
    }));
    exportToCsv("ordens-de-fabricacao", exportData);
    toast.success("Ordens de fabricação exportadas!");
  };

  const createMO = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Selecione o produto final");
      if (!quantity || Number(quantity) <= 0) throw new Error("Quantidade inválida");

      const today = new Date().toISOString().slice(0, 10);
      const isFin = createDirectFinalized;
      const orderQty = Number(quantity);

      const { data: newMo, error } = await supabase
        .from("manufacturing_orders")
        .insert({
          product_id: productId,
          quantity: orderQty,
          status: isFin ? "Finalizada" : "Planejada",
          start_date: isFin ? today : null,
          end_date: isFin ? today : null,
          created_at: new Date().toISOString(),
          organization_id: currentOrg?.id,
        } as any)
        .select("id,code")
        .single();
      if (error) throw error;

      if (isFin && newMo) {
        const codeOrId = (newMo as any).code ?? (newMo as any).id.slice(0, 8);

        // 1. Entrada no produto final fabricado
        const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
          p_product_id: productId,
          p_type: "Entrada",
          p_quantity: orderQty,
          p_reason: createSkipBom
            ? `Produção Concluída (Sem baixa de insumos) (OF #${codeOrId})`
            : `Produção Finalizada (OF #${codeOrId})`,
          p_reference_id: (newMo as any).id,
        });
        if (mvErr) throw mvErr;

        // 2. Saída dos insumos (se não marcado para pular)
        if (!createSkipBom) {
          const bom = await getProductBom(productId);
          for (const item of bom) {
            if (item.rawMaterialId && item.quantityPerUnit > 0) {
              const consumedQty = Number(item.quantityPerUnit) * orderQty;
              await (supabase as any).rpc("apply_movement", {
                p_product_id: item.rawMaterialId,
                p_type: "Saída",
                p_quantity: consumedQty,
                p_reason: `Consumo Matéria-Prima (OF #${codeOrId})`,
                p_reference_id: (newMo as any).id,
              });
            }
          }
        }
      }
    },
    onSuccess: async () => {
      toast.success(
        createDirectFinalized
          ? createSkipBom
            ? "Produção finalizada! Produto adicionado ao estoque sem descontar insumos."
            : "Produção finalizada e estoque atualizado com sucesso!"
          : "Ordem de fabricação planejada com sucesso"
      );
      setOpen(false);
      setProductId("");
      setQuantity(1);
      setCreateDirectFinalized(false);
      setCreateSkipBom(false);
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stock_movements"] });
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
    mutationFn: async ({ mo, skipBom }: { mo: ManufacturingOrderRow; skipBom: boolean }) => {
      if (!mo.product_id) throw new Error("Ordem sem produto");
      if ((mo.status ?? "") === "Finalizada") return;

      const orderQty = Number(mo.quantity ?? 0);
      const codeOrId = mo.code ?? mo.id.slice(0, 8);

      // 1. Dá entrada no produto final fabricado
      const { error: mvErr } = await (supabase as any).rpc("apply_movement", {
        p_product_id: mo.product_id,
        p_type: "Entrada",
        p_quantity: orderQty,
        p_reason: skipBom
          ? `Produção Finalizada (Sem baixa de insumos) (OF #${codeOrId})`
          : `Produção Finalizada (OF #${codeOrId})`,
        p_reference_id: mo.id,
      });
      if (mvErr) throw mvErr;

      // 2. Dá saída nas matérias-primas cadastradas na Ficha Técnica (BOM) apenas se NÃO for skipBom
      if (!skipBom) {
        const bom = await getProductBom(mo.product_id);
        for (const item of bom) {
          if (item.rawMaterialId && item.quantityPerUnit > 0) {
            const consumedQty = Number(item.quantityPerUnit) * orderQty;
            const { error: rawErr } = await (supabase as any).rpc("apply_movement", {
              p_product_id: item.rawMaterialId,
              p_type: "Saída",
              p_quantity: consumedQty,
              p_reason: `Consumo Matéria-Prima (OF #${codeOrId})`,
              p_reference_id: mo.id,
            });
            if (rawErr) {
              console.warn("Aviso ao baixar insumo:", rawErr);
            }
          }
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const { error: upErr } = await supabase
        .from("manufacturing_orders")
        .update({ status: "Finalizada", end_date: today } as any)
        .eq("id", mo.id);
      if (upErr) throw upErr;
    },
    onSuccess: async (_, vars) => {
      toast.success(
        vars.skipBom
          ? "Ordem finalizada: produto adicionado ao estoque sem descontar insumos!"
          : "Ordem finalizada: produto gerado e insumos baixados com sucesso!"
      );
      setFinalizeTarget(null);
      setFinalizeSkipBom(false);
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stock_movements"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao finalizar ordem"),
  });

  const cancelMO = useMutation({
    mutationFn: async (mo: ManufacturingOrderRow) => {
      const prev = mo.status ?? "";
      if (prev === "Cancelada") return;
      if (!mo.product_id) throw new Error("Ordem sem produto");

      // Se já finalizada, estorna o produto final (Saída) e estorna matérias-primas (Entrada)
      if (prev === "Finalizada") {
        const orderQty = Number(mo.quantity ?? 0);
        const codeOrId = mo.code ?? mo.id.slice(0, 8);

        await (supabase as any).rpc("apply_movement", {
          p_product_id: mo.product_id,
          p_type: "Saída",
          p_quantity: orderQty,
          p_reason: `Estorno Produção (Cancelamento OF #${codeOrId})`,
          p_reference_id: mo.id,
        });

        const bom = await getProductBom(mo.product_id);
        for (const item of bom) {
          if (item.rawMaterialId && item.quantityPerUnit > 0) {
            await (supabase as any).rpc("apply_movement", {
              p_product_id: item.rawMaterialId,
              p_type: "Entrada",
              p_quantity: Number(item.quantityPerUnit) * orderQty,
              p_reason: `Estorno Insumo (Cancelamento OF #${codeOrId})`,
              p_reference_id: mo.id,
            });
          }
        }
      }

      const { error: upErr } = await supabase.from("manufacturing_orders").update({ status: "Cancelada" } as any).eq("id", mo.id);
      if (upErr) throw upErr;
    },
    onSuccess: async () => {
      toast.success("Ordem cancelada e estoque estornado");
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stock_movements"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const deleteMO = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manufacturing_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Ordem excluída");
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Produção/Estoque");
      toast.error(e?.message ?? "Erro ao excluir");
    },
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if ((editing.status ?? "") !== "Planejada") throw new Error("Apenas ordens Planejadas podem ser editadas neste MVP");
      if (!editProductId) throw new Error("Selecione o produto final");
      if (!editQty || Number(editQty) <= 0) throw new Error("Quantidade inválida");
      const { error } = await supabase
        .from("manufacturing_orders")
        .update({ product_id: editProductId, quantity: Number(editQty) } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Ordem atualizada");
      setEditOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar alterações"),
  });

  const openEditDialog = (mo: ManufacturingOrderRow) => {
    setEditing(mo);
    setEditProductId(mo.product_id ?? "");
    setEditQty(Number(mo.quantity ?? 1));
    setEditOpen(true);
  };

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

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 sm:flex-none"
                onClick={handleExportCsv}
                disabled={!filtered || filtered.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>

              <BomManagerDialog />

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="hero" className="w-full gap-2 sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Nova Ordem
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-lg sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="truncate pr-6 text-left leading-snug">Nova Ordem de Fabricação</DialogTitle>
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

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center space-x-2.5">
                        <Checkbox
                          id="direct-finalize"
                          checked={createDirectFinalized}
                          onCheckedChange={(c) => {
                            setCreateDirectFinalized(Boolean(c));
                            if (!c) setCreateSkipBom(false);
                          }}
                        />
                        <label
                          htmlFor="direct-finalize"
                          className="text-xs font-semibold leading-none cursor-pointer text-foreground"
                        >
                          Marcar como já finalizada (Dar entrada imediata no estoque)
                        </label>
                      </div>

                      {createDirectFinalized && (
                        <div className="pl-6 pt-1 space-y-1.5 border-t border-border/40">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="create-skip-bom"
                              checked={createSkipBom}
                              onCheckedChange={(c) => setCreateSkipBom(Boolean(c))}
                            />
                            <label
                              htmlFor="create-skip-bom"
                              className="text-xs font-semibold leading-none cursor-pointer text-amber-600 dark:text-amber-400"
                            >
                              Não descontar insumos da Ficha Técnica (ingredientes consumidos anteriormente)
                            </label>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Ideal para produções desta semana feitas com matérias-primas que não foram lançadas no sistema.
                          </p>
                        </div>
                      )}
                    </div>

                    <Button type="button" variant="hero" onClick={() => createMO.mutate()} disabled={createMO.isPending}>
                      {createDirectFinalized ? "Criar e Finalizar Produção" : "Criar Ordem"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-lg sm:p-6">
                <DialogHeader>
                  <DialogTitle className="truncate pr-6 text-left leading-snug">Editar Ordem</DialogTitle>
                </DialogHeader>
                {editing && (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Produto Final</Label>
                      <Select value={editProductId} onValueChange={setEditProductId} disabled={(editing.status ?? "") !== "Planejada"}>
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
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} disabled={(editing.status ?? "") !== "Planejada"} />
                    </div>
                    <Button type="button" variant="hero" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                      Salvar alterações
                    </Button>
                  </div>
                )}
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
              <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  ↔️ Arraste para o lado para alterar status e ações
                </span>
                <span className="font-semibold">{(filtered ?? []).length} ordens</span>
              </div>
              <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[820px] w-full">
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
                            onValueChange={(v) => {
                              if (v === "Finalizada") {
                                setFinalizeTarget(o);
                                setFinalizeSkipBom(false);
                              } else {
                                updateStatus.mutate({ id: o.id, next: v });
                              }
                            }}
                            disabled={(o.status ?? "") === "Finalizada" || (o.status ?? "") === "Cancelada" || updateStatus.isPending}
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
                        <div className="inline-flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" aria-label="Editar" onClick={() => openEditDialog(o)}>
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
                                <AlertDialogTitle>Excluir ordem?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Se houver vínculos, a exclusão poderá ser bloqueada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMO.mutate(o.id)} disabled={deleteMO.isPending}>
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
                            onClick={() => {
                              setFinalizeTarget(o);
                              setFinalizeSkipBom(false);
                            }}
                            disabled={finalizeMO.isPending || (o.status ?? "") === "Finalizada" || (o.status ?? "") === "Cancelada"}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Finalizar
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => cancelMO.mutate(o)}
                            disabled={cancelMO.isPending || (o.status ?? "") === "Cancelada"}
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
            </Card>
          )}
        </div>

        {/* Modal de confirmação para finalizar ordem com opção de pular baixa de insumos */}
        <Dialog open={Boolean(finalizeTarget)} onOpenChange={(open) => { if (!open) setFinalizeTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Finalizar Ordem de Produção
              </DialogTitle>
            </DialogHeader>
            {finalizeTarget && (
              <div className="space-y-4 py-2">
                <p className="text-sm text-foreground">
                  Confirmar a conclusão da fabricação de{" "}
                  <strong>
                    {finalizeTarget.quantity} un. de {finalizeTarget.products?.name ?? "Produto"}
                  </strong>
                  ?
                </p>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center space-x-2.5">
                    <Checkbox
                      id="finalize-skip-bom"
                      checked={finalizeSkipBom}
                      onCheckedChange={(c) => setFinalizeSkipBom(Boolean(c))}
                    />
                    <label
                      htmlFor="finalize-skip-bom"
                      className="text-xs font-semibold leading-none cursor-pointer text-foreground"
                    >
                      Não descontar insumos da Ficha Técnica (ingredientes consumidos anteriormente)
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                    Marque esta opção para produções feitas com matérias-primas que não foram lançadas no estoque ou para produções desta semana antes do controle de estoque.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setFinalizeTarget(null)}
                    disabled={finalizeMO.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="hero"
                    onClick={() => {
                      if (finalizeTarget) {
                        finalizeMO.mutate({ mo: finalizeTarget, skipBom: finalizeSkipBom });
                      }
                    }}
                    disabled={finalizeMO.isPending}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar e Finalizar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </section>
    </AppShell>
  );
}
