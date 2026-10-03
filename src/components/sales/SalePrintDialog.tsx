import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Printer, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, getWhatsAppUrl, maskCpfCnpj, maskPhone } from "@/lib/masks";
import { toast } from "sonner";

interface SalePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}

export function SalePrintDialog({ open, onOpenChange, saleId }: SalePrintDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["sale_details_print", saleId],
    queryFn: async () => {
      if (!saleId) return null;
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .select(`
          id,
          code,
          created_at,
          status,
          total_amount,
          gross_amount,
          discount_amount,
          payment_method,
          observations,
          clients (
            name,
            tax_id,
            phone,
            address,
            city,
            state
          )
        `)
        .eq("id", saleId)
        .single();
      if (saleErr) throw saleErr;

      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          unit_price,
          total,
          products (
            name,
            unit,
            sku
          )
        `)
        .eq("sale_id", saleId);
      if (itemsErr) throw itemsErr;

      return {
        ...sale,
        items: items ?? [],
      };
    },
    enabled: !!saleId && open,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    if (!data) return;
    const clientName = (data.clients as any)?.name ?? "Cliente";
    const dateFormatted = format(new Date(data.created_at), "dd/MM/yyyy HH:mm");
    const itemsText = (data.items as any[])
      .map(
        (it) =>
          `• ${it.quantity}x ${it.products?.name ?? "Item"} - ${formatBRL(it.unit_price)} = ${formatBRL(it.total)}`
      )
      .join("\n");

    const text = `*PEDIDO / COMPROVANTE AGILIX*\n` +
      `Código: #${data.code ?? data.id.slice(0, 8)}\n` +
      `Data: ${dateFormatted}\n` +
      `Cliente: ${clientName}\n\n` +
      `*Itens:*\n${itemsText}\n\n` +
      `*Total: ${formatBRL(data.total_amount)}*\n` +
      `Status: ${data.status}\n` +
      (data.payment_method ? `Forma de Pagto: ${data.payment_method}\n` : "") +
      `\nObrigado pela preferência!`;

    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado para a área de transferência!");
  };

  const clientPhone = (data?.clients as any)?.phone;
  const clientName = (data?.clients as any)?.name ?? "Cliente";
  const whatsappUrl = React.useMemo(() => {
    if (!data || !clientPhone) return null;
    const text = `Olá ${clientName}, segue o comprovante do seu pedido #${data.code ?? data.id.slice(0, 8)} no valor de ${formatBRL(data.total_amount)}.`;
    return getWhatsAppUrl(clientPhone, text);
  }, [data, clientPhone, clientName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl print:max-h-none print:w-full print:border-none print:shadow-none print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            <span>Comprovante de Venda</span>
            <div className="flex items-center gap-2">
              {whatsappUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                >
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Enviar WhatsApp
                  </a>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleCopySummary} className="gap-1.5">
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button type="button" variant="hero" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!isLoading && data && (
          <div className="print-content space-y-6 py-2 text-foreground">
            {/* Cabeçalho do Comprovante */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">AGILIX ERP</h2>
                <p className="text-xs text-muted-foreground">Sistema de Gestão Empresarial Inteligente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Data: {format(new Date(data.created_at), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Pedido</span>
                <div className="text-lg font-mono font-bold">#{data.code ?? data.id.slice(0, 8)}</div>
                <div className="mt-1 inline-block rounded border px-2 py-0.5 text-xs font-semibold">
                  Status: {data.status}
                </div>
              </div>
            </div>

            {/* Dados do Cliente */}
            <div className="rounded-lg border bg-muted/15 p-3 text-xs space-y-1">
              <span className="font-bold text-muted-foreground uppercase text-[10px]">Dados do Destinatário</span>
              <div className="font-semibold text-sm">{(data.clients as any)?.name ?? "Consumidor Final"}</div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  CPF/CNPJ: {(data.clients as any)?.tax_id ? maskCpfCnpj((data.clients as any).tax_id) : "—"}
                </div>
                <div>
                  Contato: {(data.clients as any)?.phone ? maskPhone((data.clients as any).phone) : "—"}
                </div>
                {((data.clients as any)?.address || (data.clients as any)?.city) && (
                  <div className="col-span-2">
                    Endereço: {[(data.clients as any)?.address, (data.clients as any)?.city, (data.clients as any)?.state].filter(Boolean).join(" - ")}
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Itens */}
            <div>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Item / Produto</TableHead>
                    <TableHead className="text-center w-20">Qtd</TableHead>
                    <TableHead className="text-right w-28">Preço Un.</TableHead>
                    <TableHead className="text-right w-28">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {(data.items as any[]).map((it, idx) => (
                    <TableRow key={it.id ?? idx}>
                      <TableCell>
                        <span className="font-medium">{it.products?.name ?? "Produto"}</span>
                        {it.products?.sku && (
                          <span className="ml-1 text-[11px] text-muted-foreground font-mono">
                            ({it.products.sku})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {it.quantity} {it.products?.unit ?? ""}
                      </TableCell>
                      <TableCell className="text-right">{formatBRL(it.unit_price)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatBRL(it.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totais */}
            <div className="flex flex-col items-end gap-1 border-t pt-3 text-xs">
              {data.gross_amount && data.discount_amount && data.discount_amount > 0 ? (
                <>
                  <div className="flex justify-between w-48 text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatBRL(data.gross_amount)}</span>
                  </div>
                  <div className="flex justify-between w-48 text-rose-600">
                    <span>Desconto:</span>
                    <span>-{formatBRL(data.discount_amount)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between w-56 text-base font-extrabold border-t pt-1 mt-1">
                <span>TOTAL:</span>
                <span className="text-primary">{formatBRL(data.total_amount)}</span>
              </div>
              {data.payment_method && (
                <div className="text-muted-foreground text-xs mt-1">
                  Forma de Pagamento: <span className="font-semibold text-foreground">{data.payment_method}</span>
                </div>
              )}
            </div>

            {/* Observações */}
            {data.observations && (
              <div className="border-t pt-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Observações: </span>
                {data.observations}
              </div>
            )}

            {/* Rodapé / Assinatura */}
            <div className="border-t pt-8 mt-6 text-center text-[10px] text-muted-foreground">
              <div className="mx-auto w-64 border-t border-dashed border-muted-foreground/40 mb-1" />
              <span>Assinatura do Recebedor</span>
              <p className="mt-2 text-[9px] opacity-75">Comprovante gerado via AGILIX ERP em {format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
