import { describe, it, expect } from "vitest";
import { PRODUCT_TYPES } from "@/types/inventory";
import { parseBRDecimal } from "@/components/inventory/ProductFormSheet";
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

  it("should validate and allow packaging and labels as product types", () => {
    const packaging = {
      name: "Caixa de Papelão 50 un",
      type: "Embalagem",
    };
    const label = {
      name: "Rótulo Adesivo Don Juan",
      type: "Rótulo / Etiqueta",
    };
    const utensil = {
      name: "Forma de Policarbonato Trufa",
      type: "Utensílio / Ferramenta",
    };

    expect(PRODUCT_TYPES.includes(packaging.type as any)).toBe(true);
    expect(PRODUCT_TYPES.includes(label.type as any)).toBe(true);
    expect(PRODUCT_TYPES.includes(utensil.type as any)).toBe(true);
  });
});
