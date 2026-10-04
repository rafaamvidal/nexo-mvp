export interface PriceHistoryRecord {
  id: string;
  organization_id: string;
  product_id: string;
  purchase_date: string; // YYYY-MM-DD
  unit_price: number;
  package_price?: number | null;
  package_size?: number | null;
  package_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  notes?: string | null;
  source: "cadastro" | "manual" | "compra" | "planilha";
  created_at: string;
}

export interface CreatePriceHistoryPayload {
  product_id: string;
  purchase_date: string;
  unit_price: number;
  package_price?: number | null;
  package_size?: number | null;
  package_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  notes?: string | null;
  source?: "cadastro" | "manual" | "compra" | "planilha";
  organization_id?: string;
}

export interface SeasonalityMetrics {
  lowestPrice: { price: number; date: string } | null;
  highestPrice: { price: number; date: string } | null;
  averagePrice: number;
  recentVariationPct: number | null; // ex: +15.5 or -8.2
  totalPurchases: number;
}
