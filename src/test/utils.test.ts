import { describe, it, expect } from "vitest";
import { cleanDigits, maskCpfCnpj, maskPhone, maskCep, formatBRL, getWhatsAppUrl } from "@/lib/masks";

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
});
