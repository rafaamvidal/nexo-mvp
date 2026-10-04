import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function StockQuickAdjust({
  productId,
  step = 1,
  className,
}: {
  productId: string;
  step?: number;
  className?: string;
}) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (delta: number) => {
      const { error } = await (supabase as any).rpc("apply_stock_adjustment", {
        p_product_id: productId,
        p_delta: delta,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ajustar estoque"),
  });

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="glass"
        size="sm"
        aria-label="Diminuir estoque"
        title="Diminuir estoque"
        className="h-8 w-8 p-0"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(-Math.abs(step))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="hero"
        size="sm"
        aria-label="Aumentar estoque"
        title="Aumentar estoque"
        className="h-8 w-8 p-0"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(Math.abs(step))}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
