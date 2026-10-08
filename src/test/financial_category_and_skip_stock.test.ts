import { describe, it, expect } from "vitest";

const SKIP_STOCK_TAG = "[SEM_BAIXA_ESTOQUE]";
function isSkipStockSale(obs?: string | null): boolean {
  return Boolean(obs && obs.includes(SKIP_STOCK_TAG));
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

describe("Item 5: Vendas sem baixa de estoque (Trufas / itens prévios)", () => {
  it("detects skip stock tag correctly when present in observations", () => {
    expect(isSkipStockSale(`${SKIP_STOCK_TAG} Venda de trufas antigas`)).toBe(true);
    expect(isSkipStockSale(SKIP_STOCK_TAG)).toBe(true);
    expect(isSkipStockSale("Venda comum em balcão")).toBe(false);
    expect(isSkipStockSale(null)).toBe(false);
    expect(isSkipStockSale(undefined)).toBe(false);
  });

  it("handles formatting and removing tag cleanly for display", () => {
    const rawObs = `${SKIP_STOCK_TAG} Cliente retirou presencialmente`;
    const clean = rawObs.replace(SKIP_STOCK_TAG, "").trim();
    expect(clean).toBe("Cliente retirou presencialmente");
  });
});

describe("Item 3 & 4: Gastos por Categoria e Filtro de Período", () => {
  const sampleRecords = [
    { type: "Pagar", category: "Matéria-Prima", amount: 350, due_date: "2026-10-05", status: "Pago" },
    { type: "Pagar", category: "Matéria-Prima", amount: 150, due_date: "2026-10-12", status: "Aberto" },
    { type: "Pagar", category: "Embalagens", amount: 200, due_date: "2026-10-10", status: "Pago" },
    { type: "Pagar", category: "Energia Elétrica", amount: 180, due_date: "2026-10-15", status: "Aberto" },
    { type: "Receber", category: "Vendas", amount: 1500, due_date: "2026-10-07", status: "Pago" },
    { type: "Pagar", category: "Cancelada", amount: 999, due_date: "2026-10-01", status: "Cancelado" },
  ];

  it("groups expenses by category excluding canceled items and revenues", () => {
    let totalDespesas = 0;
    const catMap = new Map<string, { total: number; count: number }>();

    for (const r of sampleRecords) {
      if (r.status.toLowerCase() === "cancelado") continue;
      if (r.type.toLowerCase() !== "pagar") continue;

      totalDespesas += r.amount;
      const cat = r.category || "Geral";
      const existing = catMap.get(cat) ?? { total: 0, count: 0 };
      existing.total += r.amount;
      existing.count += 1;
      catMap.set(cat, existing);
    }

    expect(totalDespesas).toBe(350 + 150 + 200 + 180); // 880
    expect(catMap.get("Matéria-Prima")?.total).toBe(500);
    expect(catMap.get("Matéria-Prima")?.count).toBe(2);
    expect(catMap.get("Embalagens")?.total).toBe(200);
    expect(catMap.get("Energia Elétrica")?.total).toBe(180);
    expect(catMap.has("Vendas")).toBe(false);
    expect(catMap.has("Cancelada")).toBe(false);
  });

  it("calculates percentage share per category accurately", () => {
    const totalDespesas = 880;
    const mpTotal = 500;
    const percent = (mpTotal / totalDespesas) * 100;
    expect(percent).toBeCloseTo(56.818, 2);
  });
});
