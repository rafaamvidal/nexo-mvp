import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import type { ProductType } from "@/types/inventory";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120),
  type: z.enum(["Matéria-Prima", "Produto Final"]),
  unit: z.string().trim().min(1, "Informe a unidade").max(16),
  current_stock: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
});

type FormValues = z.infer<typeof schema>;

export function ProductFormSheet() {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "Produto Final", unit: "un", current_stock: 0, min_stock: 0 },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.from("products").insert({
        name: values.name,
        type: values.type as ProductType,
        unit: values.unit,
        current_stock: values.current_stock,
        min_stock: values.min_stock,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto cadastrado");
      await qc.invalidateQueries({ queryKey: ["products"] });
      form.reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar"),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="hero" size="touch">Cadastrar produto</Button>
      </SheetTrigger>
      <SheetContent className="glass w-full max-w-md border-l border-border/60">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Novo produto</SheetTitle>
        </SheetHeader>

        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Ex: Açúcar" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-muted-foreground">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Matéria-Prima">Matéria-Prima</SelectItem>
                <SelectItem value="Produto Final">Produto Final</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input id="unit" placeholder="kg / un / l" {...form.register("unit")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min_stock">Estoque mínimo</Label>
              <Input id="min_stock" inputMode="decimal" {...form.register("min_stock")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="current_stock">Estoque atual (opcional)</Label>
            <Input id="current_stock" inputMode="decimal" {...form.register("current_stock")} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
