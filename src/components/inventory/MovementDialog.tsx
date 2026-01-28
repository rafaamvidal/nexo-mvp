import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import type { MovementType, ProductRow } from "@/types/inventory";

const schema = z.object({
  quantity: z.coerce.number().positive("Informe uma quantidade maior que 0").max(1_000_000),
});
type FormValues = z.infer<typeof schema>;

export function MovementDialog({
  product,
  movementType,
  trigger,
}: {
  product: ProductRow;
  movementType: MovementType;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { quantity: 1 } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // RPC mantém o ajuste de estoque + histórico em uma transação (mais estável).
      const { error } = await supabase.rpc("apply_movement", {
        p_product_id: product.id,
        p_type: movementType,
        p_quantity: values.quantity,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(`${movementType} registrada`);
      await qc.invalidateQueries({ queryKey: ["products"] });
      form.reset({ quantity: 1 });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar movimentação"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass max-w-md border border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{movementType} • {product.name}</DialogTitle>
        </DialogHeader>
        <form className="mt-2 grid gap-3" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <div className="grid gap-2">
            <Label htmlFor="qty">Quantidade ({product.unit})</Label>
            <Input id="qty" inputMode="decimal" {...form.register("quantity")} />
            {form.formState.errors.quantity && (
              <p className="text-sm text-muted-foreground">{form.formState.errors.quantity.message}</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
