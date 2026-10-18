import * as React from "react";
import { Box, Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function StockQuickAdjust({
  productId,
  step = 1,
  unit = "un",
  packageSize,
  packageShort = "cx",
  className,
}: {
  productId: string;
  step?: number;
  unit?: string;
  packageSize?: number | null;
  packageShort?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const hasBox = Boolean(packageSize && packageSize > 1);
  const boxStep = hasBox ? Number(packageSize) : 0;

  const mutation = useMutation({
    mutationFn: async ({ delta, reason }: { delta: number; reason?: string }) => {
      const { error } = await (supabase as any).rpc("apply_stock_adjustment", {
        p_product_id: productId,
        p_delta: delta,
        ...(reason ? { p_reason: reason } : {}),
      });
      if (error) throw error;
      return { delta };
    },
    onSuccess: async ({ delta }) => {
      if (hasBox && Math.abs(delta) === boxStep) {
        const sign = delta > 0 ? "+1" : "-1";
        toast.success(`Estoque ajustado em ${sign} ${packageShort} (${delta > 0 ? `+${delta}` : delta} ${unit})`);
      }
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stock_movements"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ajustar estoque"),
  });

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {hasBox && (
        <div
          className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/5 p-0.5"
          title={`Ajuste rápido por ${packageShort} (${boxStep} ${unit})`}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Diminuir 1 ${packageShort}`}
            title={`Diminuir 1 ${packageShort} (-${boxStep} ${unit})`}
            className="h-7 px-1.5 text-[11px] font-bold text-foreground hover:bg-destructive/15 hover:text-destructive"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                delta: -Math.abs(boxStep),
                reason: `Ajuste rápido (-1 ${packageShort} = -${boxStep} ${unit})`,
              })
            }
          >
            -1 {packageShort}
          </Button>
          <Box className="h-3 w-3 text-primary/70 shrink-0 mx-0.5 hidden sm:inline" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Aumentar 1 ${packageShort}`}
            title={`Aumentar 1 ${packageShort} (+${boxStep} ${unit})`}
            className="h-7 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/15"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                delta: Math.abs(boxStep),
                reason: `Ajuste rápido (+1 ${packageShort} = +${boxStep} ${unit})`,
              })
            }
          >
            +1 {packageShort}
          </Button>
        </div>
      )}

      <div className="inline-flex items-center gap-0.5">
        <Button
          type="button"
          variant="glass"
          size="sm"
          aria-label="Diminuir estoque unitário"
          title={`Diminuir ${step} ${unit}`}
          className="h-8 w-8 p-0"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ delta: -Math.abs(step) })}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="hero"
          size="sm"
          aria-label="Aumentar estoque unitário"
          title={`Aumentar ${step} ${unit}`}
          className="h-8 w-8 p-0"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ delta: Math.abs(step) })}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
