/**
 * Gerenciador de Ficha Técnica / Receita de Produção (BOM - Bill of Materials).
 * Permite associar insumos / matérias-primas a produtos finais para baixa automática.
 */

import { supabase } from "@/integrations/supabase/client";

export interface BomIngredient {
  rawMaterialId: string;
  rawMaterialName?: string;
  unit?: string;
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

  // Tenta carregar do localStorage primeiro
  const local = localStorage.getItem(`${STORAGE_PREFIX}${productId}`);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignora erro de parsing
    }
  }

  // Tenta carregar da coluna description do Supabase
  try {
    const { data, error } = await supabase
      .from("products")
      .select("description")
      .eq("id", productId)
      .maybeSingle();

    if (!error && data?.description) {
      if (data.description.startsWith("BOM:")) {
        const json = data.description.replace("BOM:", "");
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          // Atualiza cache local
          localStorage.setItem(`${STORAGE_PREFIX}${productId}`, JSON.stringify(parsed));
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar BOM do produto:", err);
  }

  return [];
}

/**
 * Salva a Ficha Técnica do produto no Supabase e no localStorage.
 */
export async function saveProductBom(productId: string, ingredients: BomIngredient[]): Promise<void> {
  const validIngredients = ingredients.filter(
    (i) => i.rawMaterialId && Number(i.quantityPerUnit) > 0
  );

  const payloadStr = JSON.stringify(validIngredients);

  // 1. Salva no cache local
  localStorage.setItem(`${STORAGE_PREFIX}${productId}`, payloadStr);

  // 2. Persiste no Supabase dentro do campo description
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
