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
import { supabase } from "@/integrations/supabase/client";
import type { ProductType } from "@/types/inventory";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120),
  type: z.enum(["Matéria-Prima", "Produto Final"]),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Informe a unidade").max(16),
  current_stock: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
  price_cost: z.coerce.number().min(0).optional().or(z.nan()).transform((v) => (Number.isNaN(v) ? undefined : v)),
  price_sale: z.coerce.number().min(0).optional().or(z.nan()).transform((v) => (Number.isNaN(v) ? undefined : v)),
});

type FormValues = z.infer<typeof schema>;

export type EditableProduct = {
  id: string;
  name: string;
  type: ProductType;
  unit: string;
  current_stock: number;
  min_stock: number;
  category?: string | null;
  price_cost?: number | null;
  price_sale?: number | null;
};

export function ProductFormSheet({
  product,
  trigger,
}: {
  product?: EditableProduct;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "Produto Final",
      category: "",
      unit: "un",
      current_stock: 0,
      min_stock: 0,
      price_cost: undefined,
      price_sale: undefined,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (!product) {
      form.reset({
        name: "",
        type: "Produto Final",
        category: "",
        unit: "un",
        current_stock: 0,
        min_stock: 0,
        price_cost: undefined,
        price_sale: undefined,
      });
      return;
    }

    form.reset({
      name: product.name,
      type: product.type,
      category: product.category ?? "",
      unit: product.unit,
      current_stock: Number(product.current_stock ?? 0),
      min_stock: Number(product.min_stock ?? 0),
      price_cost: product.price_cost ?? undefined,
      price_sale: product.price_sale ?? undefined,
    });
  }, [open, product, form]);

  const upsertMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        type: values.type as ProductType,
        category: (values.category ?? "").trim() || null,
        unit: values.unit,
        current_stock: values.current_stock,
        min_stock: values.min_stock,
        price_cost: values.price_cost ?? null,
        price_sale: values.price_sale ?? null,
      };

      const query = product
        ? supabase.from("products").update(payload).eq("id", product.id)
        : supabase.from("products").insert(payload);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(product ? "Produto atualizado" : "Produto cadastrado");
      await qc.invalidateQueries({ queryKey: ["products"] });
      form.reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar"),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="hero" size="touch">
            {product ? "Editar" : "Cadastrar produto"}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="glass w-full max-w-md border-l border-border/60">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">{product ? "Editar produto" : "Novo produto"}</SheetTitle>
        </SheetHeader>

        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit((values) => upsertMutation.mutate(values))}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Ex: Açúcar" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-muted-foreground">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" placeholder="Ex: Ingredientes" {...form.register("category")} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="price_cost">Custo (R$)</Label>
              <Input id="price_cost" inputMode="decimal" placeholder="0,00" {...form.register("price_cost")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price_sale">Preço (R$)</Label>
              <Input id="price_sale" inputMode="decimal" placeholder="0,00" {...form.register("price_sale")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="current_stock">Estoque atual</Label>
            <Input id="current_stock" inputMode="decimal" {...form.register("current_stock")} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
