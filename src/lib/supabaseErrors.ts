import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "sonner";

export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as Partial<PostgrestError> & { message?: string };
  if (e?.code === "23503") return true;
  const msg = String(e?.message ?? "");
  return msg.includes("23503") || msg.toLowerCase().includes("foreign key");
}

export function toastDeleteBlocked(context?: string) {
  const suffix = context ? ` (${context})` : "";
  toast.error(
    `Exclusão bloqueada: Este item possui movimentações${suffix}. Cancele as vendas/compras associadas antes de excluir.`,
  );
}
