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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { ProductType } from "@/types/inventory";
import { useOrganization } from "@/contexts/OrganizationContext";

function normalizeName(name: string) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

const UNIT_OPTIONS = ["un", "kg", "g", "L"] as const;

function normalizeUnit(unit: string) {
  const u = String(unit ?? "").trim();
  if (!u) return u;
  if (u.toLowerCase() === "l") return "L";
  if (u.toLowerCase() === "kg") return "kg";
  if (u.toLowerCase() === "g") return "g";
  if (u.toLowerCase() === "un") return "un";
  return u;
}

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
  const [reactivateDialogOpen, setReactivateDialogOpen] = React.useState(false);
  const [reactivateCandidate, setReactivateCandidate] = React.useState<{ id: string; name: string } | null>(null);
  const [pendingValues, setPendingValues] = React.useState<FormValues | null>(null);
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();

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

  const unitValue = form.watch("unit");
  const isUnitPreset = React.useMemo(() => UNIT_OPTIONS.includes(unitValue as any), [unitValue]);

  React.useEffect(() => {
    if (!open) return;
    // ao abrir um novo cadastro, limpar estados de reativação
    setReactivateDialogOpen(false);
    setReactivateCandidate(null);
    setPendingValues(null);
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

  const reactivateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      const payload = {
        status: "Ativo",
        name: normalizeName(values.name),
        type: values.type as ProductType,
        category: (values.category ?? "").trim() || null,
        unit: values.unit,
        current_stock: values.current_stock,
        min_stock: values.min_stock,
        price_cost: values.price_cost ?? null,
        price_sale: values.price_sale ?? null,
      };

      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Produto reativado com sucesso!");
      await qc.invalidateQueries({ queryKey: ["products"] });
      form.reset();
      setReactivateDialogOpen(false);
      setReactivateCandidate(null);
      setPendingValues(null);
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reativar"),
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: normalizeName(values.name),
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
        : (supabase.from("products") as any).insert({
            ...payload,
            organization_id: currentOrg?.id,
          });

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

  const onSubmit = form.handleSubmit(async (values) => {
    // Normalização de unidade (mantendo compatibilidade com unidades antigas)
    const normalizedUnit = normalizeUnit(values.unit);
    const normalizedValues = normalizedUnit !== values.unit ? { ...values, unit: normalizedUnit } : values;
    if (normalizedUnit !== values.unit) form.setValue("unit", normalizedUnit, { shouldDirty: true });

    // Edição não deve disparar verificação de duplicidade
    if (product) {
      upsertMutation.mutate(normalizedValues);
      return;
    }

    const normalized = normalizeName(normalizedValues.name);
    // reforçar normalização no form para não “salvar diferente” do que verificou
    if (normalized !== normalizedValues.name) form.setValue("name", normalized, { shouldDirty: true });

    let dupQuery = supabase
      .from("products")
      .select("id,name,status,created_at")
      .ilike("name", normalized);

    if (currentOrg?.id) {
      dupQuery = dupQuery.eq("organization_id", currentOrg.id);
    }

    const { data, error } = await dupQuery
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      toast.error(error.message);
      return;
    }

    const matches = (data ?? []).filter((row) => normalizeName(row.name) === normalized);
    const match = matches[0];

    if (match) {
      const status = (match.status ?? "Ativo") as string;
      if (status !== "Inativo") {
        form.setError("name", { type: "validate", message: "Produto já cadastrado." });
        return;
      }

      // encontrado inativo: oferecer reativação
      setReactivateCandidate({ id: match.id, name: match.name });
      setPendingValues(normalizedValues);
      setReactivateDialogOpen(true);
      return;
    }

    upsertMutation.mutate(normalizedValues);
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
          onSubmit={onSubmit}
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
              <Select
                value={isUnitPreset ? unitValue : "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") return;
                  form.setValue("unit", v, { shouldDirty: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  {!isUnitPreset && <SelectItem value="__custom__">Outra (manter atual)</SelectItem>}
                </SelectContent>
              </Select>

              {!isUnitPreset && (
                <Input id="unit" placeholder="Digite a unidade" {...form.register("unit")} />
              )}
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

      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos um produto “<span className="font-semibold">{reactivateCandidate?.name}</span>” inativo no sistema.
              Deseja reativá-lo e recuperar seu histórico?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setReactivateDialogOpen(false);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!reactivateCandidate || !pendingValues) return;
                reactivateMutation.mutate({ id: reactivateCandidate.id, values: pendingValues });
              }}
              disabled={reactivateMutation.isPending}
            >
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
