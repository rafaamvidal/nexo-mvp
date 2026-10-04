export const PRODUCT_TYPES = [
  "Produto Final",
  "Matéria-Prima",
  "Embalagem",
  "Rótulo / Etiqueta",
  "Insumo de Produção",
  "Utensílio / Ferramenta",
  "Limpeza e Higiene",
  "Material de Apoio",
  "Outro",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number] | (string & {});
export type MovementType = "Entrada" | "Saída";

export type ProductRow = {
  id: string;
  name: string;
  type: ProductType;
  current_stock: number;
  min_stock: number;
  unit: string;
  created_at: string;
};
