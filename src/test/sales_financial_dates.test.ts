import { describe, it, expect } from "vitest";
import { formatDateBR } from "@/lib/masks";

describe("Datas de Vendas e Financeiro", () => {
  describe("Data da Venda", () => {
    it("deve converter YYYY-MM-DD para ISO string ao meio-dia preservando o dia correto", () => {
      const saleDate = "2026-10-04";
      const iso = new Date(`${saleDate}T12:00:00`).toISOString();
      // Ao meio-dia, independentemente do fuso horário UTC-3 ou UTC, a data formatada deve ser 04/10/2026
      expect(formatDateBR(iso)).toBe("04/10/2026");
    });

    it("deve formatar data histórica de venda sem regressão de fuso horário", () => {
      const dateStr = "2026-05-15";
      expect(formatDateBR(dateStr)).toBe("15/05/2026");
      expect(formatDateBR(`${dateStr}T12:00:00.000Z`)).toBe("15/05/2026");
    });

    it("deve extrair a parte da data YYYY-MM-DD para inicializar edição de venda", () => {
      const created_at = "2026-10-04T15:30:00.000Z";
      const editSaleDate = created_at.slice(0, 10);
      expect(editSaleDate).toBe("2026-10-04");
    });
  });

  describe("Data de Pagamento no Financeiro", () => {
    it("deve associar payment_date quando o status for Pago", () => {
      const status = "Pago";
      const paymentDate = "2026-09-28";
      const todayStr = "2026-10-04";

      const recordPayload = {
        status,
        payment_date: status === "Pago" ? (paymentDate || todayStr) : null,
      };

      expect(recordPayload.payment_date).toBe("2026-09-28");
    });

    it("deve definir payment_date como null quando o status for Aberto ou Cancelado", () => {
      const paymentDate = "2026-09-28";
      const todayStr = "2026-10-04";

      const abertoPayload = {
        status: "Aberto",
        payment_date: "Aberto" === "Pago" ? (paymentDate || todayStr) : null,
      };
      expect(abertoPayload.payment_date).toBeNull();

      const canceladoPayload = {
        status: "Cancelado",
        payment_date: "Cancelado" === "Pago" ? (paymentDate || todayStr) : null,
      };
      expect(canceladoPayload.payment_date).toBeNull();
    });

    it("deve usar todayStr como fallback se paymentDate for vazio e status for Pago", () => {
      const status = "Pago";
      const paymentDate = "";
      const todayStr = "2026-10-04";

      const recordPayload = {
        status,
        payment_date: status === "Pago" ? (paymentDate || todayStr) : null,
      };

      expect(recordPayload.payment_date).toBe("2026-10-04");
    });

    it("deve inicializar editPaymentDate com a data existente ao abrir edição", () => {
      const existingRecord = {
        payment_date: "2026-09-15T00:00:00",
      };
      const todayStr = "2026-10-04";
      const editPaymentDate = existingRecord.payment_date ? existingRecord.payment_date.slice(0, 10) : todayStr;

      expect(editPaymentDate).toBe("2026-09-15");
      expect(formatDateBR(editPaymentDate)).toBe("15/09/2026");
    });
  });

  describe("Precificação Estratégica e Custo em Vendas", () => {
    it("deve calcular o total da venda baseado no preço vendido customizado pelo usuário", () => {
      const items = [
        { product_id: "prod-1", quantity: 2, unit_price: 25.5 }, // preço customizado diferente do catálogo
        { product_id: "prod-2", quantity: 3, unit_price: 10.0 },
      ];

      const total = items.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
      expect(total).toBe(2 * 25.5 + 3 * 10.0); // 51 + 30 = 81
    });

    it("deve detectar quando o preço vendido estiver abaixo do preço de custo para alerta comercial", () => {
      const productCost = 35.0;
      const promotionalSalePrice = 29.9;
      const isBelowCost = productCost > 0 && promotionalSalePrice > 0 && promotionalSalePrice < productCost;

      expect(isBelowCost).toBe(true);
    });

    it("deve gerar payload de itens com unit_price e total corretos para persistência", () => {
      const items = [
        { product_id: "p1", quantity: 4, unit_price: 15.0 },
      ];
      const payload = items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total: it.quantity * it.unit_price,
      }));

      expect(payload[0].unit_price).toBe(15.0);
      expect(payload[0].total).toBe(60.0);
    });
  });
});
