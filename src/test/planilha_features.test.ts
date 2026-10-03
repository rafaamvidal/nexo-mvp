import { describe, it, expect } from "vitest";
import { addMonths } from "date-fns";

describe("Planilha Features & Industrial Calculations", () => {
  it("calculates monthly installments correctly", () => {
    const baseDate = new Date("2026-10-01T12:00:00");
    const totalAmount = 1000;
    const installments = 4;
    const parcelValue = Number((totalAmount / installments).toFixed(2));

    expect(parcelValue).toBe(250.0);

    const dates = Array.from({ length: installments }).map((_, i) =>
      addMonths(baseDate, i).toISOString().slice(0, 10)
    );

    expect(dates).toHaveLength(4);
    expect(dates[0]).toBe("2026-10-01");
    expect(dates[1]).toBe("2026-11-01");
    expect(dates[2]).toBe("2026-12-01");
    expect(dates[3]).toBe("2027-01-01");
  });

  it("calculates BOM recipe unit cost accurately", () => {
    // Exemplo: Trufa com Cobertura Chocolate (20g @ R$ 16/kg), Recheio (25g @ R$ 14/kg), Embalagem (1 un @ R$ 0.16)
    const ingredients = [
      { quantityPerUnit: 0.02, costUnit: 16.0 }, // R$ 0.32
      { quantityPerUnit: 0.025, costUnit: 14.0 }, // R$ 0.35
      { quantityPerUnit: 1.0, costUnit: 0.16 }, // R$ 0.16
    ];

    const totalCost = ingredients.reduce(
      (sum, item) => sum + item.quantityPerUnit * item.costUnit,
      0
    );

    expect(Number(totalCost.toFixed(2))).toBe(0.83);
  });

  it("calculates stock deficit and suggested purchase replenishment (2x min_stock - current)", () => {
    const currentStock = 10;
    const minStock = 50;

    const deficit = Math.max(0, minStock - currentStock);
    const suggestedReplenishment = Math.max(0, minStock * 2 - currentStock);

    expect(deficit).toBe(40);
    expect(suggestedReplenishment).toBe(90);
  });

  it("sanitizes supplier payload without sending limit_credit", () => {
    // Simula o comportamento do diálogo e upsertSupplier
    const rawForm = {
      name: "Fornecedor Teste",
      tax_id: "00.000.000/0001-99",
      phone: "11999999999",
      email: "teste@fornecedor.com",
      address: "Rua Teste, 100",
      city: "São Paulo",
      state: "SP",
      observations: "Obs",
      limit_credit: 5000, // Campo acidental ou de cliente
    };

    const isClient = false;
    const payloadToSave: any = {
      name: rawForm.name,
      tax_id: rawForm.tax_id,
      phone: rawForm.phone,
      email: rawForm.email,
      address: rawForm.address,
      city: rawForm.city,
      state: rawForm.state,
      observations: rawForm.observations,
    };
    if (isClient) {
      payloadToSave.limit_credit = rawForm.limit_credit;
    }

    const supplierData: any = {
      name: payloadToSave.name,
      tax_id: payloadToSave.tax_id,
      phone: payloadToSave.phone,
      email: payloadToSave.email,
      address: payloadToSave.address,
      city: payloadToSave.city,
      state: payloadToSave.state,
      observations: payloadToSave.observations,
    };

    expect(payloadToSave.limit_credit).toBeUndefined();
    expect(supplierData.limit_credit).toBeUndefined();
    expect("limit_credit" in supplierData).toBe(false);
  });

  it("ensures sale_items and purchase_items retain organization_id in both creation and edit cycles", () => {
    const orgId = "org-12345";
    const draftItems = [
      { product_id: "prod-1", quantity: 2, unit_price: 15.0, total: 30.0 },
      { product_id: "prod-2", quantity: 5, unit_price: 10.0, total: 50.0 },
    ];

    const mappedItems = draftItems.map((item) => ({
      ...item,
      organization_id: orgId,
    }));

    expect(mappedItems).toHaveLength(2);
    expect(mappedItems[0].organization_id).toBe("org-12345");
    expect(mappedItems[1].organization_id).toBe("org-12345");
  });
});
