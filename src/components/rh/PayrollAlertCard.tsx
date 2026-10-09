import * as React from "react";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Wallet,
  Clock,
  Send,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatBRL } from "@/lib/masks";
import type { Employee } from "@/types/rh";

interface PayrollAlertCardProps {
  employees: Employee[];
  referenceMonth: string; // YYYY-MM
  onLaunchPayrollPart: (type: "vale_40" | "saldo_60" | "all") => Promise<void>;
  isPending?: boolean;
}

export function PayrollAlertCard({
  employees,
  referenceMonth,
  onLaunchPayrollPart,
  isPending = false,
}: PayrollAlertCardProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const activeEmployees = React.useMemo(() => {
    return employees.filter(
      (e) => (e.status === "Ativo" || e.status === "Em Férias") && Number(e.base_salary || 0) > 0
    );
  }, [employees]);

  // Cálculos do Vale 40% e Saldo 60%
  const calculations = React.useMemo(() => {
    let totalSalarioBase = 0;
    let totalVale40 = 0;
    let totalSaldo60 = 0;
    let totalBeneficios = 0;

    const list = activeEmployees.map((emp) => {
      const base = Number(emp.base_salary || 0);
      const ben = Number(emp.benefits_total || 0);
      const vale = Math.round(base * 0.40 * 100) / 100;
      const saldo = Math.round(base * 0.60 * 100) / 100 + ben;

      totalSalarioBase += base;
      totalVale40 += vale;
      totalSaldo60 += saldo;
      totalBeneficios += ben;

      return {
        emp,
        base,
        ben,
        vale,
        saldo,
        total: vale + saldo,
      };
    });

    return {
      list,
      totalSalarioBase,
      totalVale40,
      totalSaldo60,
      totalBeneficios,
      totalGeral: totalVale40 + totalSaldo60,
    };
  }, [activeEmployees]);

  // Cálculos de dias restantes para o Dia 20 (Vale) e Dia 05 (Saldo)
  const alertStatus = React.useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();

    // Dia 20 deste mês
    const daysToVale = 20 - currentDay;
    const isValeToday = currentDay === 20;
    const isValeUrgent = currentDay >= 15 && currentDay <= 20;
    const isValePast = currentDay > 20;

    // Dia 05 (próximo vencimento do saldo)
    let daysToSaldo: number;
    let isSaldoToday: boolean = false;
    let isSaldoUrgent: boolean = false;

    if (currentDay <= 5) {
      daysToSaldo = 5 - currentDay;
      isSaldoToday = currentDay === 5;
      isSaldoUrgent = true;
    } else {
      // Dias até o dia 5 do próximo mês
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysToSaldo = (lastDayOfMonth - currentDay) + 5;
      isSaldoUrgent = currentDay >= 26;
    }

    return {
      currentDay,
      daysToVale,
      isValeToday,
      isValeUrgent,
      isValePast,
      daysToSaldo,
      isSaldoToday,
      isSaldoUrgent,
    };
  }, []);

  return (
    <Card className="glass border-border/70 overflow-hidden shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/15">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Alertas de Pagamento de Colaboradores
                <Badge variant="outline" className="text-[10px] font-normal">
                  CLT / Fixos
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Regra padrão: <strong>Vale de 40% no dia 20</strong> e <strong>Saldo de 60% no dia 05</strong>.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="h-8 gap-1 text-xs text-muted-foreground self-start sm:self-auto"
          >
            <span>{showDetails ? "Ocultar Colaboradores" : "Ver por Colaborador"}</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* DUPLO PAINEL DE ALERTAS: VALE 40% (DIA 20) & SALDO 60% (DIA 05) */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* CARD 1: VALE DE 40% - DIA 20 */}
          <div
            className={`flex flex-col justify-between rounded-xl p-3.5 border transition-all ${
              alertStatus.isValeToday
                ? "bg-rose-500/10 border-rose-500/40"
                : alertStatus.isValeUrgent
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-card border-border/60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Vale / Adiantamento (40%)
                </span>
                {alertStatus.isValeToday ? (
                  <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0">
                    🚨 VENCE HOJE (DIA 20)
                  </Badge>
                ) : alertStatus.isValeUrgent ? (
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0">
                    Faltam {alertStatus.daysToVale} dias (Dia 20)
                  </Badge>
                ) : alertStatus.isValePast ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Passou neste mês (Dia 20)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Vence dia 20
                  </Badge>
                )}
              </div>

              <div className="mt-2.5">
                <span className="text-[11px] text-muted-foreground block">
                  Total do Vale ({activeEmployees.length} colaboradores):
                </span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatBRL(calculations.totalVale40)}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Vencimento: <strong>Dia 20</strong>
              </span>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    disabled={isPending || activeEmployees.length === 0}
                  >
                    <Send className="h-3 w-3" />
                    <span>Lançar Vale (Dia 20)</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lançar Vale (40%) no Contas a Pagar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação criará os lançamentos de adiantamento salarial de <strong>40%</strong> para{" "}
                      <strong>{activeEmployees.length} colaborador(es)</strong>, totalizando{" "}
                      <strong>{formatBRL(calculations.totalVale40)}</strong> com vencimento para o{" "}
                      <strong>dia 20 de {referenceMonth}</strong> no Contas a Pagar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onLaunchPayrollPart("vale_40")}
                      className="bg-amber-600 text-white hover:bg-amber-700"
                    >
                      Confirmar Lançamento do Vale
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* CARD 2: SALDO DE 60% + BENEFÍCIOS - DIA 05 */}
          <div
            className={`flex flex-col justify-between rounded-xl p-3.5 border transition-all ${
              alertStatus.isSaldoToday
                ? "bg-rose-500/10 border-rose-500/40"
                : alertStatus.isSaldoUrgent
                ? "bg-blue-500/10 border-blue-500/30"
                : "bg-card border-border/60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  Saldo Restante (60%) + Benefícios
                </span>
                {alertStatus.isSaldoToday ? (
                  <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0">
                    🚨 VENCE HOJE (DIA 05)
                  </Badge>
                ) : alertStatus.isSaldoUrgent ? (
                  <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">
                    Faltam {alertStatus.daysToSaldo} dias (Dia 05)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Vence dia 05
                  </Badge>
                )}
              </div>

              <div className="mt-2.5">
                <span className="text-[11px] text-muted-foreground block">
                  Total do Saldo ({activeEmployees.length} colaboradores):
                </span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatBRL(calculations.totalSaldo60)}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Vencimento: <strong>Dia 05</strong>
              </span>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    disabled={isPending || activeEmployees.length === 0}
                  >
                    <Send className="h-3 w-3" />
                    <span>Lançar Saldo (Dia 05)</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lançar Saldo (60%) no Contas a Pagar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação criará os lançamentos de saldo de salário (<strong>60% + benefícios</strong>) para{" "}
                      <strong>{activeEmployees.length} colaborador(es)</strong>, totalizando{" "}
                      <strong>{formatBRL(calculations.totalSaldo60)}</strong> com vencimento para o{" "}
                      <strong>dia 05 subsequente</strong> no Contas a Pagar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onLaunchPayrollPart("saldo_60")}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Confirmar Lançamento do Saldo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* DETALHAMENTO EXPANSÍVEL POR COLABORADOR */}
        {showDetails && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-muted-foreground text-[11px] uppercase tracking-wider pb-1 border-b border-border/40">
              <span>Colaborador</span>
              <div className="flex items-center gap-4 text-right">
                <span>Vale 40% (Dia 20)</span>
                <span>Saldo 60% (Dia 05)</span>
                <span>Total</span>
              </div>
            </div>

            <div className="divide-y divide-border/30 max-h-56 overflow-y-auto">
              {calculations.list.map(({ emp, vale, saldo, total }) => (
                <div key={emp.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">{emp.name}</span>
                    <span className="text-[10px] text-muted-foreground">{emp.role} • Salário: {formatBRL(Number(emp.base_salary || 0))}</span>
                  </div>

                  <div className="flex items-center gap-4 text-right font-medium shrink-0">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{formatBRL(vale)}</span>
                    <span className="text-primary font-bold">{formatBRL(saldo)}</span>
                    <span className="font-extrabold text-foreground">{formatBRL(total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
