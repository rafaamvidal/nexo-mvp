import { describe, expect, it } from "vitest";
import { computeSeasonalityMetrics } from "@/lib/priceHistoryApi";
import type { PriceHistoryRecord } from "@/types/priceHistory";

describe("Price History & Seasonality Calculations", () => {
  it("retorna métricas zeradas/nulas para lista vazia de histórico", () => {
    const metrics = computeSeasonalityMetrics([]);
    expect(metrics.totalPurchases).toBe(0);
    expect(metrics.lowestPrice).toBeNull();
    expect(metrics.highestPrice).toBeNull();
    expect(metrics.averagePrice).toBe(0);
    expect(metrics.recentVariationPct).toBeNull();
  });

  it("calcula corretamente para uma única compra registrada", () => {
    const records: PriceHistoryRecord[] = [
      {
        id: "1",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-05-10",
        unit_price: 20.50,
        source: "cadastro",
        created_at: "2026-05-10T12:00:00Z",
      },
    ];

    const metrics = computeSeasonalityMetrics(records);
    expect(metrics.totalPurchases).toBe(1);
    expect(metrics.lowestPrice).toEqual({ price: 20.50, date: "2026-05-10" });
    expect(metrics.highestPrice).toEqual({ price: 20.50, date: "2026-05-10" });
    expect(metrics.averagePrice).toBe(20.50);
    expect(metrics.recentVariationPct).toBeNull(); // Não há compra anterior para variação
  });

  it("identifica corretamente a época mais barata (safra) e mais cara (pico), média e variação recente", () => {
    // Lista ordenada desc por data da compra (mais recente primeiro: índice 0)
    const records: PriceHistoryRecord[] = [
      {
        id: "rec-3",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-08-15",
        unit_price: 26.00, // Pico / Entressafra
        source: "compra",
        created_at: "2026-08-15T10:00:00Z",
      },
      {
        id: "rec-2",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-05-20",
        unit_price: 22.00,
        source: "manual",
        created_at: "2026-05-20T10:00:00Z",
      },
      {
        id: "rec-1",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-02-10",
        unit_price: 18.00, // Menor preço / Safra
        source: "cadastro",
        created_at: "2026-02-10T10:00:00Z",
      },
    ];

    const metrics = computeSeasonalityMetrics(records);
    expect(metrics.totalPurchases).toBe(3);
    // Menor preço: R$ 18.00 em fevereiro
    expect(metrics.lowestPrice?.price).toBe(18.00);
    expect(metrics.lowestPrice?.date).toBe("2026-02-10");

    // Maior preço: R$ 26.00 em agosto
    expect(metrics.highestPrice?.price).toBe(26.00);
    expect(metrics.highestPrice?.date).toBe("2026-08-15");

    // Média: (26 + 22 + 18) / 3 = 66 / 3 = 22.00
    expect(metrics.averagePrice).toBe(22.00);

    // Variação recente: comparando rec-3 (26) com rec-2 (22)
    // (26 - 22) / 22 * 100 = 18.18% -> 18.2%
    expect(metrics.recentVariationPct).toBe(18.2);
  });

  it("calcula corretamente variação de queda de preço (economia)", () => {
    // Preço caiu de 25 para 20
    const records: PriceHistoryRecord[] = [
      {
        id: "rec-2",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-09-01",
        unit_price: 20.00,
        source: "compra",
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "rec-1",
        organization_id: "org-1",
        product_id: "prod-1",
        purchase_date: "2026-07-01",
        unit_price: 25.00,
        source: "cadastro",
        created_at: "2026-07-01T10:00:00Z",
      },
    ];

    const metrics = computeSeasonalityMetrics(records);
    // (20 - 25) / 25 * 100 = -20%
    expect(metrics.recentVariationPct).toBe(-20);
    expect(metrics.lowestPrice?.price).toBe(20.00);
    expect(metrics.highestPrice?.price).toBe(25.00);
  });
});
