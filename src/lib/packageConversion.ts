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
 * - PKG:{"name":"Saco","size":25,"price":512.64}
 */
export function parsePackageMetadata(description?: string | null): PackageInfo | null {
  if (!description) return null;

  // 1. Tenta extrair JSON estruturado PKG:{...}
  const jsonMatch = description.match(/PKG:(\{[^}]+\})/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      if (data && Number(data.size) > 0 && Number(data.price) > 0) {
        return {
          packageName: String(data.name || "Saco"),
          packageSize: Number(data.size),
          packagePrice: Number(data.price),
        };
      }
    } catch {
      // continua para regex
    }
  }

  // 2. Tenta extrair formato amigável [Embalagem: Saco com 25 kg @ R$ 512,64]
  const tagMatch = description.match(
    /\[Embalagem:\s*([^\]]+?)\s+com\s+([0-9.,]+)\s*([a-zA-Z]+)?\s*[@|por]\s*R\$\s*([0-9.,]+)\]/i
  );
  if (tagMatch) {
    const rawName = tagMatch[1].trim();
    const rawSize = tagMatch[2].replace(/\./g, "").replace(",", ".");
    const rawPrice = tagMatch[4].replace(/\./g, "").replace(",", ".");
    const size = Number(rawSize);
    const price = Number(rawPrice);
    if (size > 0 && price > 0) {
      return {
        packageName: rawName || "Saco",
        packageSize: size,
        packagePrice: price,
      };
    }
  }

  return null;
}

/**
 * Serializa a informação da embalagem de compra na descrição do produto,
 * preservando receitas BOM ou notas anteriores existentes.
 */
export function encodePackageMetadata(
  info: PackageInfo | null,
  existingDescription?: string | null
): string | null {
  let base = (existingDescription ?? "").trim();

  // Remove tags PKG ou [Embalagem: ...] antigas
  base = base.replace(/PKG:\{[^}]+\}/g, "").trim();
  base = base.replace(/\[Embalagem:[^\]]+\]/g, "").trim();

  if (!info || !info.packageSize || !info.packagePrice) {
    return base || null;
  }

  const jsonTag = `PKG:${JSON.stringify({
    name: info.packageName,
    size: info.packageSize,
    price: info.packagePrice,
  })}`;

  const formattedPrice = info.packagePrice.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const readableTag = `[Embalagem: ${info.packageName} com ${info.packageSize} por R$ ${formattedPrice}]`;

  const newTag = `${jsonTag} ${readableTag}`;
  return base ? `${base} ${newTag}` : newTag;
}

/**
 * Formata um resumo curto para exibição em tabelas e badges.
 * Ex: "Saco 25kg (R$ 512,64)"
 */
export function formatPackageSummary(info: PackageInfo, unit: string): string {
  const priceStr = info.packagePrice.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `${info.packageName} ${info.packageSize}${unit} (${priceStr})`;
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
