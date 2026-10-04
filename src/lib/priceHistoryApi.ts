import { supabase } from "@/integrations/supabase/client";
import type { PriceHistoryRecord, CreatePriceHistoryPayload, SeasonalityMetrics } from "@/types/priceHistory";

/**
 * Busca o histórico de preços de um produto ordenado cronologicamente (da compra mais recente para a mais antiga).
 */
export async function fetchProductPriceHistory(
  productId: string,
  orgId?: string
): Promise<PriceHistoryRecord[]> {
  try {
    let query = supabase
      .from("product_price_history" as any)
      .select("id, organization_id, product_id, purchase_date, unit_price, package_price, package_size, package_name, supplier_id, supplier_name, notes, source, created_at")
      .eq("product_id", productId)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (orgId) {
      query = query.eq("organization_id", orgId);
    }

    const { data, error } = await query;
    if (error) {
      // Se a tabela ainda não tiver sido criada no Supabase pelo usuário, trata com fallback limpo
      if (error.code === "42P01" || error.message?.includes("does not exist") || error.code === "PGRST204") {
        console.warn("Tabela product_price_history ainda não criada no banco de dados.");
        return [];
      }
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      ...row,
      unit_price: Number(row.unit_price ?? 0),
      package_price: row.package_price != null ? Number(row.package_price) : null,
      package_size: row.package_size != null ? Number(row.package_size) : null,
    }));
  } catch (err) {
    console.warn("Erro ao buscar histórico de preços:", err);
    return [];
  }
}

/**
 * Registra uma nova compra/cotação no histórico de preços.
 */
export async function insertPriceHistory(
  payload: CreatePriceHistoryPayload
): Promise<PriceHistoryRecord | null> {
  try {
    const insertData: any = {
      product_id: payload.product_id,
      purchase_date: payload.purchase_date || new Date().toISOString().slice(0, 10),
      unit_price: payload.unit_price,
      package_price: payload.package_price ?? null,
      package_size: payload.package_size ?? null,
      package_name: payload.package_name ?? null,
      supplier_id: payload.supplier_id ?? null,
      supplier_name: payload.supplier_name ?? null,
      notes: payload.notes ?? null,
      source: payload.source ?? "manual",
    };

    if (payload.organization_id) {
      insertData.organization_id = payload.organization_id;
    }

    const { data, error } = await supabase
      .from("product_price_history" as any)
      .insert(insertData)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Tabela product_price_history não existe no Supabase. Execute a migração SQL.");
        return null;
      }
      throw error;
    }

    return data as PriceHistoryRecord;
  } catch (err) {
    console.warn("Falha ao registrar histórico de preços:", err);
    return null;
  }
}

/**
 * Remove um registro do histórico de preços.
 */
export async function deletePriceHistory(id: string): Promise<void> {
  const { error } = await supabase
    .from("product_price_history" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Calcula métricas de sazonalidade a partir do histórico de preços:
 * - Menor preço (época barata)
 * - Maior preço (época cara / pico)
 * - Preço médio
 * - Variação recente (%)
 */
export function computeSeasonalityMetrics(records: PriceHistoryRecord[]): SeasonalityMetrics {
  if (!records || records.length === 0) {
    return {
      lowestPrice: null,
      highestPrice: null,
      averagePrice: 0,
      recentVariationPct: null,
      totalPurchases: 0,
    };
  }

  let lowest = { price: records[0].unit_price, date: records[0].purchase_date };
  let highest = { price: records[0].unit_price, date: records[0].purchase_date };
  let sum = 0;

  for (const r of records) {
    const p = r.unit_price;
    sum += p;
    if (p < lowest.price) {
      lowest = { price: p, date: r.purchase_date };
    }
    if (p > highest.price) {
      highest = { price: p, date: r.purchase_date };
    }
  }

  const averagePrice = Number((sum / records.length).toFixed(4));

  // Variação recente: comparando a compra mais recente (índice 0 se ordenado desc) com a anterior (índice 1)
  let recentVariationPct: number | null = null;
  if (records.length >= 2) {
    const latest = records[0].unit_price;
    const previous = records[1].unit_price;
    if (previous > 0) {
      recentVariationPct = Number((((latest - previous) / previous) * 100).toFixed(1));
    }
  }

  return {
    lowestPrice: lowest,
    highestPrice: highest,
    averagePrice,
    recentVariationPct,
    totalPurchases: records.length,
  };
}
