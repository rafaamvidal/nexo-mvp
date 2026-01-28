export type ProductType = "Matéria-Prima" | "Produto Final";
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
