import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  CheckCircle2,
  DollarSign,
  Download,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { endOfMonth, isBefore, isToday, parseISO, startOfDay, startOfMonth } from "date-fns";
import { exportToCsv } from "@/lib/exportCsv";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatBRL } from "@/lib/masks";

type FinRow = {
  id: string;
  due_date: string;
  description: string;
  category: string | null;
  amount: number;
  status: string | null;
  type: string;
  payment_date?: string | null;
  sale_id?: string | null;
  purchase_order_id?: string | null;
};

async function fetchFinancial(): Promise<FinRow[]> {
  const { data, error } = await supabase
    .from("financial_records")
    .select("id,due_date,description,category,amount,status,type,payment_date,sale_id,purchase_order_id")
    .order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Financeiro() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["financial_records"], queryFn: fetchFinancial });

  // Estados de busca e filtros
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [periodFilter, setPeriodFilter] = React.useState<string>("all");

  // Diálogos de criação e edição
  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FinRow | null>(null);

  // Form de criação
  const [type, setType] = React.useState<string>("Receber");
  const [description, setDescription] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [amount, setAmount] = React.useState<number>(0);
  const [dueDate, setDueDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<string>("Aberto");

  // Form de edição
  const [editType, setEditType] = React.useState<string>("Receber");
  const [editDescription, setEditDescription] = React.useState<string>("");
  const [editCategory, setEditCategory] = React.useState<string>("");
  const [editAmount, setEditAmount] = React.useState<number>(0);
  const [editDueDate, setEditDueDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [editStatus, setEditStatus] = React.useState<string>("Aberto");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = startOfDay(new Date());

  // KPIs
  const kpis = React.useMemo(() => {
    const list = data ?? [];
    let aReceber = 0;
    let aPagar = 0;
    let totalPago = 0;
    let totalRecebido = 0;
    let vencidosValor = 0;
    let vencidosQtd = 0;

    for (const r of list) {
      const val = Number(r.amount ?? 0);
      const isRec = (r.type ?? "").toLowerCase() === "receber";
      const isAber = (r.status ?? "").toLowerCase() === "aberto";
      const isPag = (r.status ?? "").toLowerCase() === "pago";

      if (isAber) {
        if (isRec) aReceber += val;
        else aPagar += val;

        // Checar se está vencido
        if (r.due_date < todayStr) {
          vencidosValor += val;
          vencidosQtd += 1;
        }
      } else if (isPag) {
        if (isRec) totalRecebido += val;
        else totalPago += val;
      }
    }

    return {
      aReceber,
      aPagar,
      saldoPrevisto: aReceber - aPagar,
      saldoRealizado: totalRecebido - totalPago,
      vencidosValor,
      vencidosQtd,
    };
  }, [data, todayStr]);

  // Lista filtrada
  const filtered = React.useMemo(() => {
    const list = data ?? [];
    return list.filter((r) => {
      // Busca texto
      const term = q.trim().toLowerCase();
      const matchSearch =
        !term ||
        r.description.toLowerCase().includes(term) ||
        (r.category ?? "").toLowerCase().includes(term);

      // Tipo
      const rType = (r.type ?? "").toLowerCase();
      const matchType =
        typeFilter === "all" ||
        (typeFilter === "receber" && rType === "receber") ||
        (typeFilter === "pagar" && rType === "pagar");

      // Status
      const isAberto = (r.status ?? "").toLowerCase() === "aberto";
      const isPago = (r.status ?? "").toLowerCase() === "pago";
      const isVencido = isAberto && r.due_date < todayStr;

      let matchStatus = true;
      if (statusFilter === "aberto") matchStatus = isAberto && !isVencido;
      else if (statusFilter === "pago") matchStatus = isPago;
      else if (statusFilter === "vencido") matchStatus = isVencido;
      else if (statusFilter === "cancelado") matchStatus = (r.status ?? "").toLowerCase() === "cancelado";

      // Período
      let matchPeriod = true;
      if (periodFilter === "hoje") {
        matchPeriod = r.due_date === todayStr;
      } else if (periodFilter === "mes") {
        const start = startOfMonth(new Date()).toISOString().slice(0, 10);
        const end = endOfMonth(new Date()).toISOString().slice(0, 10);
        matchPeriod = r.due_date >= start && r.due_date <= end;
      } else if (periodFilter === "vencidas") {
        matchPeriod = isVencido;
      }

      return matchSearch && matchType && matchStatus && matchPeriod;
    });
  }, [data, q, statusFilter, typeFilter, periodFilter, todayStr]);

  // Baixa rápida (1 clique)
  const settleMutation = useMutation({
    mutationFn: async (record: FinRow) => {
      const isReceber = (record.type ?? "").toLowerCase() === "receber";
      const { error } = await supabase
        .from("financial_records")
        .update({
          status: "Pago",
          payment_date: todayStr,
        } as any)
        .eq("id", record.id);
      if (error) throw error;
      return isReceber;
    },
    onSuccess: (isReceber) => {
      toast.success(isReceber ? "Recebimento confirmado!" : "Pagamento liquidado com sucesso!");
      qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao liquidar conta"),
  });

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
        payment_date: status === "Pago" ? todayStr : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Lançamento criado com sucesso!");
      setOpen(false);
      setDescription("");
      setCategory("");
      setAmount(0);
      setDueDate(todayStr);
      setStatus("Aberto");
      setType("Receber");
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lançamento"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editDescription.trim()) throw new Error("Informe a descrição");
      if (!editAmount || Number(editAmount) <= 0) throw new Error("Valor inválido");
      const { error } = await supabase
        .from("financial_records")
        .update({
          type: editType,
          description: editDescription.trim(),
          category: editCategory.trim() || null,
          amount: Number(editAmount),
          due_date: editDueDate,
          status: editStatus,
          payment_date: editStatus === "Pago" ? (editing.payment_date ?? todayStr) : null,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Lançamento atualizado");
      setEditOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar lançamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Lançamento excluído");
      await qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Financeiro");
      toast.error(e?.message ?? "Erro ao excluir lançamento");
    },
  });

  const openEditDialog = (r: FinRow) => {
    setEditing(r);
    setEditType(r.type);
    setEditDescription(r.description);
    setEditCategory(r.category ?? "");
    setEditAmount(Number(r.amount ?? 0));
    setEditDueDate(r.due_date);
    setEditStatus(r.status ?? "Aberto");
    setEditOpen(true);
  };

  const renderStatusBadge = (r: FinRow) => {
    const s = (r.status ?? "").toLowerCase();
    const isVencido = s === "aberto" && r.due_date < todayStr;

    if (s === "pago") {
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Pago
        </Badge>
      );
    }
    if (isVencido) {
      return (
        <Badge variant="destructive" className="gap-1 animate-pulse">
          <AlertTriangle className="h-3 w-3" />
          Vencido
        </Badge>
      );
    }
    if (s === "cancelado") {
      return <Badge variant="secondary">Cancelado</Badge>;
    }
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
        Em Aberto
      </Badge>
    );
  };

  const handleExportCsv = () => {
    exportToCsv({
      filename: `financeiro_${todayStr}`,
      headers: ["Vencimento", "Descrição", "Categoria", "Tipo", "Valor (R$)", "Status", "Data Pagamento"],
      rows: filtered.map((r) => [
        r.due_date,
        r.description,
        r.category ?? "",
        r.type,
        r.amount,
        r.status,
        r.payment_date ?? "",
      ]),
    });
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  return (
    <AppShell title="Financeiro">
      <section className="mx-auto max-w-6xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Financeiro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de fluxo de caixa, contas a pagar/receber e liquidação rápida de títulos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="hero" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Tipo de Lançamento</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receber">Conta a Receber (Receita)</SelectItem>
                      <SelectItem value="Pagar">Conta a Pagar (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Descrição *</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Venda de Mercadorias, Energia Elétrica, Aluguel…"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Operacional, Vendas, Fornecedores…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Data de Vencimento *</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valor (R$) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Status Inicial</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberto">Em Aberto</SelectItem>
                      <SelectItem value="Pago">Liquidado (Pago)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="hero"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="w-full mt-2"
                >
                  Salvar Lançamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* CARDS DE INDICADORES (KPIs) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                A Receber (Aberto)
              </CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600">{formatBRL(kpis.aReceber)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Previsão de entradas futuras</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                A Pagar (Aberto)
              </CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-rose-600">{formatBRL(kpis.aPagar)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Compromissos pendentes</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Saldo Previsto
              </CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-xl font-bold ${
                  kpis.saldoPrevisto >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {formatBRL(kpis.saldoPrevisto)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">A Receber − A Pagar</p>
            </CardContent>
          </Card>

          <Card className={`glass border-border/60 ${kpis.vencidosQtd > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Contas Vencidas
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${kpis.vencidosQtd > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${kpis.vencidosQtd > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {formatBRL(kpis.vencidosValor)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {kpis.vencidosQtd} conta(s) pendente(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* BARRA DE FILTROS */}
        <Card className="glass p-3 border border-border/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por descrição ou categoria…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="receber">Receitas</SelectItem>
                  <SelectItem value="pagar">Despesas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="aberto">Em Aberto</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="vencido">Vencidos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="hoje">Vencem Hoje</SelectItem>
                  <SelectItem value="mes">Deste Mês</SelectItem>
                  <SelectItem value="vencidas">Apenas Vencidas</SelectItem>
                </SelectContent>
              </Select>

              {(q || typeFilter !== "all" || statusFilter !== "all" || periodFilter !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setPeriodFilter("all");
                  }}
                  className="h-9 text-xs text-muted-foreground"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* TABELA DE REGISTROS */}
        <div>
          {error && (
            <Card className="glass p-6">
              <p className="text-sm text-destructive">Erro ao carregar: {(error as any)?.message ?? ""}</p>
            </Card>
          )}

          {isLoading && (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <Card className="glass p-12 text-center border-border/60">
              <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-base font-semibold">Nenhum lançamento encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente ajustar os filtros ou cadastre um novo título financeiro.
              </p>
            </Card>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <ScrollArea className="max-h-[65vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Baixa Rápida</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isReceita = (r.type ?? "").toLowerCase() === "receber";
                      const isAberto = (r.status ?? "").toLowerCase() === "aberto";

                      return (
                        <TableRow key={r.id} className="odd:bg-muted/15">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{r.description}</div>
                            {r.payment_date && (
                              <span className="text-[11px] text-muted-foreground">
                                Pago em: {new Date(r.payment_date + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.category ? <Badge variant="secondary">{r.category}</Badge> : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-extrabold ${
                              isReceita ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isReceita ? `+${formatBRL(r.amount)}` : `-${formatBRL(r.amount)}`}
                          </TableCell>
                          <TableCell>{renderStatusBadge(r)}</TableCell>
                          <TableCell className="text-center">
                            {isAberto ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1.5"
                                onClick={() => settleMutation.mutate(r)}
                                disabled={settleMutation.isPending}
                                title={isReceita ? "Confirmar recebimento" : "Confirmar pagamento"}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {isReceita ? "Receber" : "Pagar"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Editar"
                                onClick={() => openEditDialog(r)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    aria-label="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir lançamento financeiro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O título "{r.description}" de {formatBRL(r.amount)} será removido permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(r.id)}
                                      disabled={deleteMutation.isPending}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* DIÁLOGO DE EDIÇÃO */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Lançamento Financeiro</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receber">Conta a Receber (Receita)</SelectItem>
                      <SelectItem value="Pagar">Conta a Pagar (Despesa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Data de Vencimento</Label>
                    <Input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberto">Em Aberto</SelectItem>
                      <SelectItem value="Pago">Liquidado (Pago)</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="hero"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="w-full mt-2"
                >
                  Salvar Alterações
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </section>
    </AppShell>
  );
}
