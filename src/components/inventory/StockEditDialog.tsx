import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: { id: string; name: string; current_stock: number; unit: string };
}

export function StockEditDialog({ open, onOpenChange, product }: Props) {
  const [qty, setQty] = React.useState("");
  const qc = useQueryClient();

  React.useEffect(() => {
    if (open) setQty(String(product.current_stock));
  }, [open, product.current_stock]);

  const mutation = useMutation({
    mutationFn: async (newQty: number) => {
      const delta = newQty - product.current_stock;
      if (delta === 0) return;
      const { error } = await (supabase as any).rpc("apply_stock_adjustment", {
        p_product_id: product.id,
        p_delta: delta,
        p_reason: "Ajuste manual via edição",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Estoque atualizado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(qty);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    mutation.mutate(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="truncate">Editar: {product.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stock-qty">Quantidade em estoque ({product.unit})</Label>
            <Input
              id="stock-qty"
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Atual: {product.current_stock} {product.unit}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
