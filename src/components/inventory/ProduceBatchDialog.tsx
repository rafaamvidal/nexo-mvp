import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Factory, PackageCheck, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR } from "@/lib/masks";
import { parseBRDecimal } from "@/components/inventory/ProductFormSheet";
import { insertPriceHistory } from "@/lib/priceHistoryApi";

export interface ProduceBatchDialogProps {
  product: {
    id: string;
    name: string;
    unit: string;
    current_stock: number;
    price_cost?: number | null;
    price_sale?: number | null;
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProduceBatchDialog({
  product,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ProduceBatchDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (setControlledOpen ?? (() => {})) : setInternalOpen;

  const qc = useQueryClient();
  const { currentOrg } = useOrganization();

  const [quantity, setQuantity] = React.useState<string>("");
  const [manufactureDate, setManufactureDate] = React.useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [batchCode, setBatchCode] = React.useState<string>("");
  const [expiryDate, setExpiryDate] = React.useState<string>("");
  const [unitCost, setUnitCost] = React.useState<string>(
    product.price_cost != null && product.price_cost > 0
      ? product.price_cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : ""
  );
  const [notes, setNotes] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setQuantity("");
      setManufactureDate(new Date().toISOString().slice(0, 10));
      setBatchCode("");
      setExpiryDate("");
      setUnitCost(
        product.price_cost != null && product.price_cost > 0
          ? product.price_cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : ""
      );
      setNotes("");
    }
  }, [open, product.price_cost]);

  const numQty = React.useMemo(() => parseBRDecimal(quantity) ?? 0, [quantity]);
  const numCost = React.useMemo(() => parseBRDecimal(unitCost), [unitCost]);
  const projectedStock = (Number(product.current_stock) || 0) + numQty;

  const produceMutation = useMutation({
    mutationFn: async () => {
      if (numQty <= 0) {
        throw new Error("Informe uma quantidade produzida válida maior que zero.");
      }
      if (!manufactureDate) {
        throw new Error("Informe a data de fabricação do lote.");
      }

      const trimmedBatch = batchCode.trim();
      const reason = trimmedBatch
        ? `Fabricação Lote ${trimmedBatch}`
        : "Apontamento de Produção / Lote";

      // 1. Aplica movimento de estoque via RPC (atômico e seguro)
      const { error: rpcErr } = await (supabase as any).rpc("apply_movement", {
        p_product_id: product.id,
        p_type: "Entrada",
        p_quantity: numQty,
        p_reason: reason,
      });

      // Fallback resiliente caso RPC não esteja disponível
      if (rpcErr) {
        console.warn("RPC apply_movement falhou, aplicando fallback direto:", rpcErr);
        const { data: currentProd, error: fetchErr } = await supabase
          .from("products")
          .select("current_stock")
          .eq("id", product.id)
          .single();
        if (fetchErr) throw fetchErr;

        const newStock = Number(currentProd?.current_stock ?? 0) + numQty;
        const { error: updateErr } = await supabase
          .from("products")
          .update({ current_stock: newStock })
          .eq("id", product.id);
        if (updateErr) throw updateErr;

        // Registra extrato na tabela de movimentações
        await supabase.from("stock_movements").insert({
          product_id: product.id,
          type: "Entrada",
          quantity: numQty,
          reason,
          organization_id: currentOrg?.id,
        } as any);
      }

      // 2. Se informou custo ou dados de lote, registra no histórico de fabricação
      const batchDetails = [
        trimmedBatch ? `Lote: ${trimmedBatch}` : null,
        expiryDate ? `Validade: ${formatDateBR(expiryDate)}` : null,
        notes.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const costToRecord = numCost && numCost > 0 ? numCost : (product.price_cost ?? null);

      if (costToRecord || batchDetails) {
        await insertPriceHistory({
          product_id: product.id,
          purchase_date: manufactureDate,
          unit_price: costToRecord ?? 0,
          notes: batchDetails || "Novo lote fabricado",
          source: "fabricacao",
          organization_id: currentOrg?.id,
        });

        // Se o usuário especificou um custo unitário novo para o produto, atualiza no cadastro
        if (numCost && numCost > 0 && numCost !== product.price_cost) {
          await supabase
            .from("products")
            .update({ price_cost: numCost })
            .eq("id", product.id);
        }
      }
    },
    onSuccess: async () => {
      toast.success(
        `Lote fabricado com sucesso! +${numQty} ${product.unit} adicionados ao estoque de ${product.name}.`
      );
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stock_movements"] });
      await qc.invalidateQueries({ queryKey: ["product_price_history", product.id] });
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao registrar produção do lote.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    produceMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass max-w-lg border border-border/60 p-4 sm:p-6">
        <DialogHeader className="border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Apontar Fabricação / Novo Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                <strong className="text-foreground">{product.name}</strong> • Saldo atual:{" "}
                <span className="font-semibold text-foreground">
                  {product.current_stock} {product.unit}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* QUANTIDADE PRODUZIDA & DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="batch-qty" className="text-xs font-semibold text-foreground">
                Quantidade Fabricada ({product.unit}) *
              </Label>
              <Input
                id="batch-qty"
                placeholder="Ex: 50"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-bold text-sm"
                autoFocus
              />
              {numQty > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Novo saldo: <strong>{projectedStock} {product.unit}</strong> (+{numQty})
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="batch-date" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Data de Fabricação *
              </Label>
              <Input
                id="batch-date"
                type="date"
                value={manufactureDate}
                onChange={(e) => setManufactureDate(e.target.value)}
                className="text-xs font-medium"
              />
            </div>
          </div>

          {/* LOTE & VALIDADE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="batch-code" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Número / Identificação do Lote (Opcional)
              </Label>
              <Input
                id="batch-code"
                placeholder="Ex: LOTE-01, Páscoa 2026..."
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="batch-expiry" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Data de Validade (Opcional)
              </Label>
              <Input
                id="batch-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* CUSTO UNITÁRIO DO LOTE */}
          <div className="grid gap-1.5">
            <Label htmlFor="batch-cost" className="text-xs font-semibold text-foreground">
              Custo Unitário Desta Produção (R$ por {product.unit})
            </Label>
            <Input
              id="batch-cost"
              inputMode="decimal"
              placeholder="0,00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Deixe em branco para manter o custo atual cadastrado de {formatBRL(product.price_cost ?? 0)}/{product.unit}.
            </p>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="grid gap-1.5">
            <Label htmlFor="batch-notes" className="text-xs font-semibold text-foreground">
              Observações / Detalhes da Produção (Opcional)
            </Label>
            <Input
              id="batch-notes"
              placeholder="Ex: Turno matinal, rendimento de 98%, fornada especial..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={produceMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="hero"
              disabled={produceMutation.isPending || numQty <= 0}
              className="gap-1.5 font-semibold"
            >
              <PackageCheck className="h-4 w-4" />
              {produceMutation.isPending ? "Registrando Lote…" : "Confirmar Entrada do Lote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
