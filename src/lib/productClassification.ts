import { PRODUCT_TYPES, type ProductType } from "@/types/inventory";

/**
 * Normaliza e resolve o tipo real do produto.
 * Se o banco de dados ainda estiver com a restrição antiga (products_type_check),
 * o tipo é recuperado do marcador [Tipo: ...] salvo em category.
 */
export function resolveProductClassification(product: {
  type?: string | null;
  category?: string | null;
}): {
  type: ProductType;
  category: string | null;
} {
  const rawType = (product.type ?? "").trim();
  const rawCat = (product.category ?? "").trim();

  // Se o tipo no banco já for uma das classificações específicas (diferente das 2 antigas padrão)
  if (
    rawType &&
    rawType !== "Matéria-Prima" &&
    rawType !== "Produto Final" &&
    PRODUCT_TYPES.includes(rawType as any)
  ) {
    return {
      type: rawType as ProductType,
      category: rawCat || null,
    };
  }

  // Se houver marcador na categoria: [Tipo: Embalagem] Minha Categoria
  const match = rawCat.match(/^\[Tipo:\s*([^\]]+)\]\s*(.*)$/i);
  if (match) {
    const extractedType = match[1].trim() as ProductType;
    const cleanCategory = match[2].trim();
    return {
      type: extractedType,
      category: cleanCategory || null,
    };
  }

  return {
    type: (rawType as ProductType) || "Produto Final",
    category: rawCat || null,
  };
}

/**
 * Codifica a classificação do produto para persistência compatível com bancos legados.
 */
export function encodeProductClassificationFallback(params: {
  type: string;
  category?: string | null;
}) {
  const isFinal = params.type === "Produto Final";
  const safeType = isFinal ? "Produto Final" : "Matéria-Prima";
  const cat = (params.category ?? "").trim();

  // Se for o tipo base, não precisa de prefixo
  if (params.type === "Produto Final" || params.type === "Matéria-Prima") {
    return {
      type: safeType,
      category: cat || null,
    };
  }

  // Se for novo tipo (Embalagem, Rótulo, Utensílio etc.), codifica marcador
  const cleanCat = cat.replace(/^\[Tipo:\s*[^\]]+\]\s*/i, "").trim();
  const fallbackCat = cleanCat ? `[Tipo: ${params.type}] ${cleanCat}` : `[Tipo: ${params.type}]`;

  return {
    type: safeType,
    category: fallbackCat,
  };
}

/**
 * Verifica se um erro do PostgreSQL refere-se à restrição products_type_check.
 */
export function isProductsTypeCheckError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.details || "");
  const code = String(error.code || "");
  return (
    code === "23514" ||
    msg.includes("products_type_check") ||
    msg.includes("violates check constraint")
  );
}
