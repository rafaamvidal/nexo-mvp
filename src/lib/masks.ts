/**
 * Utilitários de máscaras brasileiras para documentos, contatos e endereços.
 */

export function cleanDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function maskCpfCnpj(value: string | null | undefined): string {
  const digits = cleanDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string | null | undefined): string {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    // Fixo ou celular antigo: (00) 0000-0000
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  // Celular com 9 dígitos: (00) 00000-0000
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCep(value: string | null | undefined): string {
  const digits = cleanDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatBRL(value: number | null | undefined): string {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isNaN(num) ? 0 : num
  );
}

export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = cleanDigits(phone);
  if (!digits || digits.length < 10) return null;
  // Se não tiver DDI 55, adiciona
  const fullNumber = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const url = new URL(`https://wa.me/${fullNumber}`);
  if (text) {
    url.searchParams.set("text", text);
  }
  return url.toString();
}

/**
 * Formata data para o padrão brasileiro (DD/MM/AAAA).
 * Trata strings no formato YYYY-MM-DD diretamente por partes,
 * evitando a conversão indesejada de fuso horário UTC -> UTC-3
 * que diminui 1 dia da data selecionada pelo usuário.
 */
export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "—";

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return "—";

    // Padrão YYYY-MM-DD (data pura sem hora, ou com meia-noite T00:00:00)
    const matchDateOnly = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchDateOnly) {
      if (clean.length === 10 || clean.includes("T00:00:00") || clean.includes(" 00:00:00")) {
        const [, y, m, d] = matchDateOnly;
        return `${d}/${m}/${y}`;
      }
    }

    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString("pt-BR");
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    return value.toLocaleDateString("pt-BR");
  }

  return String(value);
}

