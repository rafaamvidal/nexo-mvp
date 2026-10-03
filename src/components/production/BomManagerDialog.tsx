import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getProductBom, saveProductBom, type BomIngredient } from "@/lib/bom";
import { toast } from "sonner";

interface BomManagerDialogProps {
  trigger?: React.ReactNode;
}

export function BomManagerDialog({ trigger }: BomManagerDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [ingredients, setIngredients] = React.useState<BomIngredient[]>([]);
  const qc = useQueryClient();

  // Busca produtos finais
  const { data: finishedProducts } = useQuery({
    queryKey: ["products", "finished_for_bom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,unit")
        .eq("status", "Ativo")
        .eq("type", "Produto Final")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Busca matérias-primas
  const { data: rawMaterials } = useQuery({
    queryKey: ["products", "raw_for_bom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,unit")
        .eq("status", "Ativo")
        .eq("type", "Matéria-Prima")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error("Selecione um produto final");
      await saveProductBom(selectedProductId, ingredients);
    },
    onSuccess: () => {
      toast.success("Ficha Técnica salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["manufacturing_orders"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar Ficha Técnica"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Fichas Técnicas (Receitas)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <span>Ficha Técnica de Produção (BOM)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Defina a receita dos seus produtos acabados. Ao concluir uma ordem de produção, os insumos
            cadastrados aqui serão baixados automaticamente do estoque.
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
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Insumos para 1 Unidade
                </span>
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
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={item.rawMaterialId}
                            onValueChange={(v) => handleIngredientChange(idx, v)}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Selecione a matéria-prima..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(rawMaterials ?? []).map((rm) => (
                                <SelectItem key={rm.id} value={rm.id}>
                                  {rm.name} ({rm.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-24">
                          <Input
                            type="number"
                            min={0.001}
                            step="any"
                            value={item.quantityPerUnit}
                            onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                            placeholder="Qtd"
                            className="h-9 text-xs"
                          />
                        </div>

                        <span className="w-10 text-xs text-muted-foreground">
                          {selectedRaw?.unit ?? "un"}
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
                    );
                  })}
                </div>
              )}
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
