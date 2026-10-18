import { describe, it, expect } from "vitest";
import {
  calculateBoxBreakdown,
  encodePackageMetadata,
  parsePackageMetadata,
} from "@/lib/packageConversion";

describe("packageConversion - Controle de Estoque por Caixa e Unidade", () => {
  it("reconhece automaticamente Caixa de 200 un para produtos Trufa sem metadado prévio", () => {
    // Arrange & Act
    const pkg = parsePackageMetadata(null, "Trufa Tradicional Don Juan", "un");

    // Assert
    expect(pkg).not.toBeNull();
    expect(pkg?.packageName).toBe("Caixa");
    expect(pkg?.packageSize).toBe(200);
  });

  it("respeita desativação explícita (PKG:NONE) mesmo para produto Trufa", () => {
    // Arrange
    const desc = encodePackageMetadata(null, "Receita base", { markExplicitNone: true });

    // Act
    const pkg = parsePackageMetadata(desc, "Trufa de Maracujá", "un");

    // Assert
    expect(pkg).toBeNull();
  });

  it("serializa e lê capacidade de caixa sem preço de compra (Produto Final)", () => {
    // Arrange
    const encoded = encodePackageMetadata(
      { packageName: "Caixa", packageSize: 200, packagePrice: 0 },
      "Observação anterior"
    );

    // Act
    const parsed = parsePackageMetadata(encoded, "Bombom Sortido", "un");

    // Assert
    expect(parsed).toEqual({
      packageName: "Caixa",
      packageSize: 200,
      packagePrice: 0,
    });
  });

  it("calcula corretamente caixas fechadas + unidades avulsas (ex: 1250 trufas em caixas de 200)", () => {
    // Arrange
    const pkg = { packageName: "Caixa", packageSize: 200, packagePrice: 0 };

    // Act
    const result = calculateBoxBreakdown(1250, "un", pkg);

    // Assert
    expect(result.hasBoxes).toBe(true);
    expect(result.fullBoxes).toBe(6);
    expect(result.looseUnits).toBe(50);
    expect(result.totalBoxesDecimal).toBe(6.25);
    expect(result.summaryText).toBe("6 cx + 50 un");
  });

  it("formata corretamente quando o saldo é múltiplo exato de caixas (ex: 400 trufas = 2 cx)", () => {
    // Arrange
    const pkg = { packageName: "Caixa", packageSize: 200, packagePrice: 0 };

    // Act
    const result = calculateBoxBreakdown(400, "un", pkg);

    // Assert
    expect(result.fullBoxes).toBe(2);
    expect(result.looseUnits).toBe(0);
    expect(result.summaryText).toBe("2 cx");
  });
});
