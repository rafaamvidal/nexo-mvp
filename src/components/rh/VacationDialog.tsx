import * as React from "react";
import { Calendar, Palmtree, Plus } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Employee, EmployeeVacation, VacationStatus } from "@/types/rh";

interface VacationDialogProps {
  trigger?: React.ReactNode;
  employees: Employee[];
  defaultEmployeeId?: string;
  initial?: Partial<EmployeeVacation>;
  onSave: (payload: Partial<EmployeeVacation>) => Promise<void>;
  isOpenControlled?: boolean;
  onOpenChangeControlled?: (open: boolean) => void;
}

export function VacationDialog({
  trigger,
  employees,
  defaultEmployeeId,
  initial,
  onSave,
  isOpenControlled,
  onOpenChangeControlled,
}: VacationDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const setOpen = onOpenChangeControlled || setInternalOpen;

  const [employeeId, setEmployeeId] = React.useState("");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = React.useState(30);
  const [sellDays, setSellDays] = React.useState(0);
  const [advance13th, setAdvance13th] = React.useState(false);
  const [status, setStatus] = React.useState<VacationStatus>("Agendada");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmployeeId(initial?.employee_id || defaultEmployeeId || employees[0]?.id || "");
    setStartDate(initial?.start_date || new Date().toISOString().slice(0, 10));
    setDays(Number(initial?.days || 30));
    setSellDays(Number(initial?.sell_days || 0));
    setAdvance13th(Boolean(initial?.advance_13th));
    setStatus((initial?.status as VacationStatus) || "Agendada");
    setNotes(initial?.notes || "");
  }, [open, initial, defaultEmployeeId, employees]);

  // Calcula automaticamente a data de término
  const calculatedEndDate = React.useMemo(() => {
    if (!startDate || days <= 0) return startDate;
    try {
      const parsed = parseISO(startDate);
      const end = addDays(parsed, days - 1);
      return format(end, "yyyy-MM-dd");
    } catch {
      return startDate;
    }
  }, [startDate, days]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Selecione o colaborador");
      return;
    }
    if (!startDate) {
      toast.error("Informe a data de início");
      return;
    }
    if (days < 5 || days > 30) {
      toast.error("O período de férias deve ter entre 5 e 30 dias");
      return;
    }
    if (sellDays > 10) {
      toast.error("Pela CLT, o abono pecuniário (venda) é limitado a até 10 dias (1/3)");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        id: initial?.id,
        employee_id: employeeId,
        start_date: startDate,
        end_date: calculatedEndDate,
        days: Number(days),
        sell_days: Number(sellDays),
        advance_13th: advance13th,
        status,
        notes: notes.trim() || null,
      });

      toast.success("Férias registradas com sucesso!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar férias");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmp = employees.find((e) => e.id === employeeId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="hero" className="gap-2">
            <Palmtree className="h-4 w-4" />
            Agendar Férias
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-primary" />
            <span>{initial?.id ? "Editar Período de Férias" : "Agendar Férias do Colaborador"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmp && (
              <p className="text-xs text-muted-foreground">
                Setor: {selectedEmp.department} | Admissão: {new Date(selectedEmp.admission_date).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="vac-start">Data de Início *</Label>
              <Input
                id="vac-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vac-days">Quantidade de Dias *</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger id="vac-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 dias (Fração 1)</SelectItem>
                  <SelectItem value="15">15 dias (Metade)</SelectItem>
                  <SelectItem value="20">20 dias (com 10 vendidos)</SelectItem>
                  <SelectItem value="30">30 dias (Integral)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/15 p-3 text-xs flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Data de Retorno Prevista:</span>
            <span className="font-bold text-foreground">
              {calculatedEndDate ? new Date(calculatedEndDate).toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="vac-sell">Vender Dias (Abono)</Label>
              <Select value={String(sellDays)} onValueChange={(v) => setSellDays(Number(v))}>
                <SelectTrigger id="vac-sell">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nenhum (0 dias)</SelectItem>
                  <SelectItem value="5">5 dias</SelectItem>
                  <SelectItem value="10">10 dias (1/3 CLT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VacationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agendada">Agendada</SelectItem>
                  <SelectItem value="Em Gozo">Em Gozo</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="vac-13" className="text-sm font-semibold">
                Adiantar 1ª Parcela do 13º Salário
              </Label>
              <p className="text-xs text-muted-foreground">Pagar 50% do 13º junto com as férias.</p>
            </div>
            <Switch id="vac-13" checked={advance13th} onCheckedChange={setAdvance13th} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vac-notes">Observações</Label>
            <Input
              id="vac-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Substituto durante o período, acordos, etc."
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : initial?.id ? "Salvar Férias" : "Confirmar Agendamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
