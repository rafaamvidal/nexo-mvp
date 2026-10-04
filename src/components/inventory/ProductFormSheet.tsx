import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Layers, Package, Tag, Wrench } from "lucide-react";

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
import { PRODUCT_TYPES, type ProductType } from "@/types/inventory";
import { useOrganization } from "@/contexts/OrganizationContext";

function normalizeName(name: string) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export const PRODUCT_TYPE_OPTIONS: {
  value: ProductType;
  label: string;
  badge: string;
  description: string;
}[] = [
  {
    value: "Produto Final",
    label: "Produto Final / Acabado",
    badge: "Produto Final",
    description: "Item pronto para venda ao consumidor ou cliente (ex: Trufas Don Juan)",
  },
  {
    value: "Matéria-Prima",
    label: "Matéria-Prima / Ingrediente",
    badge: "Matéria-Prima",
    description: "Ingredientes diretos que compõem a receita (ex: Cacau, Chocolate, Leite)",
  },
  {
    value: "Embalagem",
    label: "Embalagem",
    badge: "Embalagem",
    description: "Caixas de transporte, potes, sacos kraft, papel chumbo, fitas",
  },
  {
    value: "Rótulo / Etiqueta",
    label: "Rótulo / Etiqueta",
    badge: "Rótulo / Etiqueta",
    description: "Etiquetas nutricionais, rótulos adesivos, lacres de segurança",
  },
  {
    value: "Insumo de Produção",
    label: "Insumo de Produção / Consumível",
    badge: "Insumo Produtivo",
    description: "Consumíveis da fábrica (ex: álcool de cereais, desmoldantes, gás)",
  },
  {
    value: "Utensílio / Ferramenta",
    label: "Utensílio / Ferramenta",
    badge: "Utensílio",
    description: "Formas de policarbonato, espátulas, termômetros, balanças, facas",
  },
  {
    value: "Limpeza e Higiene",
    label: "Limpeza & Higiene Industrial",
    badge: "Limpeza / Higiene",
    description: "Sanitizantes, detergentes industriais, luvas, toucas, álcool 70",
  },
  {
    value: "Material de Apoio",
    label: "Material de Apoio / Escritório",
    badge: "Material de Apoio",
    description: "Bobinas térmicas, fita gomada, suprimentos administrativos",
  },
  {
    value: "Outro",
    label: "Outros / Diversos",
    badge: "Outro",
    description: "Outras classificações gerais de estoque e almoxarifado",
  },
];

const UNIT_OPTIONS = ["un", "kg", "g", "L", "ml", "cx", "pct", "rolo", "m"] as const;

function normalizeUnit(unit: string) {
  const u = String(unit ?? "").trim();
  if (!u) return u;
  const lower = u.toLowerCase();
  if (lower === "un" || lower === "und" || lower === "unidade") return "un";
  if (lower === "kg" || lower === "kilo" || lower === "quilo") return "kg";
  if (lower === "g" || lower === "grama" || lower === "gramas") return "g";
  if (lower === "l" || lower === "litro" || lower === "litros") return "L";
  if (lower === "ml") return "ml";
  if (lower === "cx" || lower === "caixa") return "cx";
  if (lower === "pct" || lower === "pacote") return "pct";
  if (lower === "rolo") return "rolo";
  if (lower === "m" || lower === "metro") return "m";
  return u;
}

export function parseBRDecimal(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const clean = String(value)
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "");
  if (!clean) return undefined;
  let normalized = clean;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto").max(120, "Nome muito longo (máx 120 caracteres)"),
  type: z.string().min(1, "Selecione o tipo do produto"),
  category: z.string().trim().max(80, "Categoria muito longa").optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Informe a unidade").max(16),
  current_stock: z
    .any()
    .transform((v) => parseBRDecimal(v) ?? 0)
    .pipe(z.number({ invalid_type_error: "Estoque inválido" }).min(0, "Estoque não pode ser negativo")),
  min_stock: z
    .any()
    .transform((v) => parseBRDecimal(v) ?? 0)
    .pipe(z.number({ invalid_type_error: "Estoque mínimo inválido" }).min(0, "Estoque mínimo não pode ser negativo")),
  price_cost: z
    .any()
    .transform((v) => parseBRDecimal(v))
    .pipe(z.number({ invalid_type_error: "Custo inválido" }).min(0, "Custo não pode ser negativo").optional()),
  price_sale: z
    .any()
    .transform((v) => parseBRDecimal(v))
    .pipe(z.number({ invalid_type_error: "Preço inválido" }).min(0, "Preço não pode ser negativo").optional()),
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
      type: product.type || "Produto Final",
      category: product.category ?? "",
      unit: product.unit || "un",
      current_stock: Number(product.current_stock ?? 0),
      min_stock: Number(product.min_stock ?? 0),
      price_cost: product.price_cost !== null && product.price_cost !== undefined ? Number(product.price_cost) : undefined,
      price_sale: product.price_sale !== null && product.price_sale !== undefined ? Number(product.price_sale) : undefined,
    });
  }, [open, product, form]);

  const reactivateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      const payload: any = {
        status: "Ativo",
        name: normalizeName(values.name),
        type: values.type,
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
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reativar produto"),
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let orgId = currentOrg?.id;
      if (!orgId) {
        // Fallback resiliente para buscar organização ativa do usuário
        const { data: member } = await supabase
          .from("organization_members")
          .select("organization_id")
          .limit(1)
          .maybeSingle();
        if (member?.organization_id) {
          orgId = member.organization_id;
        }
      }

      const payload: any = {
        name: normalizeName(values.name),
        type: values.type,
        category: (values.category ?? "").trim() || null,
        unit: values.unit,
        current_stock: values.current_stock ?? 0,
        min_stock: values.min_stock ?? 0,
        price_cost: values.price_cost !== undefined ? values.price_cost : null,
        price_sale: values.price_sale !== undefined ? values.price_sale : null,
        status: "Ativo",
      };

      if (!product && orgId) {
        payload.organization_id = orgId;
      }

      const query = product
        ? supabase.from("products").update(payload).eq("id", product.id)
        : supabase.from("products").insert(payload);

      const { error } = await query;
      if (error) {
        console.error("Falha ao salvar produto no Supabase:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success(product ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
      await qc.invalidateQueries({ queryKey: ["products"] });
      form.reset();
      setOpen(false);
    },
    onError: (e: any) => {
      console.error("Erro no upsertMutation:", e);
      toast.error(e?.message ?? "Erro ao cadastrar produto");
    },
  });

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        const normalizedUnit = normalizeUnit(values.unit);
        const normalizedValues = { ...values, unit: normalizedUnit };
        if (normalizedUnit !== values.unit) {
          form.setValue("unit", normalizedUnit, { shouldDirty: true });
        }

        if (product) {
          upsertMutation.mutate(normalizedValues);
          return;
        }

        const normalized = normalizeName(normalizedValues.name);
        if (normalized !== normalizedValues.name) {
          form.setValue("name", normalized, { shouldDirty: true });
        }

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

        if (!error && data) {
          const matches = data.filter((row) => normalizeName(row.name).toLowerCase() === normalized.toLowerCase());
          const match = matches[0];

          if (match) {
            const status = (match.status ?? "Ativo") as string;
            if (status !== "Inativo") {
              form.setError("name", { type: "validate", message: "Produto já cadastrado com este nome." });
              toast.error("Já existe um produto ativo com este nome.");
              return;
            }

            // Encontrado inativo: oferecer reativação
            setReactivateCandidate({ id: match.id, name: match.name });
            setPendingValues(normalizedValues);
            setReactivateDialogOpen(true);
            return;
          }
        }

        upsertMutation.mutate(normalizedValues);
      } catch (err: any) {
        console.error("Erro inesperado no onSubmit:", err);
        toast.error(err?.message ?? "Falha ao processar formulário.");
      }
    },
    (errors) => {
      console.warn("Validação do formulário de produto falhou:", errors);
      const entries = Object.entries(errors);
      if (entries.length > 0) {
        const [field, err] = entries[0];
        const msg = err?.message ? String(err.message) : `Campo ${field} inválido.`;
        toast.error(`Atenção: ${msg}`);
      }
    }
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="hero" size="touch" className="gap-2">
            <Package className="h-4 w-4" />
            {product ? "Editar" : "Cadastrar produto"}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="glass w-full max-w-lg border-l border-border/60 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product ? "Editar Produto" : "Novo Produto / Insumo"}
          </SheetTitle>
        </SheetHeader>

        <form className="mt-6 grid gap-4 pb-6" onSubmit={onSubmit}>
          {/* NOME */}
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="font-semibold text-foreground">
              Nome do Produto / Insumo *
            </Label>
            <Input
              id="name"
              placeholder="Ex: Trufa de Maracujá, Cacau em Pó, Caixa Padrão..."
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* TIPO / CLASSIFICAÇÃO */}
          <div className="grid gap-1.5">
            <Label htmlFor="type" className="font-semibold text-foreground">
              Classificação / Tipo *
            </Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v, { shouldValidate: true })}
            >
              <SelectTrigger id="type" className="h-auto py-2.5">
                <SelectValue placeholder="Selecione a classificação..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {PRODUCT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="py-2">
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-foreground text-sm">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.type.message}</p>
            )}
          </div>

          {/* CATEGORIA */}
          <div className="grid gap-1.5">
            <Label htmlFor="category" className="font-medium">
              Categoria / Linha (Opcional)
            </Label>
            <Input
              id="category"
              placeholder="Ex: Recheios, Embalagens Secas, Linha Trufada, Utensílios..."
              {...form.register("category")}
            />
            {form.formState.errors.category && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.category.message}</p>
            )}
          </div>

          {/* UNIDADE & ESTOQUE MÍNIMO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="unit" className="font-semibold text-foreground">
                Unidade de Medida *
              </Label>
              <Select
                value={isUnitPreset ? unitValue : "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") return;
                  form.setValue("unit", v, { shouldDirty: true, shouldValidate: true });
                }}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un (Unidade)</SelectItem>
                  <SelectItem value="kg">kg (Quilograma)</SelectItem>
                  <SelectItem value="g">g (Grama)</SelectItem>
                  <SelectItem value="L">L (Litro)</SelectItem>
                  <SelectItem value="ml">ml (Mililitro)</SelectItem>
                  <SelectItem value="cx">cx (Caixa)</SelectItem>
                  <SelectItem value="pct">pct (Pacote)</SelectItem>
                  <SelectItem value="rolo">rolo (Rolo / Bobina)</SelectItem>
                  <SelectItem value="m">m (Metro)</SelectItem>
                  {!isUnitPreset && <SelectItem value="__custom__">Outra personalizada</SelectItem>}
                </SelectContent>
              </Select>

              {!isUnitPreset && (
                <Input
                  placeholder="Ex: par, kit, fardo..."
                  className="mt-1"
                  {...form.register("unit")}
                />
              )}
              {form.formState.errors.unit && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.unit.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="min_stock" className="font-semibold text-foreground">
                Estoque Mínimo (Alerta)
              </Label>
              <Input
                id="min_stock"
                inputMode="decimal"
                placeholder="0"
                {...form.register("min_stock")}
              />
              {form.formState.errors.min_stock && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.min_stock.message}</p>
              )}
            </div>
          </div>

          {/* CUSTO & PREÇO DE VENDA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price_cost" className="font-semibold text-foreground">
                Preço de Custo (R$)
              </Label>
              <Input
                id="price_cost"
                inputMode="decimal"
                placeholder="0,00"
                {...form.register("price_cost")}
              />
              {form.formState.errors.price_cost && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.price_cost.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="price_sale" className="font-semibold text-foreground">
                Preço de Venda (R$)
              </Label>
              <Input
                id="price_sale"
                inputMode="decimal"
                placeholder="0,00"
                {...form.register("price_sale")}
              />
              {form.formState.errors.price_sale && (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.price_sale.message}</p>
              )}
            </div>
          </div>

          {/* ESTOQUE ATUAL */}
          <div className="grid gap-1.5">
            <Label htmlFor="current_stock" className="font-semibold text-foreground">
              Estoque Inicial / Atual
            </Label>
            <Input
              id="current_stock"
              inputMode="decimal"
              placeholder="0"
              {...form.register("current_stock")}
            />
            {form.formState.errors.current_stock && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.current_stock.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Quantidade física disponível atualmente no almoxarifado ou fábrica.
            </p>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="hero"
              className="flex-1 font-semibold"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Salvando…" : "Salvar Produto"}
            </Button>
          </div>
        </form>
      </SheetContent>

      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar produto existente?</AlertDialogTitle>
            <AlertDialogDescription>
              Localizamos um produto inativo chamado “<span className="font-semibold text-foreground">{reactivateCandidate?.name}</span>”.
              Deseja reativá-lo com os novos dados fornecidos e manter seu histórico?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReactivateDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!reactivateCandidate || !pendingValues) return;
                reactivateMutation.mutate({ id: reactivateCandidate.id, values: pendingValues });
              }}
              disabled={reactivateMutation.isPending}
            >
              Reativar Produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
