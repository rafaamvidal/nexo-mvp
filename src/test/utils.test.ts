import { describe, it, expect } from "vitest";
import { cleanDigits, maskCpfCnpj, maskPhone, maskCep, formatBRL, getWhatsAppUrl, formatDateBR } from "@/lib/masks";

describe("lib/masks", () => {
  it("cleanDigits should extract only numbers", () => {
    expect(cleanDigits("123.456.789-00")).toBe("12345678900");
    expect(cleanDigits(null)).toBe("");
    expect(cleanDigits(undefined)).toBe("");
  });

  it("maskCpfCnpj should format CPF correctly", () => {
    expect(maskCpfCnpj("12345678901")).toBe("123.456.789-01");
  });

  it("maskCpfCnpj should format CNPJ correctly", () => {
    expect(maskCpfCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("maskPhone should format 10 and 11 digit phones", () => {
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
    expect(maskPhone("11988887777")).toBe("(11) 98888-7777");
  });

  it("maskCep should format 8-digit CEP", () => {
    expect(maskCep("01310100")).toBe("01310-100");
  });

  it("formatBRL should format Brazilian Real currency", () => {
    const formatted = formatBRL(1234.56);
    expect(formatted).toContain("1.234,56");
  });

  it("getWhatsAppUrl should build wa.me links with DDI 55", () => {
    const url = getWhatsAppUrl("11999998888", "Olá");
    expect(url).toBe("https://wa.me/5511999998888?text=Ol%C3%A1");

    const nullUrl = getWhatsAppUrl("123");
    expect(nullUrl).toBeNull();
  });

  it("formatDateBR should format YYYY-MM-DD correctly without timezone day subtraction", () => {
    // Caso exato relatado pelo usuário: 2026-09-21 não pode virar 20/09/2026
    expect(formatDateBR("2026-09-21")).toBe("21/09/2026");
    expect(formatDateBR("2024-02-15")).toBe("15/02/2024");
    expect(formatDateBR("2026-01-01")).toBe("01/01/2026");
    expect(formatDateBR("2026-09-21T00:00:00")).toBe("21/09/2026");
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR(undefined)).toBe("—");
    expect(formatDateBR("")).toBe("—");
  });
});
