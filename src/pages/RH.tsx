import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Palmtree,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { exportToCsv } from "@/lib/exportCsv";
import { formatBRL, formatDateBR } from "@/lib/masks";
import { useOrganization } from "@/contexts/OrganizationContext";
import { EmployeeDialog } from "@/components/rh/EmployeeDialog";
import { VacationDialog } from "@/components/rh/VacationDialog";
import { OccurrenceDialog } from "@/components/rh/OccurrenceDialog";
import { PayrollAlertCard } from "@/components/rh/PayrollAlertCard";
import {
  fetchEmployees,
  upsertEmployee,
  deleteEmployee,
  fetchVacations,
  upsertVacation,
  deleteVacation,
  calculateVacationPeriod,
  fetchOccurrences,
  upsertOccurrence,
  deleteOccurrence,
  launchPayrollToFinancial,
  seedSampleEmployees,
} from "@/lib/rhStorage";
import type { Employee, EmployeeVacation, EmployeeOccurrence, EmployeeStatus } from "@/types/rh";

export default function RH() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const [activeTab, setActiveTab] = React.useState("colaboradores");
  const [q, setQ] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("Todos");
  const [statusFilter, setStatusFilter] = React.useState("Todos");
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);
  const [editEmployeeOpen, setEditEmployeeOpen] = React.useState(false);
  const [referenceMonth, setReferenceMonth] = React.useState(format(new Date(), "yyyy-MM"));

  // 1. CARREGAMENTO DE DADOS
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", orgId],
    queryFn: () => fetchEmployees(orgId),
    enabled: Boolean(orgId),
  });

  const { data: vacations = [], isLoading: loadingVacations } = useQuery({
    queryKey: ["employee_vacations", orgId],
    queryFn: () => fetchVacations(orgId),
    enabled: Boolean(orgId),
  });

  const { data: occurrences = [], isLoading: loadingOccurrences } = useQuery({
    queryKey: ["employee_occurrences", orgId],
    queryFn: () => fetchOccurrences(orgId),
    enabled: Boolean(orgId),
  });

  // 2. MUTATIONS
  const saveEmployeeMutation = useMutation({
    mutationFn: async (payload: Partial<Employee>) => {
      if (!orgId) throw new Error("Selecione uma empresa ativa.");
      return await upsertEmployee(payload, orgId);
    },
    onSuccess: () => {
      toast.success(editingEmployee ? "Colaborador atualizado!" : "Colaborador cadastrado!");
      setEditingEmployee(null);
      setEditEmployeeOpen(false);
      qc.invalidateQueries({ queryKey: ["employees", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar colaborador"),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) return;
      await deleteEmployee(id, orgId);
    },
    onSuccess: () => {
      toast.success("Colaborador removido");
      qc.invalidateQueries({ queryKey: ["employees", orgId] });
      qc.invalidateQueries({ queryKey: ["employee_vacations", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao remover"),
  });

  const saveVacationMutation = useMutation({
    mutationFn: async (payload: Partial<EmployeeVacation>) => {
      if (!orgId) throw new Error("Selecione uma empresa ativa.");
      return await upsertVacation(payload, orgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee_vacations", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao registrar férias"),
  });

  const deleteVacationMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) return;
      await deleteVacation(id, orgId);
    },
    onSuccess: () => {
      toast.success("Período de férias removido");
      qc.invalidateQueries({ queryKey: ["employee_vacations", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao remover férias"),
  });

  const saveOccurrenceMutation = useMutation({
    mutationFn: async (payload: Partial<EmployeeOccurrence>) => {
      if (!orgId) throw new Error("Selecione uma empresa ativa.");
      return await upsertOccurrence(payload, orgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee_occurrences", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao registrar ocorrência"),
  });

  const deleteOccurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) return;
      await deleteOccurrence(id, orgId);
    },
    onSuccess: () => {
      toast.success("Ocorrência excluída");
      qc.invalidateQueries({ queryKey: ["employee_occurrences", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao remover ocorrência"),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Selecione uma empresa ativa.");
      return await seedSampleEmployees(orgId);
    },
    onSuccess: () => {
      toast.success("Equipe inicial carregada com sucesso!");
      qc.invalidateQueries({ queryKey: ["employees", orgId] });
      qc.invalidateQueries({ queryKey: ["employee_vacations", orgId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao carregar exemplos"),
  });

  const payrollMutation = useMutation({
    mutationFn: async (launchType: "vale_40" | "saldo_60" | "all" = "all") => {
      if (!orgId) throw new Error("Selecione uma empresa ativa.");
      return await launchPayrollToFinancial(employees, referenceMonth, orgId, launchType);
    },
    onSuccess: (res) => {
      const label =
        res.type === "vale_40"
          ? "Vale de 40% (Dia 20)"
          : res.type === "saldo_60"
          ? "Saldo de 60% (Dia 05)"
          : "Folha completa";
      toast.success(
        `${label} lançada! ${res.count} pagamentos gerados no Financeiro totalizando ${formatBRL(res.total)}.`
      );
      qc.invalidateQueries({ queryKey: ["financial_records"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao lançar folha"),
  });

  // 3. FILTROS & CÁLCULOS
  const filteredEmployees = React.useMemo(() => {
    let list = employees;
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.role.toLowerCase().includes(term) ||
          e.department.toLowerCase().includes(term) ||
          (e.cpf ?? "").includes(term)
      );
    }
    if (deptFilter !== "Todos") {
      list = list.filter((e) => e.department === deptFilter);
    }
    if (statusFilter !== "Todos") {
      list = list.filter((e) => e.status === statusFilter);
    }
    return list;
  }, [employees, q, deptFilter, statusFilter]);

  // Indicadores
  const activeEmployees = React.useMemo(() => {
    return employees.filter((e) => e.status === "Ativo" || e.status === "Em Férias");
  }, [employees]);

  const totalPayrollCost = React.useMemo(() => {
    return activeEmployees.reduce(
      (sum, e) => sum + Number(e.base_salary || 0) + Number(e.benefits_total || 0),
      0
    );
  }, [activeEmployees]);

  const onVacationCount = React.useMemo(() => {
    return employees.filter((e) => e.status === "Em Férias").length;
  }, [employees]);

  // Análise de períodos de férias por colaborador
  const employeeVacationPeriods = React.useMemo(() => {
    return activeEmployees.map((emp) => {
      const empVacations = vacations.filter((v) => v.employee_id === emp.id);
      const info = calculateVacationPeriod(emp.admission_date, empVacations);
      return {
        employee: emp,
        info,
      };
    });
  }, [activeEmployees, vacations]);

  const overdueVacationsCount = React.useMemo(() => {
    return employeeVacationPeriods.filter((p) => p.info.isOverdue || p.info.isNearOverdue).length;
  }, [employeeVacationPeriods]);

  // Exportação CSV
  const handleExportCsv = () => {
    if (employees.length === 0) {
      toast.error("Nenhum colaborador para exportar.");
      return;
    }
    const headers = [
      "Nome",
      "Cargo",
      "Setor",
      "Regime",
      "Admissão",
      "Status",
      "Salário Base (R$)",
      "Benefícios (R$)",
      "Custo Total (R$)",
      "Chave Pix",
      "Telefone",
      "E-mail",
    ];
    const rows = employees.map((e) => [
      e.name,
      e.role,
      e.department,
      e.contract_type,
      formatDateBR(e.admission_date),
      e.status,
      Number(e.base_salary || 0),
      Number(e.benefits_total || 0),
      Number(e.base_salary || 0) + Number(e.benefits_total || 0),
      e.pix_key || "—",
      e.phone || "—",
      e.email || "—",
    ]);

    exportToCsv({
      filename: `colaboradores_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows,
    });
    toast.success("Lista de colaboradores exportada com sucesso!");
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditEmployeeOpen(true);
  };

  return (
    <AppShell title="Recursos Humanos">
      <section className="mx-auto max-w-6xl space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold sm:text-3xl">
              Recursos Humanos & Departamento Pessoal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de colaboradores, controle inteligente de férias, folha salarial e ocorrências.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={employees.length === 0}
              className="flex-1 gap-2 sm:flex-none"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>

            {employees.length === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/10 sm:flex-none"
              >
                <Sparkles className="h-4 w-4" />
                {seedMutation.isPending ? "Carregando..." : "Carregar Equipe Exemplo"}
              </Button>
            )}

            <VacationDialog
              employees={activeEmployees}
              onSave={async (v) => {
                await saveVacationMutation.mutateAsync(v);
              }}
            />

            <OccurrenceDialog
              employees={activeEmployees}
              onSave={async (o) => {
                await saveOccurrenceMutation.mutateAsync(o);
              }}
            />

            <EmployeeDialog
              onSave={async (emp) => {
                await saveEmployeeMutation.mutateAsync(emp);
              }}
            />
          </div>
        </header>

        {/* CARDS DE INDICADORES / KPIS */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Colaboradores Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{activeEmployees.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {employees.filter((e) => e.contract_type === "CLT").length} CLT •{" "}
                {employees.filter((e) => e.contract_type === "PJ").length} PJ
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Custo da Folha Mensal
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatBRL(totalPayrollCost)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Salários base + benefícios</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Em Férias Agora
              </CardTitle>
              <Palmtree className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {onVacationCount}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Colaboradores ausentes no mês</p>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                Alerta de Férias
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {overdueVacationsCount}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {overdueVacationsCount > 0 ? "Férias vencendo em < 60 dias" : "Períodos em dia"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ABAS DO MÓDULO */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:w-[560px] sm:grid-cols-4">
            <TabsTrigger value="colaboradores" className="gap-2 py-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              Colaboradores
            </TabsTrigger>
            <TabsTrigger value="ferias" className="gap-2 py-2 text-xs">
              <Palmtree className="h-3.5 w-3.5" />
              Férias
              {overdueVacationsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {overdueVacationsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="folha" className="gap-2 py-2 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              Folha & Salários
            </TabsTrigger>
            <TabsTrigger value="ocorrencias" className="gap-2 py-2 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Ocorrências
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* ABA 1: COLABORADORES                                        */}
          {/* ============================================================ */}
          <TabsContent value="colaboradores" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar colaborador, cargo, setor…"
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Setor:</span>
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    aria-label="Filtrar por setor"
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Produção">Produção</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Logística">Logística</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                    className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Em Férias">Em Férias</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Desligado">Desligado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* VISÃO MOBILE: CARDS NATIVOS DE COLABORADORES */}
            <div className="grid grid-cols-1 gap-2.5 sm:hidden">
              {loadingEmployees ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))
              ) : filteredEmployees.length === 0 ? (
                <Card className="glass p-6 text-center text-sm text-muted-foreground">
                  Nenhum colaborador encontrado. Clique em "Novo Colaborador" para cadastrar.
                </Card>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm active:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm leading-tight text-foreground truncate">
                          {emp.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{emp.role}</span>
                          {emp.department && <span>• {emp.department}</span>}
                          {emp.contract_type && <Badge variant="secondary" className="text-[10px] px-1 py-0">{emp.contract_type}</Badge>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditEmployee(emp)}
                          title="Editar Colaborador"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive/80 hover:text-destructive"
                              title="Excluir Colaborador"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja realmente remover o registro de <strong>{emp.name}</strong>?
                                Esta ação não poderá ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                      <div>
                        {emp.status === "Ativo" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                            Ativo
                          </Badge>
                        ) : emp.status === "Em Férias" ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0">
                            Em Férias
                          </Badge>
                        ) : emp.status === "Afastado" ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Afastado</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Desligado</Badge>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground mr-1.5">Salário:</span>
                        <span className="font-bold text-foreground">
                          {formatBRL(Number(emp.base_salary || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* VISÃO DESKTOP: TABELA COMPLETA */}
            <Card className="glass hidden sm:block overflow-hidden border-border/60">
              <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cargo / Função</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Regime</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Salário Base</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmployees ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-9 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum colaborador encontrado. Clique em "Novo Colaborador" para cadastrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">
                          <div>
                            <span>{emp.name}</span>
                            {emp.phone && (
                              <p className="text-xs text-muted-foreground">{emp.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{emp.role}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{emp.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{emp.contract_type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateBR(emp.admission_date)}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {formatBRL(Number(emp.base_salary || 0))}
                        </TableCell>
                        <TableCell>
                          {emp.status === "Ativo" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              Ativo
                            </Badge>
                          ) : emp.status === "Em Férias" ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              Em Férias
                            </Badge>
                          ) : emp.status === "Afastado" ? (
                            <Badge variant="secondary">Afastado</Badge>
                          ) : (
                            <Badge variant="destructive">Desligado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditEmployee(emp)}
                              title="Editar Colaborador"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10"
                                  title="Excluir Colaborador"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deseja realmente remover o registro de <strong>{emp.name}</strong>?
                                    Esta ação não poderá ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 2: CONTROLE DE FÉRIAS                                    */}
          {/* ============================================================ */}
          <TabsContent value="ferias" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Painel de Alerta & Situação de Períodos */}
              <Card className="glass border-border/60 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Palmtree className="h-4 w-4 text-primary" />
                    <span>Períodos Aquisitivos (CLT)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    A cada 12 meses de trabalho, o colaborador adquire direito a 30 dias de descanso.
                    O gozo deve ocorrer antes do fim do período concessivo (11 meses subsequentes).
                  </p>

                  <div className="space-y-3 pt-2">
                    {employeeVacationPeriods.map(({ employee, info }) => (
                      <div
                        key={employee.id}
                        className={`rounded-lg border p-2.5 text-xs ${
                          info.isOverdue
                            ? "border-destructive/40 bg-destructive/5"
                            : info.isNearOverdue
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-border/60 bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{employee.name}</span>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {info.daysRemaining} dias rest.
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Limite p/ gozo:</span>
                          <span className="font-medium text-foreground">
                            {formatDateBR(info.concessionLimit)}
                          </span>
                        </div>
                        {info.isOverdue && (
                          <span className="mt-1 block font-bold text-destructive">
                            ⚠️ Férias Vencidas (Risco de Multa/Dobra)
                          </span>
                        )}
                        {info.isNearOverdue && (
                          <span className="mt-1 block font-semibold text-amber-600 dark:text-amber-400">
                            ⏳ Vence nos próximos 60 dias
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tabela de Férias Agendadas e Concluídas */}
              <Card className="glass overflow-hidden border-border/60 lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-bold">Agendamentos de Férias</CardTitle>
                  <VacationDialog
                    employees={activeEmployees}
                    onSave={async (v) => {
                      await saveVacationMutation.mutateAsync(v);
                    }}
                  />
                </CardHeader>
                <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    ↔️ Arraste para o lado para ver período e ações
                  </span>
                  <span className="font-semibold">{vacations.length} agendamentos</span>
                </div>
                <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[680px] w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Período de Gozo</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Abono (Venda)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingVacations ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : vacations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Nenhum agendamento de férias registrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      vacations.map((vac) => (
                        <TableRow key={vac.id}>
                          <TableCell className="font-semibold">
                            {vac.employee_name || "Colaborador"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDateBR(vac.start_date)} até{" "}
                            {formatDateBR(vac.end_date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{vac.days} dias</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {vac.sell_days ? `${vac.sell_days} dias vendidos` : "Não"}
                            {vac.advance_13th && " • 13º Adiant."}
                          </TableCell>
                          <TableCell>
                            {vac.status === "Agendada" ? (
                              <Badge variant="secondary">Agendada</Badge>
                            ) : vac.status === "Em Gozo" ? (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                Em Gozo
                              </Badge>
                            ) : vac.status === "Concluída" ? (
                              <Badge variant="outline">Concluída</Badge>
                            ) : (
                              <Badge variant="destructive">Cancelada</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteVacationMutation.mutate(vac.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 3: FOLHA DE PAGAMENTO & BENEFÍCIOS                       */}
          {/* ============================================================ */}
          {/* ============================================================ */}
          {/* ABA 3: FOLHA DE PAGAMENTO & BENEFÍCIOS                       */}
          {/* ============================================================ */}
          <TabsContent value="folha" className="space-y-4">
            {/* COMPONENTE DE ALERTAS: VALE 40% (DIA 20) E SALDO 60% (DIA 05) */}
            <PayrollAlertCard
              employees={employees}
              referenceMonth={referenceMonth}
              onLaunchPayrollPart={async (type) => {
                await payrollMutation.mutateAsync(type);
              }}
              isPending={payrollMutation.isPending}
            />

            <Card className="glass border-border/60">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Detalhamento Salarial & Benefícios</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cálculo individual da folha, adiantamentos e integração direta com o Contas a Pagar.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mês de Referência:</span>
                    <Input
                      type="month"
                      value={referenceMonth}
                      onChange={(e) => setReferenceMonth(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="hero"
                        className="gap-2"
                        disabled={payrollMutation.isPending || activeEmployees.length === 0}
                      >
                        <Wallet className="h-4 w-4" />
                        {payrollMutation.isPending ? "Lançando..." : "Lançar Folha Completa"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Lançar Folha Completa no Contas a Pagar?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação criará os lançamentos de despesa (categoria <strong>Salários / RH</strong>)
                          no módulo Financeiro para <strong>{activeEmployees.length} colaborador(es)</strong>,
                          totalizando <strong>{formatBRL(totalPayrollCost)}</strong> para o mês de{" "}
                          <strong>{referenceMonth}</strong> (gerando tanto o Vale no dia 20 quanto o Saldo no dia 05).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => payrollMutation.mutate("all")}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Confirmar Lançamento Completo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>

              {/* VISÃO MOBILE: CARDS DA FOLHA */}
              <div className="grid grid-cols-1 gap-2.5 sm:hidden p-4 pt-0">
                {activeEmployees.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum colaborador ativo cadastrado para a folha.
                  </div>
                ) : (
                  activeEmployees.map((emp) => {
                    const salary = Number(emp.base_salary || 0);
                    const benefits = Number(emp.benefits_total || 0);
                    const vale = Math.round(salary * 0.40 * 100) / 100;
                    const saldo = Math.round(salary * 0.60 * 100) / 100 + benefits;
                    const total = salary + benefits;

                    return (
                      <div
                        key={emp.id}
                        className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm active:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-sm leading-tight text-foreground truncate block">
                              {emp.name}
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{emp.role}</span>
                              {emp.contract_type && <Badge variant="outline" className="text-[10px] px-1 py-0">{emp.contract_type}</Badge>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-muted-foreground block">Custo Total</span>
                            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                              {formatBRL(total)}
                            </span>
                          </div>
                        </div>

                        {/* Grid dos Pagamentos: Vale 40% vs Saldo 60% */}
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2 text-xs border border-border/40 mt-1">
                          <div className="border-r border-border/40 pr-2">
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block">
                              Vale 40% (Dia 20)
                            </span>
                            <span className="font-extrabold text-foreground text-sm">
                              {formatBRL(vale)}
                            </span>
                          </div>
                          <div className="pl-1">
                            <span className="text-[10px] font-bold text-primary block">
                              Saldo 60% (Dia 05)
                            </span>
                            <span className="font-extrabold text-foreground text-sm">
                              {formatBRL(saldo)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                          <span>Salário Base: {formatBRL(salary)}</span>
                          <span>{emp.pix_key ? `Pix: ${emp.pix_key}` : emp.bank_name || "Sem chave Pix"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* VISÃO DESKTOP: TABELA DA FOLHA */}
              <div className="hidden sm:block">
                <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Regime</TableHead>
                      <TableHead>Salário Base</TableHead>
                      <TableHead className="text-amber-600 dark:text-amber-400 font-bold">Vale 40% (Dia 20)</TableHead>
                      <TableHead className="text-primary font-bold">Saldo 60% (Dia 05)</TableHead>
                      <TableHead>Benefícios</TableHead>
                      <TableHead>Custo Total</TableHead>
                      <TableHead>Chave Pix / Conta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          Nenhum colaborador ativo cadastrado para a folha.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeEmployees.map((emp) => {
                        const salary = Number(emp.base_salary || 0);
                        const benefits = Number(emp.benefits_total || 0);
                        const vale = Math.round(salary * 0.40 * 100) / 100;
                        const saldo = Math.round(salary * 0.60 * 100) / 100 + benefits;
                        const total = salary + benefits;

                        return (
                          <TableRow key={emp.id} className="odd:bg-muted/15">
                            <TableCell className="font-semibold">{emp.name}</TableCell>
                            <TableCell>{emp.role}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{emp.contract_type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatBRL(salary)}
                            </TableCell>
                            <TableCell className="font-extrabold text-amber-600 dark:text-amber-400">
                              {formatBRL(vale)}
                            </TableCell>
                            <TableCell className="font-extrabold text-primary">
                              {formatBRL(saldo)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatBRL(benefits)}
                            </TableCell>
                            <TableCell className="font-black text-emerald-600 dark:text-emerald-400">
                              {formatBRL(total)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {emp.pix_key ? `Pix: ${emp.pix_key}` : emp.bank_name || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 4: OCORRÊNCIAS & PONTO                                   */}
          {/* ============================================================ */}
          <TabsContent value="ocorrencias" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Histórico de Ocorrências & Ponto</h3>
                <p className="text-xs text-muted-foreground">
                  Registro de atestados médicos, faltas justificadas, horas extras e advertências.
                </p>
              </div>

              <OccurrenceDialog
                employees={activeEmployees}
                onSave={async (o) => {
                  await saveOccurrenceMutation.mutateAsync(o);
                }}
              />
            </div>

            <Card className="glass overflow-hidden border-border/60">
              <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  ↔️ Arraste para o lado para ver motivo e ação
                </span>
                <span className="font-semibold">{occurrences.length} ocorrências</span>
              </div>
              <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[700px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo de Ocorrência</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Descrição / Motivo</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOccurrences ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : occurrences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nenhuma ocorrência registrada até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    occurrences.map((occ) => (
                      <TableRow key={occ.id}>
                        <TableCell className="text-xs font-semibold">
                          {formatDateBR(occ.date)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {occ.employee_name || "Colaborador"}
                        </TableCell>
                        <TableCell>
                          {occ.type === "Atestado" ? (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
                              Atestado Médico
                            </Badge>
                          ) : occ.type === "Falta" ? (
                            <Badge variant="destructive">Falta</Badge>
                          ) : occ.type === "Hora Extra" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              Hora Extra
                            </Badge>
                          ) : (
                            <Badge variant="outline">{occ.type}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {occ.hours_or_days ? `${occ.hours_or_days} dia(s)/h` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {occ.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => deleteOccurrenceMutation.mutate(occ.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIÁLOGO DE EDIÇÃO DE COLABORADOR */}
        {editingEmployee && (
          <EmployeeDialog
            initial={editingEmployee}
            isOpenControlled={editEmployeeOpen}
            onOpenChangeControlled={setEditEmployeeOpen}
            onSave={async (emp) => {
              await saveEmployeeMutation.mutateAsync(emp);
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
