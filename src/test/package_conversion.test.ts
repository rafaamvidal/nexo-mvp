import { describe, expect, it } from "vitest";
import {
  calculateUnitCost,
  calculateStockTotal,
  parsePackageMetadata,
  encodePackageMetadata,
  formatPackageSummary,
  hasSuspectedUnitCostAnomaly,
} from "@/lib/packageConversion";

describe("packageConversion", () => {
  it("calcula corretamente o custo por kg a partir de um saco de 25 kg por R$ 512,64", () => {
    // 512.64 / 25 = 20.5056
    const unitCost = calculateUnitCost(512.64, 25);
    expect(unitCost).toBe(20.5056);
  });

  it("calcula corretamente o valor total do estoque de 23 kg a R$ 20.5056/kg", () => {
    // 23 * 20.5056 = 471.6288 -> 471.63
    const stockTotal = calculateStockTotal(23, 20.5056);
    expect(stockTotal).toBe(471.63);
  });

  it("retorna 0 para entradas inválidas ou zeradas", () => {
    expect(calculateUnitCost(0, 25)).toBe(0);
    expect(calculateUnitCost(500, 0)).toBe(0);
    expect(calculateUnitCost(-10, 5)).toBe(0);
    expect(calculateStockTotal(0, 20)).toBe(0);
  });

  it("serializa e desserializa metadados de embalagem com precisão", () => {
    const pkg = {
      packageName: "Saco",
      packageSize: 25,
      packagePrice: 512.64,
    };

    const encoded = encodePackageMetadata(pkg, "Recheio de chocolate industrial");
    expect(encoded).toContain("PKG:");
    expect(encoded).toContain("Recheio de chocolate industrial");

    const parsed = parsePackageMetadata(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.packageName).toBe("Saco");
    expect(parsed?.packageSize).toBe(25);
    expect(parsed?.packagePrice).toBe(512.64);
  });

  it("formata o resumo da embalagem para exibição", () => {
    const pkg = {
      packageName: "Saco",
      packageSize: 25,
      packagePrice: 512.64,
    };
    const summary = formatPackageSummary(pkg, "kg");
    expect(summary).toContain("Saco 25kg");
    expect(summary).toContain("512,64");
  });

  it("detecta anomalias em custos por quilo atipicamente altos para matérias-primas", () => {
    // R$ 512,64 por kg é uma anomalia para matéria-prima
    expect(hasSuspectedUnitCostAnomaly(512.64, "kg", "Matéria-Prima")).toBe(true);
    // R$ 20,51 por kg é normal
    expect(hasSuspectedUnitCostAnomaly(20.51, "kg", "Matéria-Prima")).toBe(false);
    // Para Produto Final não marca falso positivo
    expect(hasSuspectedUnitCostAnomaly(512.64, "kg", "Produto Final")).toBe(false);
  });
});
