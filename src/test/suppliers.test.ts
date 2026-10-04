import { describe, it, expect } from "vitest";

export function parseSupplierObservations(obsText: string | null | undefined) {
  let raw = obsText ?? "";
  let fornecedorFornece: string | null = null;
  let vendedorContato: string | null = null;

  const fornecMatch = raw.match(/\[Fornece:\s*([^\]]+)\]/i);
  if (fornecMatch) {
    fornecedorFornece = fornecMatch[1].trim();
    raw = raw.replace(fornecMatch[0], "").trim();
  }

  const vendMatch = raw.match(/\[Vendedor:\s*([^\]]+)\]/i);
  if (vendMatch) {
    vendedorContato = vendMatch[1].trim();
    raw = raw.replace(vendMatch[0], "").trim();
  }

  return {
    suppliedItems: fornecedorFornece,
    contactName: vendedorContato,
    generalObservations: raw,
  };
}

export function formatSupplierObservations(params: {
  suppliedItems?: string | null;
  contactName?: string | null;
  generalObservations?: string | null;
}) {
  const tags: string[] = [];
  if (params.suppliedItems?.trim()) {
    tags.push(`[Fornece: ${params.suppliedItems.trim()}]`);
  }
  if (params.contactName?.trim()) {
    tags.push(`[Vendedor: ${params.contactName.trim()}]`);
  }

  const cleanObs = params.generalObservations?.trim() ?? "";
  if (tags.length > 0) {
    return `${tags.join(" ")} ${cleanObs}`.trim();
  }
  return cleanObs || null;
}

describe("Supplier Metadata & Supplied Items Parsing", () => {
  it("should correctly parse [Fornece: ...] and [Vendedor: ...] and remaining notes", () => {
    const raw = "[Fornece: Embalagens plásticas, Sacos Kraft] [Vendedor: Nicole] Entregar no portão lateral às terças.";
    const result = parseSupplierObservations(raw);

    expect(result.suppliedItems).toBe("Embalagens plásticas, Sacos Kraft");
    expect(result.contactName).toBe("Nicole");
    expect(result.generalObservations).toBe("Entregar no portão lateral às terças.");
  });

  it("should format tags back into clean observations string", () => {
    const formatted = formatSupplierObservations({
      suppliedItems: "Chocolates e Trufas",
      contactName: "Thiago",
      generalObservations: "Pagamento 28 dias",
    });

    expect(formatted).toBe("[Fornece: Chocolates e Trufas] [Vendedor: Thiago] Pagamento 28 dias");
  });

  it("should handle suppliers without contact or supplied items cleanly", () => {
    const parsed = parseSupplierObservations("Apenas uma observação padrão");
    expect(parsed.suppliedItems).toBeNull();
    expect(parsed.contactName).toBeNull();
    expect(parsed.generalObservations).toBe("Apenas uma observação padrão");

    const formatted = formatSupplierObservations({
      generalObservations: "Apenas uma observação padrão",
    });
    expect(formatted).toBe("Apenas uma observação padrão");
  });

  it("should filter suppliers when user searches for what the supplier provides", () => {
    const suppliers = [
      {
        id: "1",
        name: "MJC EMBALAGENS",
        observations: "[Fornece: Caixas de papelão e fitas adesivas]",
      },
      {
        id: "2",
        name: "NEVADO",
        observations: "[Fornece: Chocolates, Coberturas e Recheios]",
      },
      {
        id: "3",
        name: "NEW PRINT",
        observations: "[Fornece: Etiquetas personalizadas Don Juan] [Vendedor: Ney]",
      },
    ];

    const search = (term: string) => {
      const q = term.toLowerCase().trim();
      return suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.observations ?? "").toLowerCase().includes(q)
      );
    };

    // Searching for "papelão"
    expect(search("papelão")).toHaveLength(1);
    expect(search("papelão")[0].name).toBe("MJC EMBALAGENS");

    // Searching for "chocolates"
    expect(search("chocolates")).toHaveLength(1);
    expect(search("chocolates")[0].name).toBe("NEVADO");

    // Searching for "etiquetas"
    expect(search("etiquetas")).toHaveLength(1);
    expect(search("etiquetas")[0].name).toBe("NEW PRINT");

    // Searching for seller "Ney"
    expect(search("Ney")).toHaveLength(1);
    expect(search("Ney")[0].name).toBe("NEW PRINT");
  });
});
