/**
 * Gerenciador de Ficha Técnica / Receita de Produção (BOM - Bill of Materials).
 * Permite associar insumos / matérias-primas a produtos finais para baixa automática.
 */

import { supabase } from "@/integrations/supabase/client";

export interface BomIngredient {
  rawMaterialId: string;
  rawMaterialName?: string;
  unit?: string;
  costUnit?: number;
  quantityPerUnit: number; // Quantidade de matéria-prima por 1 unidade do produto final
}

export interface ProductBomData {
  productId: string;
  ingredients: BomIngredient[];
}

const STORAGE_PREFIX = "agilix_bom_";

/**
 * Carrega a Ficha Técnica de um produto final.
 */
export async function getProductBom(productId: string): Promise<BomIngredient[]> {
  if (!productId) return [];

  // 1. Tenta carregar do Supabase via tabela dedicada product_recipes
  try {
    const { data: recData, error: recErr } = await (supabase.from("product_recipes") as any)
      .select("raw_material_id, quantity_per_unit, unit")
      .eq("product_id", productId);

    if (!recErr && recData && recData.length > 0) {
      // Busca nomes e unidades das matérias-primas para enriquecer
      const rawIds = recData.map((r: any) => r.raw_material_id);
      const { data: rawProds } = await supabase
        .from("products")
        .select("id, name, unit, price_cost")
        .in("id", rawIds);

      const rawMap = new Map((rawProds ?? []).map((p: any) => [p.id, p]));

      const list: BomIngredient[] = recData.map((r: any) => {
        const prod = rawMap.get(r.raw_material_id);
        return {
          rawMaterialId: r.raw_material_id,
          rawMaterialName: prod?.name ?? "Insumo",
          unit: r.unit || prod?.unit || "un",
          costUnit: Number(prod?.price_cost ?? 0),
          quantityPerUnit: Number(r.quantity_per_unit),
        };
      });

      localStorage.setItem(`${STORAGE_PREFIX}${productId}`, JSON.stringify(list));
      return list;
    }
  } catch (err) {
    // Segue para fallback
  }

  // 2. Fallback: coluna description do Supabase
  try {
    const { data, error } = await supabase
      .from("products")
      .select("description")
      .eq("id", productId)
      .maybeSingle();

    if (!error && data?.description && data.description.startsWith("BOM:")) {
      const json = data.description.replace("BOM:", "");
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(`${STORAGE_PREFIX}${productId}`, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar BOM do produto:", err);
  }

  // 3. Fallback: cache local
  const local = localStorage.getItem(`${STORAGE_PREFIX}${productId}`);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignora erro
    }
  }

  return [];
}

/**
 * Salva a Ficha Técnica do produto no Supabase e no localStorage.
 */
export async function saveProductBom(
  productId: string,
  ingredients: BomIngredient[],
  orgId?: string
): Promise<void> {
  const validIngredients = ingredients.filter(
    (i) => i.rawMaterialId && Number(i.quantityPerUnit) > 0
  );

  const payloadStr = JSON.stringify(validIngredients);

  // 1. Salva no cache local
  localStorage.setItem(`${STORAGE_PREFIX}${productId}`, payloadStr);

  // 2. Persiste na tabela product_recipes
  try {
    await (supabase.from("product_recipes") as any)
      .delete()
      .eq("product_id", productId);

    if (validIngredients.length > 0 && orgId) {
      const rows = validIngredients.map((i) => ({
        organization_id: orgId,
        product_id: productId,
        raw_material_id: i.rawMaterialId,
        quantity_per_unit: Number(i.quantityPerUnit),
        unit: i.unit || null,
      }));
      await (supabase.from("product_recipes") as any).insert(rows);
    }
  } catch (err) {
    console.warn("Aviso ao persistir em product_recipes:", err);
  }

  // 3. Persiste no campo description como redundância segura
  try {
    await supabase
      .from("products")
      .update({
        description: `BOM:${payloadStr}`,
      } as any)
      .eq("id", productId);
  } catch (err) {
    console.warn("Não foi possível persistir BOM no Supabase:", err);
  }
}
