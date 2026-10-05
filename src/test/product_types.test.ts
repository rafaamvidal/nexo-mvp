import { describe, it, expect } from "vitest";
import { PRODUCT_TYPES } from "@/types/inventory";
import { parseBRDecimal } from "@/components/inventory/ProductFormSheet";
import {
  resolveProductClassification,
  encodeProductClassificationFallback,
  isProductsTypeCheckError,
} from "@/lib/productClassification";
import { z } from "zod";

describe("Product Classifications & Brazilian Decimal Parsing", () => {
  it("should have comprehensive industrial product types defined", () => {
    expect(PRODUCT_TYPES).toContain("Produto Final");
    expect(PRODUCT_TYPES).toContain("Matéria-Prima");
    expect(PRODUCT_TYPES).toContain("Embalagem");
    expect(PRODUCT_TYPES).toContain("Rótulo / Etiqueta");
    expect(PRODUCT_TYPES).toContain("Insumo de Produção");
    expect(PRODUCT_TYPES).toContain("Utensílio / Ferramenta");
    expect(PRODUCT_TYPES).toContain("Limpeza e Higiene");
    expect(PRODUCT_TYPES).toContain("Material de Apoio");
    expect(PRODUCT_TYPES).toContain("Outro");
    expect(PRODUCT_TYPES.length).toBeGreaterThanOrEqual(9);
  });

  it("should correctly parse Brazilian decimal strings and currency", () => {
    expect(parseBRDecimal("10,50")).toBe(10.5);
    expect(parseBRDecimal("0,80")).toBe(0.8);
    expect(parseBRDecimal("R$ 1.250,50")).toBe(1250.5);
    expect(parseBRDecimal("1250.50")).toBe(1250.5);
    expect(parseBRDecimal("0")).toBe(0);
    expect(parseBRDecimal(0)).toBe(0);
    expect(parseBRDecimal("")).toBeUndefined();
    expect(parseBRDecimal(null)).toBeUndefined();
    expect(parseBRDecimal(undefined)).toBeUndefined();
  });

  it("should validate product schema when inputs contain Brazilian formatted numbers", () => {
    const testSchema = z.object({
      name: z.string().trim().min(1, "Informe o nome"),
      type: z.string().min(1, "Selecione o tipo"),
      current_stock: z
        .any()
        .transform((v) => parseBRDecimal(v) ?? 0)
        .pipe(z.number().min(0)),
      min_stock: z
        .any()
        .transform((v) => parseBRDecimal(v) ?? 0)
        .pipe(z.number().min(0)),
      price_cost: z
        .any()
        .transform((v) => parseBRDecimal(v))
        .pipe(z.number().min(0).optional()),
      price_sale: z
        .any()
        .transform((v) => parseBRDecimal(v))
        .pipe(z.number().min(0).optional()),
    });

    const validResult = testSchema.safeParse({
      name: "Trufa de Maracujá",
      type: "Produto Final",
      current_stock: "150,5",
      min_stock: "20",
      price_cost: "0,45",
      price_sale: "0,80",
    });

    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.current_stock).toBe(150.5);
      expect(validResult.data.price_cost).toBe(0.45);
      expect(validResult.data.price_sale).toBe(0.8);
    }
  });

  it("should correctly identify Postgres products_type_check error", () => {
    const error1 = {
      message: 'new row for relation "products" violates check constraint "products_type_check"',
      code: "23514",
    };
    const error2 = {
      message: "some other constraint failed",
      code: "23514",
    };
    const error3 = {
      message: "violates check constraint products_type_check",
    };
    const harmlessError = {
      message: "Network error",
    };

    expect(isProductsTypeCheckError(error1)).toBe(true);
    expect(isProductsTypeCheckError(error2)).toBe(true);
    expect(isProductsTypeCheckError(error3)).toBe(true);
    expect(isProductsTypeCheckError(harmlessError)).toBe(false);
  });

  it("should encode and resolve product classification fallback seamlessly", () => {
    // 1. Encoding fallback when DB has old check constraint
    const encoded = encodeProductClassificationFallback({
      type: "Embalagem",
      category: "Caixas e Pacotes",
    });

    expect(encoded.type).toBe("Matéria-Prima"); // Satisfies DB constraint!
    expect(encoded.category).toBe("[Tipo: Embalagem] Caixas e Pacotes");

    // 2. Resolving fallback back to original classification
    const resolved = resolveProductClassification({
      type: encoded.type,
      category: encoded.category,
    });

    expect(resolved.type).toBe("Embalagem");
    expect(resolved.category).toBe("Caixas e Pacotes");

    // 3. Directly saved type (when DB constraint is updated/dropped)
    const directResolved = resolveProductClassification({
      type: "Utensílio / Ferramenta",
      category: "Formas de Chocolate",
    });

    expect(directResolved.type).toBe("Utensílio / Ferramenta");
    expect(directResolved.category).toBe("Formas de Chocolate");
  });

  it("should ensure finished products (Produto Final) do not trigger purchase/replenishment alerts", () => {
    const products = [
      {
        id: "1",
        name: "Trufa Don Juan Tradicional",
        type: "Produto Final",
        current_stock: 0,
        min_stock: 0,
        price_cost: 0.65,
      },
      {
        id: "2",
        name: "Trufa Maracujá 45g",
        type: "Produto Final",
        current_stock: 5,
        min_stock: 20, // Antigo min_stock herdado
        price_cost: 0.70,
      },
      {
        id: "3",
        name: "Cacau em Pó 100%",
        type: "Matéria-Prima",
        current_stock: 2,
        min_stock: 10,
        price_cost: 45.0,
      },
      {
        id: "4",
        name: "Caixa Padrão Don Juan",
        type: "Embalagem",
        current_stock: 15,
        min_stock: 100,
        price_cost: 1.20,
      },
      {
        id: "5",
        name: "Fita Decorativa Dourada",
        type: "Embalagem",
        current_stock: 0,
        min_stock: 0, // Sem estoque mínimo configurado
        price_cost: 0.50,
      },
    ];

    // Função de filtro de reposição/alerta de compra
    const purchaseAlerts = products.filter((p) => {
      const resolved = resolveProductClassification(p);
      if (resolved.type === "Produto Final") return false;
      const min = Number(p.min_stock ?? 0);
      if (min <= 0) return false;
      return Number(p.current_stock) <= min;
    });

    // Apenas Cacau (Matéria-Prima) e Caixa (Embalagem) devem gerar alerta de compra
    expect(purchaseAlerts).toHaveLength(2);
    expect(purchaseAlerts.map((p) => p.name)).toEqual([
      "Cacau em Pó 100%",
      "Caixa Padrão Don Juan",
    ]);

    // Trufas (Produto Final) nunca devem aparecer em alertas de compra
    const finishedAlerts = purchaseAlerts.filter((p) => p.type === "Produto Final");
    expect(finishedAlerts).toHaveLength(0);
  });
});
