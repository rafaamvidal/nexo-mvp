import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  Layers,
  Pencil,
  PieChart,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { addMonths, endOfMonth, isBefore, isToday, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import { exportToCsv } from "@/lib/exportCsv";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { formatBRL, formatDateBR } from "@/lib/masks";
import { useOrganization } from "@/contexts/OrganizationContext";

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

async function fetchFinancial(orgId?: string): Promise<FinRow[]> {
  let query = supabase
    .from("financial_records")
    .select("id,due_date,description,category,amount,status,type,payment_date,sale_id,purchase_order_id")
    .order("due_date", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

export default function Financeiro() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ["financial_records", currentOrg?.id],
    queryFn: () => fetchFinancial(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  // Estados de busca e filtros
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [periodFilter, setPeriodFilter] = React.useState<string>("mes");
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => new Date().toISOString().slice(0, 7));
  const [customStart, setCustomStart] = React.useState<string>("");
  const [customEnd, setCustomEnd] = React.useState<string>("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  // Diálogos de criação e edição
  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FinRow | null>(null);

  // Form de criação
  const [mainTab, setMainTab] = React.useState<string>("extrato");
  const [entryMode, setEntryMode] = React.useState<"single" | "installment" | "recurring">("single");
  const [installmentCount, setInstallmentCount] = React.useState<number>(4);
  const [recurringCount, setRecurringCount] = React.useState<number>(12);
  const [type, setType] = React.useState<string>("Receber");
  const [description, setDescription] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [amount, setAmount] = React.useState<number>(0);
  const [dueDate, setDueDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentDate, setPaymentDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<string>("Aberto");

  // Form de edição
  const [editType, setEditType] = React.useState<string>("Receber");
  const [editDescription, setEditDescription] = React.useState<string>("");
  const [editCategory, setEditCategory] = React.useState<string>("");
  const [editAmount, setEditAmount] = React.useState<number>(0);
  const [editDueDate, setEditDueDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [editPaymentDate, setEditPaymentDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [editStatus, setEditStatus] = React.useState<string>("Aberto");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = startOfDay(new Date());

  // Definição do intervalo de datas selecionado
  const dateRange = React.useMemo(() => {
    const now = new Date();
    if (periodFilter === "hoje") {
      return { start: todayStr, end: todayStr, label: "Hoje" };
    }
    if (periodFilter === "mes") {
      const s = startOfMonth(now).toISOString().slice(0, 10);
      const e = endOfMonth(now).toISOString().slice(0, 10);
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      return { start: s, end: e, label: `${monthNames[now.getMonth()]}/${now.getFullYear()}` };
    }
    if (periodFilter === "mes_anterior") {
      const prev = subMonths(now, 1);
      const s = startOfMonth(prev).toISOString().slice(0, 10);
      const e = endOfMonth(prev).toISOString().slice(0, 10);
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      return { start: s, end: e, label: `${monthNames[prev.getMonth()]}/${prev.getFullYear()}` };
    }
    if (periodFilter === "mes_especifico") {
      if (!selectedMonth) return { start: null, end: null, label: "Mês Selecionado" };
      const [y, m] = selectedMonth.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      const s = startOfMonth(d).toISOString().slice(0, 10);
      const e = endOfMonth(d).toISOString().slice(0, 10);
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const monthLabel = monthNames[m - 1] ? `${monthNames[m - 1]}/${y}` : selectedMonth;
      return { start: s, end: e, label: monthLabel };
    }
    if (periodFilter === "custom") {
      const label = customStart && customEnd ? `${formatDateBR(customStart)} até ${formatDateBR(customEnd)}` : "Personalizado";
      return { start: customStart || null, end: customEnd || null, label };
    }
    if (periodFilter === "vencidas") {
      return { start: null, end: todayStr, label: "Apenas Vencidas" };
    }
    return { start: null, end: null, label: "Todo o período" };
  }, [periodFilter, selectedMonth, customStart, customEnd, todayStr]);

  // Registros dentro do período selecionado
  const periodRecords = React.useMemo(() => {
    const list = data ?? [];
    return list.filter((r) => {
      if (periodFilter === "vencidas") {
        return (r.status ?? "").toLowerCase() === "aberto" && r.due_date < todayStr;
      }
      if (dateRange.start && r.due_date < dateRange.start) return false;
      if (dateRange.end && r.due_date > dateRange.end) return false;
      return true;
    });
  }, [data, periodFilter, dateRange, todayStr]);

  // Categorias disponíveis no cadastro
  const availableCategories = React.useMemo(() => {
    const list = data ?? [];
    const set = new Set<string>();
    for (const r of list) {
      if (r.category && r.category.trim()) {
        set.add(r.category.trim());
      }
    }
    return Array.from(set).sort();
  }, [data]);

  // KPIs calculados sobre o período ativo
  const kpis = React.useMemo(() => {
    const list = periodRecords;
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
      totalPago,
      totalRecebido,
      saldoPrevisto: aReceber - aPagar,
      saldoRealizado: totalRecebido - totalPago,
      vencidosValor,
      vencidosQtd,
    };
  }, [periodRecords, todayStr]);

  // Agrupamento de Gastos por Categoria (Item 3)
  const categoryExpenses = React.useMemo(() => {
    let totalDespesas = 0;
    const catMap = new Map<string, { total: number; count: number; items: FinRow[] }>();

    for (const r of periodRecords) {
      if ((r.status ?? "").toLowerCase() === "cancelado") continue;
      if ((r.type ?? "").toLowerCase() !== "pagar") continue;

      const val = Number(r.amount ?? 0);
      totalDespesas += val;
      const cat = (r.category ?? "Geral / Sem Categoria").trim();

      const existing = catMap.get(cat) ?? { total: 0, count: 0, items: [] };
      existing.total += val;
      existing.count += 1;
      existing.items.push(r);
      catMap.set(cat, existing);
    }

    const categories = Array.from(catMap.entries())
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        count: stat.count,
        percent: totalDespesas > 0 ? (stat.total / totalDespesas) * 100 : 0,
        items: stat.items,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalDespesas,
      countTotal: categories.reduce((acc, c) => acc + c.count, 0),
      categories,
    };
  }, [periodRecords]);

  // DRE Gerencial sobre o período ativo
  const dre = React.useMemo(() => {
    const list = periodRecords;
    let receitaBruta = 0;
    let custosInsumos = 0;
    let despesasOperacionais = 0;
    const catMap = new Map<string, number>();

    for (const r of list) {
      if ((r.status ?? "").toLowerCase() === "cancelado") continue;
      const val = Number(r.amount ?? 0);
      const isRec = (r.type ?? "").toLowerCase() === "receber";
      const cat = (r.category ?? "Geral").toUpperCase();

      if (isRec) {
        receitaBruta += val;
      } else {
        if (
          cat.includes("MATÉRIA") ||
          cat.includes("MATERIA") ||
          cat.includes("INSUMO") ||
          cat.includes("FORNECEDOR") ||
          cat.includes("PRODUÇÃO")
        ) {
          custosInsumos += val;
        } else {
          despesasOperacionais += val;
        }
        catMap.set(cat, (catMap.get(cat) ?? 0) + val);
      }
    }

    const lucroBruto = receitaBruta - custosInsumos;
    const lucroLiquido = lucroBruto - despesasOperacionais;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      custosInsumos,
      lucroBruto,
      despesasOperacionais,
      lucroLiquido,
      margemLiquida,
      categories: Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [periodRecords]);

  // Fluxo de Caixa Projetado (Próximos 7, 15, 30 e 60 dias)
  const cashflow = React.useMemo(() => {
    const list = data ?? [];
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const d15 = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const d60 = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);

    const calcBucket = (maxDate: string) => {
      let ent = 0;
      let sai = 0;
      for (const r of list) {
        if (
          (r.status ?? "").toLowerCase() === "aberto" &&
          r.due_date >= todayStr &&
          r.due_date <= maxDate
        ) {
          if ((r.type ?? "").toLowerCase() === "receber") ent += Number(r.amount ?? 0);
          else sai += Number(r.amount ?? 0);
        }
      }
      return { entradas: ent, saidas: sai, saldo: ent - sai };
    };

    return {
      d7: calcBucket(d7),
      d15: calcBucket(d15),
      d30: calcBucket(d30),
      d60: calcBucket(d60),
    };
  }, [data, todayStr]);

  // Lista filtrada para o extrato (respeita período, busca, tipo, status e categoria)
  const filtered = React.useMemo(() => {
    return periodRecords.filter((r) => {
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

      // Categoria
      const matchCategory =
        categoryFilter === "all" ||
        (r.category ?? "").trim().toLowerCase() === categoryFilter.trim().toLowerCase();

      // Status
      const isAberto = (r.status ?? "").toLowerCase() === "aberto";
      const isPago = (r.status ?? "").toLowerCase() === "pago";
      const isVencido = isAberto && r.due_date < todayStr;

      let matchStatus = true;
      if (statusFilter === "aberto") matchStatus = isAberto && !isVencido;
      else if (statusFilter === "pago") matchStatus = isPago;
      else if (statusFilter === "vencido") matchStatus = isVencido;
      else if (statusFilter === "cancelado") matchStatus = (r.status ?? "").toLowerCase() === "cancelado";

      return matchSearch && matchType && matchCategory && matchStatus;
    });
  }, [periodRecords, q, typeFilter, categoryFilter, statusFilter, todayStr]);

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

      const rows: any[] = [];
      const baseDate = new Date(`${dueDate}T12:00:00`);

      if (entryMode === "single") {
        rows.push({
          type,
          description: description.trim(),
          category: category.trim() || null,
          amount: Number(amount),
          due_date: dueDate,
          status,
          payment_date: status === "Pago" ? (paymentDate || todayStr) : null,
          organization_id: currentOrg?.id,
          installment_number: 1,
          total_installments: 1,
        });
      } else if (entryMode === "installment") {
        const count = Math.max(2, Math.min(48, Number(installmentCount || 2)));
        const parcelVal = Number((Number(amount) / count).toFixed(2));

        for (let i = 1; i <= count; i++) {
          const pDueDate = addMonths(baseDate, i - 1).toISOString().slice(0, 10);
          rows.push({
            type,
            description: `${description.trim()} (${i}/${count})`,
            category: category.trim() || null,
            amount: parcelVal,
            due_date: pDueDate,
            status: i === 1 && status === "Pago" ? "Pago" : "Aberto",
            payment_date: i === 1 && status === "Pago" ? (paymentDate || todayStr) : null,
            organization_id: currentOrg?.id,
            installment_number: i,
            total_installments: count,
          });
        }
      } else if (entryMode === "recurring") {
        const count = Math.max(2, Math.min(36, Number(recurringCount || 12)));

        for (let i = 1; i <= count; i++) {
          const pDueDate = addMonths(baseDate, i - 1).toISOString().slice(0, 10);
          rows.push({
            type,
            description: `${description.trim()} (${i}/${count})`,
            category: category.trim() || null,
            amount: Number(amount),
            due_date: pDueDate,
            status: i === 1 && status === "Pago" ? "Pago" : "Aberto",
            payment_date: i === 1 && status === "Pago" ? (paymentDate || todayStr) : null,
            organization_id: currentOrg?.id,
            installment_number: i,
            total_installments: count,
          });
        }
      }

      const { error } = await supabase.from("financial_records").insert(rows as any);
      if (error) {
        if (
          error.message?.includes("installment_number") ||
          error.message?.includes("total_installments") ||
          (error as any)?.code === "PGRST204"
        ) {
          const fallbackRows = rows.map(({ installment_number, total_installments, ...rest }) => rest);
          const { error: err2 } = await supabase.from("financial_records").insert(fallbackRows as any);
          if (err2) throw err2;
        } else {
          throw error;
        }
      }
    },
    onSuccess: async () => {
      const msg =
        entryMode === "installment"
          ? `${installmentCount} parcelas geradas com sucesso!`
          : entryMode === "recurring"
          ? `${recurringCount} lançamentos recorrentes gerados!`
          : "Lançamento criado com sucesso!";
      toast.success(msg);
      setOpen(false);
      setDescription("");
      setCategory("");
      setAmount(0);
      setDueDate(todayStr);
      setPaymentDate(todayStr);
      setStatus("Aberto");
      setType("Receber");
      setEntryMode("single");
      setInstallmentCount(4);
      setRecurringCount(12);
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
          payment_date: editStatus === "Pago" ? (editPaymentDate || todayStr) : null,
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
    setEditPaymentDate(r.payment_date ? r.payment_date.slice(0, 10) : todayStr);
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
                    <Label>{entryMode === "installment" ? "Valor Total (R$) *" : "Valor (R$) *"}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Condição de Pagamento / Parcelamento */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Condição de Pagamento
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={entryMode === "single" ? "soft" : "ghost"}
                        onClick={() => setEntryMode("single")}
                        className="h-6 text-[11px] px-2"
                      >
                        Único
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={entryMode === "installment" ? "soft" : "ghost"}
                        onClick={() => setEntryMode("installment")}
                        className="h-6 text-[11px] px-2"
                      >
                        Parcelado
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={entryMode === "recurring" ? "soft" : "ghost"}
                        onClick={() => setEntryMode("recurring")}
                        className="h-6 text-[11px] px-2"
                      >
                        Recorrente
                      </Button>
                    </div>
                  </div>

                  {entryMode === "installment" && (
                    <div className="rounded-md bg-background/80 p-2.5 text-xs space-y-2 border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Quantidade de Parcelas:</span>
                        <Select
                          value={String(installmentCount)}
                          onValueChange={(v) => setInstallmentCount(Number(v))}
                        >
                          <SelectTrigger className="h-7 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Serão geradas <strong>{installmentCount} parcelas mensais</strong> de{" "}
                        <span className="font-semibold text-primary">
                          {formatBRL(amount > 0 ? amount / installmentCount : 0)}
                        </span>{" "}
                        com vencimentos mês a mês.
                      </p>
                    </div>
                  )}

                  {entryMode === "recurring" && (
                    <div className="rounded-md bg-background/80 p-2.5 text-xs space-y-2 border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Repetir por:</span>
                        <Select
                          value={String(recurringCount)}
                          onValueChange={(v) => setRecurringCount(Number(v))}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 6, 12, 24].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n} meses
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Serão gerados <strong>{recurringCount} lançamentos mensais fixos</strong> de{" "}
                        <span className="font-semibold text-primary">{formatBRL(amount)}</span> cada.
                      </p>
                    </div>
                  )}
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

                {status === "Pago" && (
                  <div className="grid gap-2">
                    <Label>Data de Pagamento *</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                )}

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

        {/* BARRA DE FILTRO DE PERÍODO / DATA (Item 4) */}
        <Card className="glass p-3 border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Período Financeiro
                </span>
                <div className="text-sm font-bold flex flex-wrap items-center gap-1.5 text-foreground">
                  <span>{dateRange.label}</span>
                  {dateRange.start && dateRange.end && (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      ({formatDateBR(dateRange.start)} a {formatDateBR(dateRange.end)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Selecionar Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="mes_especifico">Mês Específico</SelectItem>
                  <SelectItem value="custom">Personalizado (Datas)</SelectItem>
                  <SelectItem value="hoje">Vencem Hoje</SelectItem>
                  <SelectItem value="vencidas">Apenas Vencidas</SelectItem>
                  <SelectItem value="all">Todo o Período</SelectItem>
                </SelectContent>
              </Select>

              {periodFilter === "mes_especifico" && (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-[145px] h-9 text-xs bg-background"
                />
              )}

              {periodFilter === "custom" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-[130px] h-9 text-xs bg-background"
                    placeholder="Início"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-[130px] h-9 text-xs bg-background"
                    placeholder="Fim"
                  />
                </div>
              )}

              {periodFilter !== "mes" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPeriodFilter("mes");
                    setSelectedMonth(new Date().toISOString().slice(0, 7));
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="h-9 text-xs text-muted-foreground"
                >
                  Restaurar Mês Atual
                </Button>
              )}
            </div>
          </div>
        </Card>

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

        <Tabs value={mainTab} onValueChange={setMainTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-[620px]">
            <TabsTrigger value="extrato" className="gap-2 text-xs">
              <Wallet className="h-4 w-4" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-2 text-xs">
              <PieChart className="h-4 w-4" />
              Gastos por Categoria
            </TabsTrigger>
            <TabsTrigger value="dre" className="gap-2 text-xs">
              <BarChart3 className="h-4 w-4" />
              DRE Gerencial
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-2 text-xs">
              <TrendingUp className="h-4 w-4" />
              Fluxo Projetado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extrato" className="mt-4 space-y-4">
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

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(q || typeFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setCategoryFilter("all");
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
              <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  ↔️ Arraste para o lado para ver mais informações
                </span>
                <span className="font-semibold">{filtered.length} títulos</span>
              </div>
              <Table containerClassName="max-h-[68vh]" className="min-w-[760px] w-full">
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
                          {formatDateBR(r.due_date)}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{r.description}</div>
                          {r.payment_date && (
                            <span className="text-[11px] text-muted-foreground">
                              Pago em: {formatDateBR(r.payment_date)}
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
            </Card>
          )}
          </div>
        </TabsContent>

        {/* GASTOS POR CATEGORIA (Item 3) */}
        <TabsContent value="categorias" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="glass border-rose-500/20 bg-rose-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total de Despesas no Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  {formatBRL(categoryExpenses.totalDespesas)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryExpenses.countTotal} lançamento(s) de saída
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Maior Centro de Custo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold truncate">
                  {categoryExpenses.categories[0]?.name || "Nenhum"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryExpenses.categories[0]
                    ? `${formatBRL(categoryExpenses.categories[0].total)} (${categoryExpenses.categories[0].percent.toFixed(1)}%)`
                    : "Sem lançamentos no período"}
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total de Categorias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {categoryExpenses.categories.length}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Média de {formatBRL(categoryExpenses.countTotal > 0 ? categoryExpenses.totalDespesas / categoryExpenses.countTotal : 0)} por lançamento
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass p-5 border border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/40 gap-2">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Detalhamento de Gastos por Categoria
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visão agrupada de despesas no período selecionado ({dateRange.label}).
                </p>
              </div>
            </div>

            {categoryExpenses.categories.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum gasto registrado neste período.</p>
                <p className="text-xs mt-1">Ajuste o filtro de período ou registre uma despesa com categoria.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {categoryExpenses.categories.map((cat, idx) => (
                  <div key={cat.name} className="py-4 space-y-2 first:pt-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-sm text-foreground truncate block">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {cat.count} {cat.count === 1 ? "despesa" : "despesas"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-base font-bold text-foreground">{formatBRL(cat.total)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {cat.percent.toFixed(1)}% do total
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCategoryFilter(cat.name);
                            setMainTab("extrato");
                          }}
                          className="h-8 px-2 text-xs gap-1 text-primary hover:text-primary hidden sm:inline-flex"
                          title="Filtrar lançamentos desta categoria"
                        >
                          Ver no extrato
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="relative pt-1">
                      <Progress value={cat.percent} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

          {/* DRE GERENCIAL */}
          <TabsContent value="dre" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="glass border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    (+) Receita Operacional
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-600">
                    {formatBRL(dre.receitaBruta)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Total de vendas e faturamento</p>
                </CardContent>
              </Card>

              <Card className="glass border-rose-500/20 bg-rose-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    (-) Custos / Insumos (CMV)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-600">
                    {formatBRL(dre.custosInsumos)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Matérias-primas e embalagens</p>
                </CardContent>
              </Card>

              <Card className="glass border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    (-) Despesas Operacionais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-amber-600">
                    {formatBRL(dre.despesasOperacionais)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Fixas, administrativas e logística</p>
                </CardContent>
              </Card>

              <Card className={`glass ${dre.lucroLiquido >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    (=) Lucro Líquido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatBRL(dre.lucroLiquido)}
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Margem Líquida: {dre.margemLiquida.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabela Demonstrativa */}
            <Card className="glass p-5 border border-border/60">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Demonstrativo de Resultado do Exercício (Visão Gerencial)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-border/40 font-semibold">
                  <span className="text-foreground">1. Receita Operacional Bruta</span>
                  <span className="text-emerald-600">{formatBRL(dre.receitaBruta)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40 text-muted-foreground pl-4">
                  <span>(-) Custos de Mercadorias e Insumos (CMV)</span>
                  <span className="text-rose-600">({formatBRL(dre.custosInsumos)})</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40 font-medium pl-2 bg-muted/20 px-2 rounded">
                  <span>(=) Lucro Bruto Operacional</span>
                  <span className={dre.lucroBruto >= 0 ? "text-emerald-600" : "text-destructive"}>
                    {formatBRL(dre.lucroBruto)}
                  </span>
                </div>
                <div className="py-2 border-b border-border/40 space-y-1.5 pl-4">
                  <div className="flex justify-between items-center font-medium text-foreground">
                    <span>(-) Despesas Operacionais por Categoria</span>
                    <span className="text-amber-600">({formatBRL(dre.despesasOperacionais)})</span>
                  </div>
                  {dre.categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-2">Nenhuma categoria registrada</p>
                  ) : (
                    dre.categories.map(([cat, val]) => (
                      <div key={cat} className="flex justify-between items-center text-xs text-muted-foreground pl-4">
                        <span>• {cat}</span>
                        <span>{formatBRL(val)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between items-center py-3 border-t-2 border-border font-bold text-base">
                  <span>(=) RESULTADO LÍQUIDO DO PERÍODO</span>
                  <span className={dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-destructive"}>
                    {formatBRL(dre.lucroLiquido)}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* FLUXO PROJETADO */}
          <TabsContent value="fluxo" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Próximos 7 Dias", data: cashflow.d7 },
                { label: "Próximos 15 Dias", data: cashflow.d15 },
                { label: "Próximos 30 Dias", data: cashflow.d30 },
                { label: "Próximos 60 Dias", data: cashflow.d60 },
              ].map((item, idx) => (
                <Card key={idx} className="glass border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600">Entradas:</span>
                      <span className="font-semibold text-emerald-600">+{formatBRL(item.data.entradas)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-rose-600">Saídas:</span>
                      <span className="font-semibold text-rose-600">-{formatBRL(item.data.saidas)}</span>
                    </div>
                    <div className="border-t border-border/40 pt-1.5 flex justify-between text-sm font-bold">
                      <span>Saldo Previsto:</span>
                      <span className={item.data.saldo >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {formatBRL(item.data.saldo)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabela de Previsão de Contas a Vencer */}
            <Card className="glass border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Próximos Títulos a Vencer (Em Aberto)
                </CardTitle>
              </CardHeader>
              <div className="flex sm:hidden items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  ↔️ Arraste para ver colunas
                </span>
              </div>
              <Table containerClassName="max-h-[380px]" className="min-w-[620px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.filter(r => (r.status ?? "").toLowerCase() === "aberto" && r.due_date >= todayStr)
                    .slice(0, 20)
                    .map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.due_date.split("-").reverse().join("/")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.type.toLowerCase() === "receber" ? "border-emerald-500/30 text-emerald-600" : "border-rose-500/30 text-rose-600"}>
                            {r.type.toLowerCase() === "receber" ? "Receber" : "Pagar"}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.category ?? "-"}</TableCell>
                        <TableCell className={`text-right font-semibold ${r.type.toLowerCase() === "receber" ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatBRL(r.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

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

                {editStatus === "Pago" && (
                  <div className="grid gap-2">
                    <Label>Data de Pagamento *</Label>
                    <Input
                      type="date"
                      value={editPaymentDate}
                      onChange={(e) => setEditPaymentDate(e.target.value)}
                    />
                  </div>
                )}

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
