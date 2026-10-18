import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Calendar, Factory, Hash, PackageCheck, Tag } from "lucide-react";
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
import { calculateBoxBreakdown, parsePackageMetadata } from "@/lib/packageConversion";

export interface ProduceBatchDialogProps {
  product: {
    id: string;
    name: string;
    unit: string;
    current_stock: number;
    price_cost?: number | null;
    price_sale?: number | null;
    description?: string | null;
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

  const pkg = React.useMemo(
    () => parsePackageMetadata(product.description, product.name, product.unit),
    [product.description, product.name, product.unit]
  );
  const hasBoxes = Boolean(pkg && pkg.packageSize > 1);

  const [entryMode, setEntryMode] = React.useState<"boxes" | "units">("units");
  const [quantity, setQuantity] = React.useState<string>("");
  const [boxesProduced, setBoxesProduced] = React.useState<string>("");
  const [extraUnitsProduced, setExtraUnitsProduced] = React.useState<string>("");
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
      setEntryMode(hasBoxes ? "boxes" : "units");
      setQuantity("");
      setBoxesProduced("");
      setExtraUnitsProduced("");
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
  }, [open, product.price_cost, hasBoxes]);

  const numQty = React.useMemo(() => {
    if (entryMode === "boxes" && pkg && pkg.packageSize > 1) {
      const b = Math.max(0, parseBRDecimal(boxesProduced) ?? 0);
      const u = Math.max(0, parseBRDecimal(extraUnitsProduced) ?? 0);
      return Number((b * pkg.packageSize + u).toFixed(4));
    }
    return parseBRDecimal(quantity) ?? 0;
  }, [entryMode, pkg, boxesProduced, extraUnitsProduced, quantity]);

  const numCost = React.useMemo(() => parseBRDecimal(unitCost), [unitCost]);
  const projectedStock = (Number(product.current_stock) || 0) + numQty;

  const currentBreakdown = React.useMemo(
    () => calculateBoxBreakdown(product.current_stock, product.unit, pkg),
    [product.current_stock, product.unit, pkg]
  );
  const producedBreakdown = React.useMemo(
    () => calculateBoxBreakdown(numQty, product.unit, pkg),
    [numQty, product.unit, pkg]
  );
  const projectedBreakdown = React.useMemo(
    () => calculateBoxBreakdown(projectedStock, product.unit, pkg),
    [projectedStock, product.unit, pkg]
  );

  const produceMutation = useMutation({
    mutationFn: async () => {
      if (numQty <= 0) {
        throw new Error("Informe uma quantidade produzida válida maior que zero.");
      }
      if (!manufactureDate) {
        throw new Error("Informe a data de fabricação do lote.");
      }

      const trimmedBatch = batchCode.trim();
      const boxSummarySuffix =
        producedBreakdown.hasBoxes && numQty > 0
          ? ` (${producedBreakdown.summaryText} = ${numQty} ${product.unit})`
          : "";
      const reason = trimmedBatch
        ? `Fabricação Lote ${trimmedBatch}${boxSummarySuffix}`
        : `Apontamento de Produção / Lote${boxSummarySuffix}`;

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
        producedBreakdown.hasBoxes ? `Qtd: ${producedBreakdown.summaryText} (${numQty} ${product.unit})` : `Qtd: ${numQty} ${product.unit}`,
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
      const boxMsg = producedBreakdown.hasBoxes ? ` (${producedBreakdown.summaryText})` : "";
      toast.success(
        `Lote fabricado com sucesso! +${numQty} ${product.unit}${boxMsg} adicionados ao estoque de ${product.name}.`
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
      <DialogContent className="glass max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden border border-border/60 p-4 sm:p-6">
        <DialogHeader className="border-b border-border/50 pb-3 min-w-0 pr-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Factory className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold leading-snug">
                Apontar Fabricação / Novo Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                <strong className="text-foreground break-words">{product.name}</strong> • Saldo atual:{" "}
                <span className="font-semibold text-foreground">
                  {product.current_stock} {product.unit}
                </span>
                {currentBreakdown.hasBoxes && (
                  <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    📦 {currentBreakdown.summaryText}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 min-w-0">
          {hasBoxes && pkg && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/50 p-1 border border-border/60">
              <Button
                type="button"
                size="sm"
                variant={entryMode === "boxes" ? "default" : "ghost"}
                className="h-8 gap-1.5 text-xs font-semibold min-w-0"
                onClick={() => setEntryMode("boxes")}
              >
                <Box className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Lançar em {pkg.packageName}s ({pkg.packageSize} {product.unit})</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={entryMode === "units" ? "default" : "ghost"}
                className="h-8 gap-1.5 text-xs font-semibold min-w-0"
                onClick={() => setEntryMode("units")}
              >
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Lançar em {product.unit}</span>
              </Button>
            </div>
          )}

          {/* QUANTIDADE PRODUZIDA & DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entryMode === "boxes" && hasBoxes && pkg ? (
              <div className="grid gap-2 sm:col-span-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="grid gap-1">
                    <Label htmlFor="batch-boxes" className="text-xs font-semibold text-foreground">
                      {pkg.packageName}s Fechadas ({pkg.packageSize} {product.unit}) *
                    </Label>
                    <Input
                      id="batch-boxes"
                      placeholder="Ex: 2"
                      inputMode="decimal"
                      value={boxesProduced}
                      onChange={(e) => setBoxesProduced(e.target.value)}
                      className="font-bold text-sm bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="batch-extra-units" className="text-xs font-semibold text-foreground">
                      + Avulsas ({product.unit})
                    </Label>
                    <Input
                      id="batch-extra-units"
                      placeholder="Ex: 0"
                      inputMode="decimal"
                      value={extraUnitsProduced}
                      onChange={(e) => setExtraUnitsProduced(e.target.value)}
                      className="font-medium text-sm bg-background"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="batch-date" className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Data de Fabricação *
                    </Label>
                    <Input
                      id="batch-date"
                      type="date"
                      value={manufactureDate}
                      onChange={(e) => setManufactureDate(e.target.value)}
                      className="text-xs font-medium bg-background"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground mr-1">Atalhos:</span>
                    {[1, 2, 5, 10].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={boxesProduced === String(n) ? "default" : "outline"}
                        className="h-6 px-2 text-[11px] font-semibold"
                        onClick={() => setBoxesProduced(String(n))}
                      >
                        +{n} cx ({n * pkg.packageSize})
                      </Button>
                    ))}
                  </div>
                  {numQty > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      Total: <strong>+{numQty} {product.unit}</strong> → Novo saldo:{" "}
                      <strong>{projectedStock} {product.unit}</strong> (📦 {projectedBreakdown.summaryText})
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="batch-qty" className="text-xs font-semibold text-foreground">
                    Quantidade Fabricada ({product.unit}) *
                  </Label>
                  <Input
                    id="batch-qty"
                    placeholder="Ex: 200"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="font-bold text-sm"
                    autoFocus
                  />
                  {numQty > 0 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Novo saldo: <strong>{projectedStock} {product.unit}</strong> (+{numQty})
                      {projectedBreakdown.hasBoxes && (
                        <span> • 📦 {projectedBreakdown.summaryText}</span>
                      )}
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
              </>
            )}
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
