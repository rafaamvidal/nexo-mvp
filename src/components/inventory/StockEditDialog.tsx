import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Hash, Minus, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateBoxBreakdown,
  encodePackageMetadata,
  parsePackageMetadata,
  type PackageInfo,
} from "@/lib/packageConversion";
import { parseBRDecimal } from "@/components/inventory/ProductFormSheet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: {
    id: string;
    name: string;
    current_stock: number;
    unit: string;
    description?: string | null;
    price_cost?: number | null;
  };
}

export function StockEditDialog({ open, onOpenChange, product }: Props) {
  const qc = useQueryClient();

  const existingPkg = React.useMemo(
    () => parsePackageMetadata(product.description, product.name, product.unit),
    [product.description, product.name, product.unit]
  );

  const [mode, setMode] = React.useState<"boxes" | "units">("units");
  const [qtyUnits, setQtyUnits] = React.useState("");
  const [boxesCount, setBoxesCount] = React.useState("");
  const [looseCount, setLooseCount] = React.useState("");

  const [showConfigBox, setShowConfigBox] = React.useState(false);
  const [boxSizeInput, setBoxSizeInput] = React.useState("");
  const [boxNameInput, setBoxNameInput] = React.useState("Caixa");

  React.useEffect(() => {
    if (!open) return;
    const stock = Math.max(0, Number(product.current_stock ?? 0));
    setQtyUnits(String(stock));
    setShowConfigBox(false);

    if (existingPkg && existingPkg.packageSize > 1) {
      const size = existingPkg.packageSize;
      const full = Math.floor((stock + 1e-9) / size);
      const loose = Number(Math.max(0, stock - full * size).toFixed(4));
      setBoxSizeInput(String(size));
      setBoxNameInput(existingPkg.packageName || "Caixa");
      setBoxesCount(String(full));
      setLooseCount(String(loose));
      setMode("boxes");
    } else {
      setBoxSizeInput("200");
      setBoxNameInput("Caixa");
      setBoxesCount("0");
      setLooseCount(String(stock));
      setMode("units");
    }
  }, [open, product.current_stock, existingPkg]);

  const activeBoxSize = React.useMemo(() => {
    const parsed = parseBRDecimal(boxSizeInput) ?? 0;
    if (showConfigBox || existingPkg) {
      return parsed > 1 ? parsed : 0;
    }
    return 0;
  }, [boxSizeInput, showConfigBox, existingPkg]);

  const activePkg: PackageInfo | null = React.useMemo(() => {
    if (activeBoxSize <= 1) return null;
    return {
      packageName: boxNameInput || existingPkg?.packageName || "Caixa",
      packageSize: activeBoxSize,
      packagePrice: existingPkg?.packagePrice ?? 0,
    };
  }, [activeBoxSize, boxNameInput, existingPkg]);

  const computedTotalStock = React.useMemo(() => {
    if (mode === "boxes" && activePkg) {
      const b = Math.max(0, parseBRDecimal(boxesCount) ?? 0);
      const l = Math.max(0, parseBRDecimal(looseCount) ?? 0);
      return Number((b * activePkg.packageSize + l).toFixed(4));
    }
    return Math.max(0, parseBRDecimal(qtyUnits) ?? 0);
  }, [mode, activePkg, boxesCount, looseCount, qtyUnits]);

  const currentBreakdown = React.useMemo(
    () => calculateBoxBreakdown(product.current_stock, product.unit, activePkg),
    [product.current_stock, product.unit, activePkg]
  );

  const projectedBreakdown = React.useMemo(
    () => calculateBoxBreakdown(computedTotalStock, product.unit, activePkg),
    [computedTotalStock, product.unit, activePkg]
  );

  const delta = Number((computedTotalStock - Number(product.current_stock ?? 0)).toFixed(4));

  const handleSwitchMode = (nextMode: "boxes" | "units") => {
    if (nextMode === mode) return;
    if (nextMode === "boxes") {
      const size = activeBoxSize > 1 ? activeBoxSize : 200;
      if (activeBoxSize <= 1) {
        setBoxSizeInput("200");
        setShowConfigBox(true);
      }
      const total = Math.max(0, parseBRDecimal(qtyUnits) ?? 0);
      const full = Math.floor((total + 1e-9) / size);
      const loose = Number(Math.max(0, total - full * size).toFixed(4));
      setBoxesCount(String(full));
      setLooseCount(String(loose));
    } else {
      setQtyUnits(String(computedTotalStock));
    }
    setMode(nextMode);
  };

  const handleBoxSizeChange = (newVal: string) => {
    setBoxSizeInput(newVal);
    const size = parseBRDecimal(newVal) ?? 0;
    if (size > 1 && mode === "boxes") {
      const currentTotal = Math.max(0, parseBRDecimal(qtyUnits) ?? Number(product.current_stock ?? 0));
      const full = Math.floor((currentTotal + 1e-9) / size);
      const loose = Number(Math.max(0, currentTotal - full * size).toFixed(4));
      setBoxesCount(String(full));
      setLooseCount(String(loose));
    }
  };

  const mutation = useMutation({
    mutationFn: async (newQty: number) => {
      // 1. Se configurou ou alterou a capacidade da caixa, salva na descrição do produto
      const pkgChanged =
        (activePkg &&
          (!existingPkg ||
            existingPkg.packageSize !== activePkg.packageSize ||
            existingPkg.packageName !== activePkg.packageName)) ||
        (!activePkg && existingPkg);

      if (pkgChanged) {
        const updatedDesc = encodePackageMetadata(activePkg, product.description, {
          markExplicitNone: !activePkg,
        });
        await supabase.from("products").update({ description: updatedDesc }).eq("id", product.id);
      }

      // 2. Aplica a diferença de saldo
      const stockDelta = Number((newQty - Number(product.current_stock ?? 0)).toFixed(4));
      if (stockDelta === 0) return;

      const reason =
        activePkg && projectedBreakdown.hasBoxes
          ? `Ajuste manual (${projectedBreakdown.summaryText} = ${newQty} ${product.unit})`
          : "Ajuste manual via edição";

      const { error } = await (supabase as any).rpc("apply_stock_adjustment", {
        p_product_id: product.id,
        p_delta: stockDelta,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Estoque atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar estoque"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(computedTotalStock) || computedTotalStock < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    mutation.mutate(computedTotalStock);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-xl p-5 sm:max-w-[440px] sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-left leading-snug" title={product.name}>
            Ajustar Estoque: {product.name}
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Saldo atual:{" "}
            <strong className="text-foreground">
              {product.current_stock} {product.unit}
            </strong>
            {currentBreakdown.hasBoxes && (
              <span className="ml-1.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                📦 {currentBreakdown.summaryText}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* SELETOR DE MODO: CAIXAS vs UNIDADES */}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/50 p-1 border border-border/60">
            <Button
              type="button"
              size="sm"
              variant={mode === "boxes" ? "default" : "ghost"}
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => handleSwitchMode("boxes")}
            >
              <Box className="h-3.5 w-3.5" />
              <span>Por Caixas + {product.unit}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "units" ? "default" : "ghost"}
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => handleSwitchMode("units")}
            >
              <Hash className="h-3.5 w-3.5" />
              <span>Total em {product.unit}</span>
            </Button>
          </div>

          {/* CONFIGURAÇÃO DA CAPACIDADE DA CAIXA */}
          {(mode === "boxes" || existingPkg || showConfigBox) && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5 text-primary" />
                  Capacidade:{" "}
                  <strong className="text-foreground">
                    1 {boxNameInput} = {activeBoxSize || 200} {product.unit}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1 text-primary"
                  onClick={() => setShowConfigBox(!showConfigBox)}
                >
                  <Settings2 className="h-3 w-3" />
                  <span>{showConfigBox ? "Fechar" : "Alterar"}</span>
                </Button>
              </div>

              {showConfigBox && (
                <div className="pt-1 border-t border-border/50 space-y-2">
                  <Label className="text-[11px] font-medium">
                    Quantas unidades ({product.unit}) cabem em 1 {boxNameInput}?
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={2}
                      value={boxSizeInput}
                      onChange={(e) => handleBoxSizeChange(e.target.value)}
                      className="h-8 text-xs font-bold flex-1"
                      placeholder="Ex: 200"
                    />
                    {["200", "100", "50"].map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={boxSizeInput === preset ? "default" : "outline"}
                        className="h-8 px-2 text-[11px] font-semibold"
                        onClick={() => handleBoxSizeChange(preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ENTRADA DE DADOS SEGUNDO O MODO */}
          {mode === "boxes" && activePkg ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stock-boxes" className="text-xs font-semibold">
                    {activePkg.packageName}s Fechadas ({activePkg.packageSize} {product.unit})
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-9 shrink-0"
                      onClick={() => {
                        const cur = Math.max(0, parseBRDecimal(boxesCount) ?? 0);
                        setBoxesCount(String(Math.max(0, cur - 1)));
                      }}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      id="stock-boxes"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step="1"
                      value={boxesCount}
                      onChange={(e) => setBoxesCount(e.target.value)}
                      className="h-10 text-center font-bold text-base"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-9 shrink-0 border-primary/40 text-primary"
                      onClick={() => {
                        const cur = Math.max(0, parseBRDecimal(boxesCount) ?? 0);
                        setBoxesCount(String(cur + 1));
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stock-loose" className="text-xs font-semibold">
                    Unidades Avulsas ({product.unit})
                  </Label>
                  <Input
                    id="stock-loose"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={looseCount}
                    onChange={(e) => setLooseCount(e.target.value)}
                    className="h-10 font-semibold text-base"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stock-qty" className="text-xs font-semibold">
                Quantidade Total em Estoque ({product.unit})
              </Label>
              <Input
                id="stock-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={qtyUnits}
                onChange={(e) => setQtyUnits(e.target.value)}
                className="h-11 text-base font-bold sm:h-10"
                autoFocus
              />
            </div>
          )}

          {/* RESUMO DA CONVERSÃO E IMPACTO */}
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Novo Saldo Total:</span>
              <span className="font-extrabold text-sm text-foreground">
                {computedTotalStock} {product.unit}
              </span>
            </div>
            {projectedBreakdown.hasBoxes && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Equivalência em Caixas:</span>
                <span className="font-bold text-primary">
                  📦 {projectedBreakdown.summaryText} ({projectedBreakdown.formattedTotalBoxes} cx)
                </span>
              </div>
            )}
            {delta !== 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-primary/20">
                <span className="text-muted-foreground">Ajuste a lançar no Kardex:</span>
                <span className={delta > 0 ? "font-bold text-emerald-600" : "font-bold text-destructive"}>
                  {delta > 0 ? `+${delta}` : delta} {product.unit}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" className="h-11 sm:h-10" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-11 sm:h-10 font-semibold" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar Estoque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
