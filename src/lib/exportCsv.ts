/**
 * Utilitário universal para exportação de dados em CSV compatível com Excel (pt-BR).
 * Utiliza delimitador ponto-e-vírgula (;) e BOM UTF-8 (\uFEFF) para garantir
 * correta exibição de caracteres acentuados no Excel do Windows/Mac.
 */

export interface ExportCsvOptions {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export function exportToCsv({ filename, headers, rows }: ExportCsvOptions): void {
  const sanitizeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    // Escapar aspas duplas internas duplicando-as
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(";");
  const dataLines = rows.map((row) => row.map(sanitizeCell).join(";"));

  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
