import * as React from "react";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Employee, EmployeeOccurrence, OccurrenceType } from "@/types/rh";

interface OccurrenceDialogProps {
  trigger?: React.ReactNode;
  employees: Employee[];
  defaultEmployeeId?: string;
  onSave: (payload: Partial<EmployeeOccurrence>) => Promise<void>;
  isOpenControlled?: boolean;
  onOpenChangeControlled?: (open: boolean) => void;
}

export function OccurrenceDialog({
  trigger,
  employees,
  defaultEmployeeId,
  onSave,
  isOpenControlled,
  onOpenChangeControlled,
}: OccurrenceDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const setOpen = onOpenChangeControlled || setInternalOpen;

  const [employeeId, setEmployeeId] = React.useState("");
  const [type, setType] = React.useState<OccurrenceType>("Atestado");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [hoursOrDays, setHoursOrDays] = React.useState<string>("1");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmployeeId(defaultEmployeeId || employees[0]?.id || "");
    setType("Atestado");
    setDate(new Date().toISOString().slice(0, 10));
    setHoursOrDays("1");
    setDescription("");
  }, [open, defaultEmployeeId, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Selecione o colaborador");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe a descrição ou motivo da ocorrência");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        employee_id: employeeId,
        type,
        date,
        hours_or_days: Number(hoursOrDays) || null,
        description: description.trim(),
      });

      toast.success("Ocorrência registrada com sucesso!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar ocorrência");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Ocorrência
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate pr-6 text-left leading-snug">
            <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Registrar Ocorrência / Ponto</span>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipo de Ocorrência</Label>
              <Select value={type} onValueChange={(v) => setType(v as OccurrenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Atestado">Atestado Médico</SelectItem>
                  <SelectItem value="Falta">Falta Injustificada</SelectItem>
                  <SelectItem value="Hora Extra">Hora Extra (+)</SelectItem>
                  <SelectItem value="Advertência">Advertência Escrita</SelectItem>
                  <SelectItem value="Elogio">Elogio / Bonificação</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="occ-date">Data da Ocorrência *</Label>
              <Input
                id="occ-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="occ-qty">Duração (Dias ou Horas)</Label>
            <Input
              id="occ-qty"
              type="number"
              step="any"
              min="0"
              value={hoursOrDays}
              onChange={(e) => setHoursOrDays(e.target.value)}
              placeholder="Ex: 1 (dia de atestado) ou 2.5 (horas extras)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="occ-desc">Descrição / Detalhes *</Label>
            <Input
              id="occ-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: CID Z00.0 apresentado, 2h extras no fechamento, etc."
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar Ocorrência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
