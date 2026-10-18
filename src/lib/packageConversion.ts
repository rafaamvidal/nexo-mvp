/**
 * Utilitários para conversão e controle de Embalagens de Compra (Sacos, Caixas, Baldes, Fardos)
 * vs. Unidade de Estoque e Consumo (kg, g, L, ml, un).
 */

export interface PackageInfo {
  packageName: string; // ex: "Saco", "Caixa", "Balde", "Fardo", "Galão", "Lata", "Pacote", "Outro"
  packageSize: number; // ex: 25 (kg)
  packagePrice: number; // ex: 512.64 (R$)
}

export const COMMON_PACKAGE_TYPES = [
  "Saco",
  "Caixa",
  "Balde",
  "Fardo",
  "Galão",
  "Lata",
  "Pacote",
  "Tambor",
  "Rolo",
  "Outro",
] as const;

/**
 * Calcula o custo unitário (por kg, por litro, por unidade) a partir da embalagem fechada.
 * Exemplo: Saco de 25 kg por R$ 512,64 => 512.64 / 25 = 20.5056 R$/kg
 */
export function calculateUnitCost(packagePrice: number, packageSize: number): number {
  if (!Number.isFinite(packagePrice) || packagePrice <= 0) return 0;
  if (!Number.isFinite(packageSize) || packageSize <= 0) return 0;
  const unitCost = packagePrice / packageSize;
  // Mantém precisão de até 4 casas decimais para cálculo fabril exato
  return Number(unitCost.toFixed(4));
}

/**
 * Calcula o valor financeiro do estoque atual com base no custo unitário.
 * Exemplo: 23 kg * R$ 20.5056/kg = R$ 471.63
 */
export function calculateStockTotal(stock: number, unitCost: number): number {
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  if (!Number.isFinite(unitCost) || unitCost <= 0) return 0;
  return Number((stock * unitCost).toFixed(2));
}

/**
 * Extrai informações de embalagem salvas no texto de descrição do produto.
 * Suporta formatos:
 * - [Embalagem: Saco com 25 kg @ R$ 512,64]
 * - [Embalagem: Caixa com 200]
 * - PKG:{"name":"Caixa","size":200,"price":0}
 * Também reconhece automaticamente "Caixa de 200 un" para produtos da linha Trufa
 * caso ainda não possuam configuração explícita salva.
 */
export function parsePackageMetadata(
  description?: string | null,
  productName?: string | null,
  unit?: string | null
): PackageInfo | null {
  if (description?.includes("PKG:NONE")) {
    return null;
  }

  if (description) {
    // 1. Tenta extrair JSON estruturado PKG:{...}
    const jsonMatch = description.match(/PKG:(\{[^}]+\})/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data && Number(data.size) > 0) {
          return {
            packageName: String(data.name || "Caixa"),
            packageSize: Number(data.size),
            packagePrice: Math.max(0, Number(data.price ?? 0)),
          };
        }
      } catch {
        // continua para regex
      }
    }

    // 2. Tenta extrair formato amigável com preço [Embalagem: Saco com 25 kg @ R$ 512,64]
    const tagMatch = description.match(
      /\[Embalagem:\s*([^\]]+?)\s+com\s+([0-9.,]+)\s*([a-zA-Z]+)?\s*[@|por]\s*R\$\s*([0-9.,]+)\]/i
    );
    if (tagMatch) {
      const rawName = tagMatch[1].trim();
      const rawSize = tagMatch[2].replace(/\./g, "").replace(",", ".");
      const rawPrice = tagMatch[4].replace(/\./g, "").replace(",", ".");
      const size = Number(rawSize);
      const price = Number(rawPrice);
      if (size > 0) {
        return {
          packageName: rawName || "Caixa",
          packageSize: size,
          packagePrice: Math.max(0, Number.isFinite(price) ? price : 0),
        };
      }
    }

    // 3. Tenta extrair formato amigável sem preço [Embalagem: Caixa com 200 un]
    const simpleTagMatch = description.match(
      /\[Embalagem:\s*([^\]]+?)\s+com\s+([0-9.,]+)\s*([a-zA-Z]+)?\]/i
    );
    if (simpleTagMatch) {
      const rawName = simpleTagMatch[1].trim();
      const rawSize = simpleTagMatch[2].replace(/\./g, "").replace(",", ".");
      const size = Number(rawSize);
      if (size > 0) {
        return {
          packageName: rawName || "Caixa",
          packageSize: size,
          packagePrice: 0,
        };
      }
    }
  }

  // 4. Fallback inteligente para produtos "Trufa" medidos em unidades (padrão de fábrica: Caixa c/ 200 un)
  if (productName) {
    const lowerName = productName.toLowerCase();
    const lowerUnit = (unit ?? "un").toLowerCase().trim();
    const isUnitBased = !lowerUnit || lowerUnit === "un" || lowerUnit === "und" || lowerUnit === "unidade";
    if (lowerName.includes("trufa") && isUnitBased) {
      return {
        packageName: "Caixa",
        packageSize: 200,
        packagePrice: 0,
      };
    }
  }

  return null;
}

/**
 * Serializa a informação da embalagem de compra ou armazenamento na descrição do produto,
 * preservando receitas BOM ou notas anteriores existentes.
 */
export function encodePackageMetadata(
  info: PackageInfo | null,
  existingDescription?: string | null,
  options?: { markExplicitNone?: boolean }
): string | null {
  let base = (existingDescription ?? "").trim();

  // Remove tags PKG ou [Embalagem: ...] antigas
  base = base.replace(/PKG:\{[^}]+\}/g, "").trim();
  base = base.replace(/PKG:NONE/g, "").trim();
  base = base.replace(/\[Embalagem:[^\]]+\]/g, "").trim();

  if (!info || !info.packageSize || info.packageSize <= 0) {
    if (options?.markExplicitNone) {
      return base ? `${base} PKG:NONE` : "PKG:NONE";
    }
    return base || null;
  }

  const safePrice = Number.isFinite(info.packagePrice) && info.packagePrice > 0 ? info.packagePrice : 0;

  const jsonTag = `PKG:${JSON.stringify({
    name: info.packageName || "Caixa",
    size: info.packageSize,
    price: safePrice,
  })}`;

  let readableTag: string;
  if (safePrice > 0) {
    const formattedPrice = safePrice.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    readableTag = `[Embalagem: ${info.packageName} com ${info.packageSize} por R$ ${formattedPrice}]`;
  } else {
    readableTag = `[Embalagem: ${info.packageName} com ${info.packageSize}]`;
  }

  const newTag = `${jsonTag} ${readableTag}`;
  return base ? `${base} ${newTag}` : newTag;
}

/**
 * Formata um resumo curto para exibição em tabelas e badges.
 * Ex: "Saco 25kg (R$ 512,64)" ou "Caixa c/ 200 un"
 */
export function formatPackageSummary(info: PackageInfo, unit: string): string {
  if (info.packagePrice > 0) {
    const priceStr = info.packagePrice.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return `${info.packageName} ${info.packageSize}${unit} (${priceStr})`;
  }
  return `${info.packageName} c/ ${info.packageSize} ${unit}`;
}

export function getPackageShortUnit(packageName?: string | null): string {
  const lower = (packageName ?? "Caixa").toLowerCase().trim();
  if (lower.startsWith("caixa") || lower === "cx") return "cx";
  if (lower.startsWith("saco") || lower === "sc") return "sc";
  if (lower.startsWith("pacote") || lower === "pct") return "pct";
  if (lower.startsWith("fardo") || lower === "fd") return "fd";
  if (lower.startsWith("balde") || lower === "bd") return "bd";
  if (lower.startsWith("galão") || lower.startsWith("galao")) return "gl";
  if (lower.startsWith("lata")) return "lt";
  if (lower.startsWith("tambor")) return "tb";
  if (lower.startsWith("rolo")) return "rl";
  return "cx";
}

export interface BoxBreakdown {
  hasBoxes: boolean;
  packageName: string;
  packageShort: string;
  packageSize: number;
  fullBoxes: number;
  looseUnits: number;
  totalBoxesDecimal: number;
  formattedTotalBoxes: string;
  /** Ex: "6 cx + 50 un" ou "6 cx" */
  summaryText: string;
  /** Ex: "Caixa c/ 200 un • Total: 6,25 cx" */
  secondaryText: string;
}

/**
 * Calcula a conversão automática do saldo em unidades para Caixas Fechadas + Unidades Avulsas.
 * Exemplo: 1250 un (Caixa de 200 un) => 6 cx + 50 un (6,25 cx)
 */
export function calculateBoxBreakdown(
  stock: number,
  unit: string,
  pkg: PackageInfo | null | undefined
): BoxBreakdown {
  if (!pkg || !Number.isFinite(pkg.packageSize) || pkg.packageSize <= 1) {
    return {
      hasBoxes: false,
      packageName: "Caixa",
      packageShort: "cx",
      packageSize: 0,
      fullBoxes: 0,
      looseUnits: Number(stock) || 0,
      totalBoxesDecimal: 0,
      formattedTotalBoxes: "0",
      summaryText: "",
      secondaryText: "",
    };
  }

  const safeStock = Math.max(0, Number(stock) || 0);
  const size = Number(pkg.packageSize);
  const packageName = pkg.packageName || "Caixa";
  const packageShort = getPackageShortUnit(packageName);

  const fullBoxes = Math.floor((safeStock + 1e-9) / size);
  const rawRemainder = Math.max(0, safeStock - fullBoxes * size);
  const looseUnits = Number(rawRemainder.toFixed(4));
  const totalBoxesDecimal = Number((safeStock / size).toFixed(2));
  const formattedTotalBoxes = totalBoxesDecimal.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  let summaryText: string;
  if (safeStock === 0) {
    summaryText = `0 ${packageShort}`;
  } else if (looseUnits === 0) {
    summaryText = `${fullBoxes} ${packageShort}`;
  } else if (fullBoxes > 0) {
    summaryText = `${fullBoxes} ${packageShort} + ${looseUnits} ${unit}`;
  } else {
    summaryText = `0 ${packageShort} + ${looseUnits} ${unit} (${formattedTotalBoxes} ${packageShort})`;
  }

  const secondaryText = `${packageName} c/ ${size} ${unit} • Equivale a ${formattedTotalBoxes} ${packageShort}`;

  return {
    hasBoxes: true,
    packageName,
    packageShort,
    packageSize: size,
    fullBoxes,
    looseUnits,
    totalBoxesDecimal,
    formattedTotalBoxes,
    summaryText,
    secondaryText,
  };
}

/**
 * Identifica se um custo informado é atipicamente alto para a unidade do produto,
 * sugerindo que o usuário pode ter informado o valor da embalagem fechada por engano.
 * Exemplo: Custo > R$ 80/kg para matéria-prima ou recheio.
 */
export function hasSuspectedUnitCostAnomaly(
  cost: number | null | undefined,
  unit: string,
  type?: string
): boolean {
  if (!cost || cost <= 0) return false;
  const u = (unit ?? "").toLowerCase().trim();
  const t = (type ?? "").toLowerCase().trim();

  // Produtos finais podem ter valor alto. Checamos matérias-primas e insumos:
  const isRawOrSupply =
    !t ||
    t.includes("matéria") ||
    t.includes("materia") ||
    t.includes("insumo") ||
    t.includes("embalagem");

  if (!isRawOrSupply) return false;

  // Se a unidade for kg e o custo > R$ 80,00/kg
  if (u === "kg" && cost >= 80) return true;
  // Se a unidade for g e o custo > R$ 1,00/g
  if (u === "g" && cost >= 1) return true;
  // Se a unidade for L e o custo > R$ 100,00/L
  if (u === "l" && cost >= 100) return true;

  return false;
}
