import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  History,
  Package,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateUnitCost, COMMON_PACKAGE_TYPES } from "@/lib/packageConversion";
import { formatBRL, formatDateBR } from "@/lib/masks";
import {
  computeSeasonalityMetrics,
  deletePriceHistory,
  fetchProductPriceHistory,
  insertPriceHistory,
} from "@/lib/priceHistoryApi";
import type { PriceHistoryRecord } from "@/types/priceHistory";

interface PriceHistoryDialogProps {
  productId: string;
  productName: string;
  productUnit: string;
  productType?: string;
  currentCost?: number | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCostUpdated?: (newCost: number) => void;
}

export function PriceHistoryDialog({
  productId,
  productName,
  productUnit,
  productType,
  currentCost,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onCostUpdated,
}: PriceHistoryDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (setControlledOpen ?? (() => {})) : setInternalOpen;

  const qc = useQueryClient();
  const { currentOrg } = useOrganization();

  // Estados do formulário de novo registro
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [purchaseDate, setPurchaseDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [costInput, setCostInput] = React.useState("");
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("none");
  const [customSupplierName, setCustomSupplierName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [updateProductCost, setUpdateProductCost] = React.useState(true);

  // Modo embalagem fechada no histórico
  const [isPackagingCalc, setIsPackagingCalc] = React.useState(false);
  const [pkgName, setPkgName] = React.useState("Saco");
  const [pkgSize, setPkgSize] = React.useState("");
  const [pkgPrice, setPkgPrice] = React.useState("");

  // Busca histórico de preços
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["product_price_history", productId, currentOrg?.id],
    queryFn: () => fetchProductPriceHistory(productId, currentOrg?.id),
    enabled: Boolean(productId && open),
  });

  // Busca fornecedores para o dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("id, name").order("name", { ascending: true });
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    enabled: Boolean(open),
  });

  // Métricas calculadas de sazonalidade
  const metrics = React.useMemo(() => computeSeasonalityMetrics(records), [records]);

  // Dados para o gráfico temporal (ordenados do mais antigo para o mais recente)
  const chartData = React.useMemo(() => {
    return [...records]
      .sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())
      .map((r) => ({
        date: formatDateBR(r.purchase_date),
        rawDate: r.purchase_date,
        price: r.unit_price,
        supplier: r.supplier_name || "—",
        package: r.package_name && r.package_size ? `${r.package_name} ${r.package_size}${productUnit}` : null,
      }));
  }, [records, productUnit]);

  // Custo unitário calculado se for embalagem fechada
  const numPkgSize = Number(pkgSize.replace(",", ".")) || 0;
  const numPkgPrice = Number(pkgPrice.replace(",", ".")) || 0;
  const calculatedUnitCost = isPackagingCalc && numPkgSize > 0 && numPkgPrice > 0
    ? calculateUnitCost(numPkgPrice, numPkgSize)
    : Number(costInput.replace(",", ".")) || 0;

  const isFinishedProduct = productType === "Produto Final";

  // Mutação para adicionar novo registro
  const addMutation = useMutation({
    mutationFn: async () => {
      if (calculatedUnitCost <= 0) {
        throw new Error(isFinishedProduct ? "Informe um custo unitário válido maior que zero." : "Informe um valor de compra válido maior que zero.");
      }
      if (!purchaseDate) {
        throw new Error(isFinishedProduct ? "Selecione a data de fabricação." : "Selecione a data da compra.");
      }

      const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
      const supplierName = supplierObj ? supplierObj.name : customSupplierName.trim() || null;

      const record = await insertPriceHistory({
        product_id: productId,
        purchase_date: purchaseDate,
        unit_price: calculatedUnitCost,
        package_price: isPackagingCalc && numPkgPrice > 0 ? numPkgPrice : null,
        package_size: isPackagingCalc && numPkgSize > 0 ? numPkgSize : null,
        package_name: isPackagingCalc ? pkgName : null,
        supplier_id: supplierObj ? supplierObj.id : null,
        supplier_name: supplierName,
        notes: notes.trim() || null,
        source: isFinishedProduct ? "fabricacao" : "manual",
        organization_id: currentOrg?.id,
      });

      // Se solicitado, atualiza também o custo atual do produto
      if (updateProductCost && calculatedUnitCost > 0) {
        await supabase
          .from("products")
          .update({ price_cost: calculatedUnitCost })
          .eq("id", productId);
        onCostUpdated?.(calculatedUnitCost);
      }

      return record;
    },
    onSuccess: async () => {
      toast.success(isFinishedProduct ? "Registro de fabricação adicionado com sucesso!" : "Compra registrada no histórico com sucesso!");
      await qc.invalidateQueries({ queryKey: ["product_price_history", productId] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      // Limpa formulário
      setCostInput("");
      setPkgPrice("");
      setPkgSize("");
      setNotes("");
      setShowAddForm(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? (isFinishedProduct ? "Falha ao registrar histórico de fabricação." : "Falha ao registrar histórico de compra."));
    },
  });

  // Mutação para excluir registro
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deletePriceHistory(id);
    },
    onSuccess: async () => {
      toast.success("Registro removido do histórico.");
      await qc.invalidateQueries({ queryKey: ["product_price_history", productId] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao remover registro.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            title="Histórico de Preços e Sazonalidade"
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {isFinishedProduct ? "Histórico de Fabricação & Custos" : "Histórico de Preços & Sazonalidade"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                <strong className="text-foreground">{productName}</strong>
                <span>•</span>
                <span>Unidade: <strong>{productUnit}</strong></span>
                {productType && (
                  <>
                    <span>•</span>
                    <Badge variant="secondary" className="text-xs">{productType}</Badge>
                  </>
                )}
                {currentCost != null && currentCost > 0 && (
                  <>
                    <span>•</span>
                    <span>Custo atual no cadastro: <strong>{formatBRL(currentCost)}/{productUnit}</strong></span>
                  </>
                )}
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant={showAddForm ? "outline" : "hero"}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? "Fechar Formulário" : (isFinishedProduct ? "Nova Fabricação / Lote" : "Nova Compra / Cotação")}
            </Button>
          </div>
        </DialogHeader>

        {/* FORMULÁRIO DE ADIÇÃO DE COMPRA / COTAÇÃO */}
        {showAddForm && (
          <div className="my-3 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                {isFinishedProduct ? "Registrar Nova Fabricação ou Lote Histórico" : "Registrar Nova Compra ou Cotação Histórica"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isFinishedProduct ? "Permite lançar produções atuais ou retroativas" : "Permite lançar compras atuais ou retroativas"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* DATA DA COMPRA / FABRICAÇÃO */}
              <div className="sm:col-span-4 grid gap-1">
                <Label htmlFor="purchase_date" className="text-xs font-semibold">
                  {isFinishedProduct ? "Data de Fabricação *" : "Data da Compra / Cotação *"}
                </Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* FORNECEDOR */}
              <div className="sm:col-span-4 grid gap-1">
                <Label htmlFor="supplier" className="text-xs font-semibold">
                  Fornecedor (Opcional)
                </Label>
                {suppliers.length > 0 ? (
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger id="supplier" className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Nenhum / Não informado</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="supplier"
                    placeholder="Nome do fornecedor"
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                )}
              </div>

              {/* MODO DE CUSTO */}
              <div className="sm:col-span-4 flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs gap-1 border-primary/40 bg-background"
                  onClick={() => setIsPackagingCalc(!isPackagingCalc)}
                >
                  <Package className="h-3.5 w-3.5 text-primary" />
                  {isPackagingCalc ? "Informar Preço Direto" : "Calcular por Embalagem"}
                </Button>
              </div>
            </div>

            {/* SE MODO EMBALAGEM FECHADA */}
            {isPackagingCalc ? (
              <div className="rounded-lg border border-border/70 bg-background p-3 space-y-2">
                <div className="text-xs font-semibold text-foreground">
                  Embalagem Fechada do Fornecedor (Saco, Caixa, Balde)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4 grid gap-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={pkgName} onValueChange={setPkgName}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_PACKAGE_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-4 grid gap-1">
                    <Label className="text-xs">Conteúdo ({productUnit})</Label>
                    <Input
                      placeholder="Ex: 25"
                      value={pkgSize}
                      onChange={(e) => setPkgSize(e.target.value)}
                      className="h-8 text-xs"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="sm:col-span-4 grid gap-1">
                    <Label className="text-xs">Preço Pago (R$)</Label>
                    <Input
                      placeholder="Ex: 512,64"
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(e.target.value)}
                      className="h-8 text-xs"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                {calculatedUnitCost > 0 && (
                  <div className="text-xs text-primary font-bold pt-1">
                    Custo por {productUnit}: {formatBRL(calculatedUnitCost)} / {productUnit}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6 grid gap-1">
                  <Label htmlFor="unit_cost" className="text-xs font-semibold">
                    Preço de Custo (R$ por 1 {productUnit}) *
                  </Label>
                  <Input
                    id="unit_cost"
                    placeholder="Ex: 20,51"
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                    className="h-8 text-xs bg-background font-semibold"
                    inputMode="decimal"
                  />
                </div>
                <div className="sm:col-span-6 grid gap-1">
                  <Label htmlFor="notes" className="text-xs font-semibold">
                    {isFinishedProduct ? "Lote / Detalhes da Fabricação (Opcional)" : "Observações / Época (Opcional)"}
                  </Label>
                  <Input
                    id="notes"
                    placeholder={
                      isFinishedProduct
                        ? "Ex: Lote 01, Turno matinal, Produção especial..."
                        : "Ex: Safra de verão, Distribuidor X, Promoção..."
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            )}

            {/* CHECKBOX E SALVAR */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={updateProductCost}
                  onChange={(e) => setUpdateProductCost(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Atualizar também o custo atual do produto no cadastro para este valor</span>
              </label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending || calculatedUnitCost <= 0}
                  className="h-8 text-xs font-semibold"
                >
                  {addMutation.isPending ? "Salvando…" : "Salvar no Histórico"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MÉTRICAS DE SAZONALIDADE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-2">
          {/* MENOR PREÇO (ÉPOCA BARATA) */}
          <Card className="glass border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Melhor Preço (Safra / Época Barata)
                </CardTitle>
                <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {metrics.lowestPrice ? formatBRL(metrics.lowestPrice.price) : "—"}
                {metrics.lowestPrice && <span className="text-xs font-normal text-muted-foreground">/{productUnit}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {metrics.lowestPrice ? `Registrado em: ${formatDateBR(metrics.lowestPrice.date)}` : "Sem dados"}
              </p>
            </CardContent>
          </Card>

          {/* MAIOR PREÇO (ÉPOCA CARA / PICO) */}
          <Card className="glass border-rose-500/30 bg-rose-500/5">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Maior Preço (Entressafra / Pico)
                </CardTitle>
                <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                {metrics.highestPrice ? formatBRL(metrics.highestPrice.price) : "—"}
                {metrics.highestPrice && <span className="text-xs font-normal text-muted-foreground">/{productUnit}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {metrics.highestPrice ? `Registrado em: ${formatDateBR(metrics.highestPrice.date)}` : "Sem dados"}
              </p>
            </CardContent>
          </Card>

          {/* PREÇO MÉDIO */}
          <Card className="glass border-border/60">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Preço Médio Anual
                </CardTitle>
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-lg font-black text-foreground">
                {metrics.averagePrice > 0 ? formatBRL(metrics.averagePrice) : "—"}
                {metrics.averagePrice > 0 && <span className="text-xs font-normal text-muted-foreground">/{productUnit}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {metrics.totalPurchases} compra(s) registrada(s)
              </p>
            </CardContent>
          </Card>

          {/* VARIAÇÃO RECENTE */}
          <Card className="glass border-border/60">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Variação vs Compra Anterior
                </CardTitle>
                {metrics.recentVariationPct != null && metrics.recentVariationPct > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
                ) : metrics.recentVariationPct != null && metrics.recentVariationPct < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-lg font-black">
                {metrics.recentVariationPct != null ? (
                  <span
                    className={
                      metrics.recentVariationPct > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : metrics.recentVariationPct < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {metrics.recentVariationPct > 0 ? `+${metrics.recentVariationPct}%` : `${metrics.recentVariationPct}%`}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm font-normal">Primeira compra</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {metrics.recentVariationPct != null && metrics.recentVariationPct > 0
                  ? "Aumento de custo"
                  : metrics.recentVariationPct != null && metrics.recentVariationPct < 0
                  ? "Economia / Queda de custo"
                  : "Sem variação anterior"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* GRÁFICO TEMPORAL DE SAZONALIDADE */}
        {chartData.length >= 2 && (
          <Card className="glass border-border/60 mt-3 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Evolução Temporal do Custo por {productUnit}
              </span>
              <span className="text-xs text-muted-foreground">
                Identifique as melhores épocas de compra do ano
              </span>
            </div>

            <div className="h-52 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    tickFormatter={(val) => `R$${val}`}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => [`${formatBRL(Number(val))}/${productUnit}`, "Custo Unitário"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#priceGradient)"
                    dot={{ r: 4, fill: "#10b981" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* TABELA DE REGISTROS CRONOLÓGICOS */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Histórico de Compras Registradas ({records.length})
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico...</div>
          ) : records.length === 0 ? (
            <Card className="glass p-8 text-center space-y-2">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-semibold">Nenhuma compra com data registrada ainda</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Registre a data e o valor das compras para acompanhar as oscilações de preço e descobrir as épocas mais baratas do ano.
              </p>
              <Button
                type="button"
                variant="hero"
                size="sm"
                onClick={() => {
                  if (currentCost && currentCost > 0) {
                    setCostInput(currentCost.toString());
                  }
                  setShowAddForm(true);
                }}
                className="mt-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Registrar Primeira Compra
              </Button>
            </Card>
          ) : (
            <Card className="glass overflow-hidden rounded-xl border border-border/60">
              <Table containerClassName="max-h-[300px] overflow-y-auto">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur shadow-sm [&_th]:bg-card/95">
                  <TableRow>
                    <TableHead>Data da Compra</TableHead>
                    <TableHead className="text-right">Custo Unitário</TableHead>
                    <TableHead>Embalagem de Compra</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Variação</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r, idx) => {
                    // Variação em relação ao registro seguinte na lista ordenada desc (ou seja, a compra imediatamente anterior)
                    const prevRecord = records[idx + 1];
                    let diffPct: number | null = null;
                    if (prevRecord && prevRecord.unit_price > 0) {
                      diffPct = Number((((r.unit_price - prevRecord.unit_price) / prevRecord.unit_price) * 100).toFixed(1));
                    }

                    const isLowest = metrics.lowestPrice && r.unit_price === metrics.lowestPrice.price;
                    const isHighest = metrics.highestPrice && r.unit_price === metrics.highestPrice.price && metrics.lowestPrice?.price !== metrics.highestPrice?.price;

                    return (
                      <TableRow key={r.id} className="odd:bg-muted/20">
                        <TableCell className="font-semibold text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{formatDateBR(r.purchase_date)}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-bold text-xs whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{formatBRL(r.unit_price)}/{productUnit}</span>
                            {isLowest && (
                              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] py-0 px-1 border border-emerald-500/30">
                                Mais barato
                              </Badge>
                            )}
                            {isHighest && (
                              <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] py-0 px-1 border border-rose-500/30">
                                Mais caro
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.package_name && r.package_size && r.package_price ? (
                            <span>
                              {r.package_name} {r.package_size}{productUnit} @ {formatBRL(r.package_price)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {r.supplier_name || "—"}
                        </TableCell>

                        <TableCell className="text-center text-xs whitespace-nowrap">
                          {diffPct != null ? (
                            <span
                              className={
                                diffPct > 0
                                  ? "text-rose-600 dark:text-rose-400 font-semibold"
                                  : diffPct < 0
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : "text-muted-foreground"
                              }
                            >
                              {diffPct > 0 ? `+${diffPct}% ↑` : `${diffPct}% ↓`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={r.notes || ""}>
                          {r.notes || "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Remover este registro do histórico de preços?")) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Remover registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
