import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function StockQuickAdjust({
  productId,
  step = 1,
}: {
  productId: string;
  step?: number;
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
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="glass"
        size="icon"
        aria-label="Diminuir estoque"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(-Math.abs(step))}
      >
        <Minus />
      </Button>
      <Button
        type="button"
        variant="hero"
        size="icon"
        aria-label="Aumentar estoque"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(Math.abs(step))}
      >
        <Plus />
      </Button>
    </div>
  );
}
