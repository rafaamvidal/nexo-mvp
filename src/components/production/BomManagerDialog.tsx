import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calculator, ChefHat, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getProductBom, saveProductBom, type BomIngredient } from "@/lib/bom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

interface BomManagerDialogProps {
  trigger?: React.ReactNode;
  defaultProductId?: string;
  isOpenControlled?: boolean;
  onOpenChangeControlled?: (open: boolean) => void;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function BomManagerDialog({
  trigger,
  defaultProductId,
  isOpenControlled,
  onOpenChangeControlled,
}: BomManagerDialogProps) {
  const { currentOrg } = useOrganization();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const open = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const setOpen = onOpenChangeControlled || setInternalOpen;

  const [selectedProductId, setSelectedProductId] = React.useState<string>(defaultProductId ?? "");
  const [ingredients, setIngredients] = React.useState<BomIngredient[]>([]);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (defaultProductId) {
      setSelectedProductId(defaultProductId);
    }
  }, [defaultProductId]);

  // Busca produtos finais da empresa ativa
  const { data: finishedProducts } = useQuery({
    queryKey: ["products", "finished_for_bom", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name,unit,price_cost,price_sale")
        .eq("status", "Ativo")
        .eq("type", "Produto Final")
        .order("name", { ascending: true });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(currentOrg?.id),
  });

  // Busca matérias-primas da empresa ativa
  const { data: rawMaterials } = useQuery({
    queryKey: ["products", "raw_for_bom", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name,unit,price_cost,type")
        .eq("status", "Ativo")
        .neq("type", "Produto Final")
        .order("name", { ascending: true });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(currentOrg?.id),
  });

  // Quando o produto final selecionado mudar, carrega a Ficha Técnica
  React.useEffect(() => {
    if (!selectedProductId) {
      setIngredients([]);
      return;
    }

    let active = true;
    getProductBom(selectedProductId).then((bom) => {
      if (active) {
        setIngredients(bom.length > 0 ? bom : [{ rawMaterialId: "", quantityPerUnit: 1 }]);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedProductId]);

  const handleAddIngredient = () => {
    setIngredients((cur) => [...cur, { rawMaterialId: "", quantityPerUnit: 1 }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((cur) => cur.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, rawId: string) => {
    const raw = (rawMaterials ?? []).find((r) => r.id === rawId);
    setIngredients((cur) =>
      cur.map((it, i) =>
        i === index
          ? {
              ...it,
              rawMaterialId: rawId,
              rawMaterialName: raw?.name,
              unit: raw?.unit,
              costUnit: Number(raw?.price_cost ?? 0),
            }
          : it
      )
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setIngredients((cur) =>
      cur.map((it, i) => (i === index ? { ...it, quantityPerUnit: qty } : it))
    );
  };

  // Cálculo do Custo de Insumos da Receita
  const totalRecipeCost = React.useMemo(() => {
    let sum = 0;
    for (const item of ingredients) {
      const raw = (rawMaterials ?? []).find((r) => r.id === item.rawMaterialId);
      const cost = Number(raw?.price_cost ?? item.costUnit ?? 0);
      sum += cost * Number(item.quantityPerUnit || 0);
    }
    return sum;
  }, [ingredients, rawMaterials]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error("Selecione um produto final");
      await saveProductBom(selectedProductId, ingredients, currentOrg?.id);

      // Atualiza opcionalmente o price_cost do produto final no banco
      if (totalRecipeCost > 0) {
        await supabase
          .from("products")
          .update({ price_cost: Number(totalRecipeCost.toFixed(4)) } as any)
          .eq("id", selectedProductId);
      }
    },
    onSuccess: () => {
      toast.success("Ficha Técnica salva e custo unitário atualizado!");
      qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar Ficha Técnica"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Fichas Técnicas (Receitas)
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <span>Ficha Técnica de Produção (Receita Industrial)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Defina a receita exata do produto. Ao produzir este item, o sistema dará baixa automática nas
            matérias-primas e recalculará o custo de produção unitário.
          </p>

          <div className="grid gap-2">
            <Label>Produto Final / Fabricado *</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto a configurar..." />
              </SelectTrigger>
              <SelectContent>
                {(finishedProducts ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProductId && (
            <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Insumos por 1 Unidade
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddIngredient}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Insumo
                </Button>
              </div>

              {ingredients.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum insumo configurado para este produto.
                </p>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((item, idx) => {
                    const selectedRaw = (rawMaterials ?? []).find((r) => r.id === item.rawMaterialId);
                    const lineCost = Number(selectedRaw?.price_cost ?? 0) * Number(item.quantityPerUnit || 0);

                    return (
                      <div key={idx} className="flex flex-col gap-1 rounded-lg border bg-background/50 p-2 sm:flex-row sm:items-center">
                        <div className="flex-1">
                          <Select
                            value={item.rawMaterialId}
                            onValueChange={(v) => handleIngredientChange(idx, v)}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Selecione o insumo / matéria-prima..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(rawMaterials ?? []).map((rm: any) => (
                                <SelectItem key={rm.id} value={rm.id}>
                                  {rm.name} {rm.type ? `[${rm.type}]` : ""} ({formatBRL(Number(rm.price_cost ?? 0))}/{rm.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <Input
                              type="number"
                              min={0.0001}
                              step="any"
                              value={item.quantityPerUnit}
                              onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                              placeholder="Qtd"
                              className="h-9 text-xs"
                            />
                          </div>

                          <span className="w-12 text-xs font-medium text-muted-foreground">
                            {selectedRaw?.unit ?? "un"}
                          </span>

                          <span className="w-16 text-right text-xs font-semibold text-foreground/80">
                            {formatBRL(lineCost)}
                          </span>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custo Consolidado da Receita */}
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span>Custo Estimado dos Insumos (Unitário):</span>
                </div>
                <span className="text-sm font-extrabold text-primary">
                  {formatBRL(totalRecipeCost)}
                </span>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="hero"
            onClick={() => saveMutation.mutate()}
            disabled={!selectedProductId || saveMutation.isPending}
            className="w-full gap-2 mt-2"
          >
            <Save className="h-4 w-4" />
            Salvar Ficha Técnica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
