import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type FinRow = {
  id: string;
  due_date: string;
  description: string;
  category: string | null;
  amount: number;
  status: string | null;
  type: string;
};

async function fetchFinancial(): Promise<FinRow[]> {
  const { data, error } = await supabase
    .from("financial_records")
    .select("id,due_date,description,category,amount,status,type")
    .order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Financeiro() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["financial_records"], queryFn: fetchFinancial });

  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) => {
      return (
        r.description.toLowerCase().includes(term) ||
        (r.category ?? "").toLowerCase().includes(term) ||
        (r.type ?? "").toLowerCase().includes(term) ||
        (r.status ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, q]);

  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<string>("Receber");
  const [description, setDescription] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [amount, setAmount] = React.useState<number>(0);
  const [dueDate, setDueDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<string>("Aberto");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) throw new Error("Informe a descrição");
      if (!amount || Number(amount) <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("financial_records").insert({
        type,
        description: description.trim(),
        category: category.trim() || null,
        amount: Number(amount),
        due_date: dueDate,
        status,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Lançamento criado");
      setOpen(false);
      setDescription("");
      setCategory("");
      setAmount(0);
      setDueDate(new Date().toISOString().slice(0, 10));
      setStatus("Aberto");
      setType("Receber");
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lançamento"),
  });

  return (
    <AppShell title="Financeiro">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Financeiro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Extrato e lançamentos (Receita/Despesa).</p>
          </div>

          <div className="relative w-full md:w-[360px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar descrição/categoria…" />
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="hero" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Lançamento</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receber">Receita (Receber)</SelectItem>
                      <SelectItem value="Pagar">Despesa (Pagar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mensalidade, Fornecedor…" />
                </div>

                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Opcional" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Data</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valor</Label>
                    <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberto">Aberto</SelectItem>
                      <SelectItem value="Pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" variant="hero" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <p className="text-base font-semibold">Nenhum lançamento ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro lançamento para começar.</p>
            </Card>
          )}

          {!isLoading && !error && (filtered ?? []).length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <ScrollArea className="max-h-[70vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filtered ?? []).map((r) => {
                      const isReceita = (r.type ?? "").toLowerCase() === "receber";
                      return (
                        <TableRow key={r.id} className="odd:bg-muted/20">
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(r.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-semibold">{r.description}</TableCell>
                          <TableCell className="text-muted-foreground">{r.category ?? "—"}</TableCell>
                          <TableCell className={"text-right font-extrabold " + (isReceita ? "text-primary" : "text-destructive")}>
                            {formatBRL(Number(r.amount ?? 0))}
                          </TableCell>
                          <TableCell>{r.status ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
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
