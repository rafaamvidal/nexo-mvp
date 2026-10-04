import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { saveProductBom, type BomIngredient } from "@/lib/bom";

// DADOS EXTRAÍDOS DIRETAMENTE DA PLANILHA EXCEL DO CLIENTE
const SPREADSHEET_SUPPLIERS = [
  {
    name: "NEW PRINT ETIQUETAS",
    document: "23.362.989/0001-89",
    phone: "19 99699-9326",
    email: "newprintetiquetas@hotmail.com",
    address: "R. Antonio Bertolini, 305 - Jardim São Francisco - Sumaré - SP",
    contact_name: "Ney",
    observations: "[Fornece: Etiquetas personalizadas Don Juan] [Vendedor: Ney]",
  },
  {
    name: "DU PORTO INDUSTRIA ALIMENTICIA LTDA",
    document: "72.845.068/0001-82",
    phone: "15 3262-5050",
    email: "",
    address: "Av. dos Trabalhadores, 800 - Canguera - Porto Feliz - SP",
    contact_name: "Thiago",
    observations: "[Fornece: Ácido Cítrico e Amido de Milho] [Vendedor: Thiago]",
  },
  {
    name: "MJC EMBALAGENS LTDA",
    document: "",
    phone: "",
    email: "",
    address: "",
    contact_name: "",
    observations: "[Fornece: Caixas de Papelão e Embalagens de Transporte]",
  },
  {
    name: "VOGLER",
    document: "62.185.905/0001-30",
    phone: "11 4393-4400",
    email: "nicole.nascimento@vogler.com.br",
    address: "Est. Particular Fukutaro Yida, 1155/1173 - Bairro Cooperativa - São Bernardo do Campo - SP",
    contact_name: "Nicole Silva do Nascimento",
    observations: "[Fornece: Ácido Cítrico, Sorbato de Potássio e Álcool] [Vendedor: Nicole Silva do Nascimento] Tel 2: 11 2626-4424",
  },
  {
    name: "D.A BRASIL DISTRIBUIÇÃO DE ALCOOL CINTIA",
    document: "",
    phone: "11 97221-6156",
    email: "",
    address: "",
    contact_name: "Cintia",
    observations: "[Fornece: Álcool de Cereal] [Vendedor: Cintia]",
  },
  {
    name: "WELINGTON PIZZI",
    document: "",
    phone: "",
    email: "",
    address: "",
    contact_name: "Welington Pizzi",
    observations: "[Fornece: Embalagens especiais] [Vendedor: Welington Pizzi]",
  },
  {
    name: "REDE AMERIPAN FESTAS LTDA",
    document: "04.615.098/0003-04",
    phone: "",
    email: "",
    address: "Av. Governador Pedro de Toledo, 2720 - Bonfim - Campinas - SP",
    contact_name: "",
    observations: "[Fornece: Creme Culinário Bravo e Insumos de Confeitaria]",
  },
  {
    name: "NEVADO",
    document: "",
    phone: "",
    email: "",
    address: "",
    contact_name: "",
    observations: "[Fornece: Chocolates, Coberturas e Recheios Trufados]",
  },
  {
    name: "GLOBAL EMBALAGENS",
    document: "11.227.542/0001-37",
    phone: "",
    email: "",
    address: "Av. Dr. Antonio Pires de Almeida, 880, Centro - Porto Feliz - SP",
    contact_name: "",
    observations: "[Fornece: Utensílios gerais de fábrica e Embalagens]",
  },
];

const SPREADSHEET_RAW_MATERIALS = [
  {
    name: "ETIQUETA DON JUAN",
    type: "Matéria-Prima",
    category: "Embalagens",
    unit: "UN",
    price_cost: 16.0,
    current_stock: 289.6,
    min_stock: 50.0,
  },
  {
    name: "ACIDO CITRICO",
    type: "Matéria-Prima",
    category: "Ingredientes",
    unit: "KG",
    price_cost: 512.64,
    current_stock: 25.0,
    min_stock: 5.0,
  },
  {
    name: "AMIDO DE MILHO",
    type: "Matéria-Prima",
    category: "Ingredientes",
    unit: "KG",
    price_cost: 131.76,
    current_stock: 200.0,
    min_stock: 25.0,
  },
  {
    name: "CAIXA DE PAPELÃO",
    type: "Matéria-Prima",
    category: "Embalagens",
    unit: "UN",
    price_cost: 1.95,
    current_stock: 1586.0,
    min_stock: 200.0,
  },
  {
    name: "CREME CULINÁRIO",
    type: "Matéria-Prima",
    category: "Ingredientes",
    unit: "L",
    price_cost: 6.99,
    current_stock: 750.0,
    min_stock: 50.0,
  },
  {
    name: "COBERTURA SAB. CHOC. AO LEITE VISC 3A4MILCP",
    type: "Matéria-Prima",
    category: "Chocolates",
    unit: "KG",
    price_cost: 16.0,
    current_stock: 750.0,
    min_stock: 100.0,
  },
  {
    name: "RECHEIO BRANCO BASE MOLE",
    type: "Matéria-Prima",
    category: "Recheios",
    unit: "KG",
    price_cost: 280.0,
    current_stock: 420.0,
    min_stock: 50.0,
  },
  {
    name: "LECETINA DE SOJA",
    type: "Matéria-Prima",
    category: "Ingredientes",
    unit: "KG",
    price_cost: 15.0,
    current_stock: 26.0,
    min_stock: 10.0,
  },
  {
    name: "COBERTURA SAB. CHOC. AO LEITE CASQUINHA BRASLEN",
    type: "Matéria-Prima",
    category: "Chocolates",
    unit: "KG",
    price_cost: 16.0,
    current_stock: 25.0,
    min_stock: 25.0,
  },
  {
    name: "UTENSILHOS GERAIS",
    type: "Matéria-Prima",
    category: "Acessórios",
    unit: "UN",
    price_cost: 291.9,
    current_stock: 5.0,
    min_stock: 2.0,
  },
];

const SPREADSHEET_FINISHED_PRODUCTS = [
  { name: "Trufa Maracujá", price_sale: 0.8, price_cost: 0.55, current_stock: 4800, min_stock: 500, category: "Trufas" },
  { name: "Trufa Morango", price_sale: 0.8, price_cost: 0.55, current_stock: 1200, min_stock: 500, category: "Trufas" },
  { name: "Trufa Limão", price_sale: 0.8, price_cost: 0.55, current_stock: 2600, min_stock: 500, category: "Trufas" },
  { name: "Trufa Coco", price_sale: 0.8, price_cost: 0.55, current_stock: 2800, min_stock: 500, category: "Trufas" },
  { name: "Trufa Leite Condensado", price_sale: 0.8, price_cost: 0.55, current_stock: 1200, min_stock: 500, category: "Trufas" },
  { name: "Trufa Beijinho", price_sale: 0.8, price_cost: 0.55, current_stock: 2000, min_stock: 500, category: "Trufas" },
  { name: "Trufa Ninho", price_sale: 0.8, price_cost: 0.55, current_stock: 1000, min_stock: 500, category: "Trufas" },
  { name: "Trufa Brigadeiro", price_sale: 0.8, price_cost: 0.55, current_stock: 1000, min_stock: 500, category: "Trufas" },
  { name: "Trufa Ovomaltine", price_sale: 0.8, price_cost: 0.55, current_stock: 1000, min_stock: 500, category: "Trufas" },
  { name: "Trufa Nutella", price_sale: 0.8, price_cost: 0.55, current_stock: 500, min_stock: 500, category: "Trufas" },
  { name: "Trufa Tradicional", price_sale: 0.8, price_cost: 0.55, current_stock: 500, min_stock: 500, category: "Trufas" },
];

const SPREADSHEET_FINANCIAL_RECORDS = [
  {
    type: "Pagar",
    description: "COMPRA DE 289,60 ETIQUETAS (New Print)",
    category: "MATÉRIA PRIMA",
    amount: 4633.6,
    due_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 25 KG DE ACIDO CITRICO (Du Porto)",
    category: "MATÉRIA PRIMA",
    amount: 512.64,
    due_date: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 200 KG DE AMIDO DE MILHO (Du Porto)",
    category: "MATÉRIA PRIMA",
    amount: 1054.08,
    due_date: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 1586 UNIDADES DE CAIXA DE PAPELÃO (MJC)",
    category: "MATÉRIA PRIMA",
    amount: 3092.7,
    due_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "MENSALIDADE CONTABILIDADE",
    category: "CONTABILIDADE",
    amount: 300.0,
    due_date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 26 KG DE LECETINA DE SOJA (Nevado)",
    category: "MATÉRIA PRIMA",
    amount: 390.0,
    due_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 250 KG DE COBERTURA SAB CHOC (Nevado)",
    category: "MATÉRIA PRIMA",
    amount: 4000.0,
    due_date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10),
    status: "Pago",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 500 KG DE COBERTURA SAB CHOC (Nevado)",
    category: "MATÉRIA PRIMA",
    amount: 8000.0,
    due_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    status: "Aberto",
  },
  {
    type: "Pagar",
    description: "COMPRA DE 400 KG RECHEIO BRANCO BASE MOLE (Nevado)",
    category: "MATÉRIA PRIMA",
    amount: 5600.0,
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    status: "Aberto",
  },
];

export function SpreadsheetDataImporter() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  // Seleções
  const [importSuppliers, setImportSuppliers] = React.useState(true);
  const [importRawMaterials, setImportRawMaterials] = React.useState(true);
  const [importProducts, setImportProducts] = React.useState(true);
  const [importRecipes, setImportRecipes] = React.useState(true);
  const [importFinancial, setImportFinancial] = React.useState(true);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) {
        throw new Error("Selecione uma empresa ativa antes de importar");
      }

      const orgId = currentOrg.id;
      let countSuppliers = 0;
      let countProducts = 0;
      let countFinancial = 0;

      // 1. FORNECEDORES
      if (importSuppliers) {
        const { data: existingSuppliers } = await supabase
          .from("suppliers")
          .select("id,name")
          .eq("organization_id", orgId);

        const existingNames = new Set((existingSuppliers ?? []).map((s) => s.name.toUpperCase().trim()));

        const toInsertSuppliers = SPREADSHEET_SUPPLIERS.filter(
          (s) => !existingNames.has(s.name.toUpperCase().trim())
        ).map((s) => ({
          name: s.name,
          tax_id: s.document || null,
          phone: s.phone || null,
          email: s.email || null,
          address: s.address || null,
          observations: s.observations || null,
          contact_name: s.contact_name || null,
          organization_id: orgId,
        }));

        if (toInsertSuppliers.length > 0) {
          const { error } = await supabase.from("suppliers").insert(toInsertSuppliers);
          if (error) {
            console.warn("Aviso ao inserir fornecedores com contact_name, tentando fallback sem contact_name:", error);
            // Fallback sem contact_name se a coluna ainda não foi criada no Supabase
            const fallbackList = toInsertSuppliers.map(({ contact_name, ...rest }) => rest);
            const { error: errFallback } = await supabase.from("suppliers").insert(fallbackList);
            if (errFallback) throw errFallback;
          }
          countSuppliers = toInsertSuppliers.length;
        }
      }

      // 2. MATÉRIAS-PRIMAS
      const insertedMap = new Map<string, string>(); // nome -> id
      if (importRawMaterials || importProducts || importRecipes) {
        // Obter produtos atuais da empresa
        const { data: currentDbProducts } = await supabase
          .from("products")
          .select("id,name")
          .eq("organization_id", orgId);

        for (const p of currentDbProducts ?? []) {
          insertedMap.set(p.name.toUpperCase().trim(), p.id);
        }
      }

      if (importRawMaterials) {
        const toInsertMP = SPREADSHEET_RAW_MATERIALS.filter(
          (mp) => !insertedMap.has(mp.name.toUpperCase().trim())
        ).map((mp) => ({
          ...mp,
          organization_id: orgId,
          status: "Ativo",
        }));

        if (toInsertMP.length > 0) {
          const { data: createdMP, error } = await supabase
            .from("products")
            .insert(toInsertMP)
            .select("id,name");
          if (error) throw error;
          for (const item of createdMP ?? []) {
            insertedMap.set(item.name.toUpperCase().trim(), item.id);
          }
          countProducts += toInsertMP.length;
        }
      }

      // 3. PRODUTOS ACABADOS (TRUFAS)
      if (importProducts) {
        const toInsertTrufas = SPREADSHEET_FINISHED_PRODUCTS.filter(
          (tp) => !insertedMap.has(tp.name.toUpperCase().trim())
        ).map((tp) => ({
          ...tp,
          type: "Produto Final" as const,
          unit: "UN",
          organization_id: orgId,
          status: "Ativo",
        }));

        if (toInsertTrufas.length > 0) {
          const { data: createdTrufas, error } = await supabase
            .from("products")
            .insert(toInsertTrufas)
            .select("id,name");
          if (error) throw error;
          for (const item of createdTrufas ?? []) {
            insertedMap.set(item.name.toUpperCase().trim(), item.id);
          }
          countProducts += toInsertTrufas.length;
        }
      }

      // 4. RECEITAS AUTOMÁTICAS (FICHA TÉCNICA)
      if (importRecipes) {
        // Encontra IDs das matérias-primas essenciais
        const chocolateId = insertedMap.get("COBERTURA SAB. CHOC. AO LEITE VISC 3A4MILCP");
        const recheioId = insertedMap.get("RECHEIO BRANCO BASE MOLE");
        const etiquetaId = insertedMap.get("ETIQUETA DON JUAN");
        const caixaId = insertedMap.get("CAIXA DE PAPELÃO");

        const sampleIngredients: BomIngredient[] = [
          chocolateId ? { rawMaterialId: chocolateId, quantityPerUnit: 0.02, unit: "KG" } : null,
          recheioId ? { rawMaterialId: recheioId, quantityPerUnit: 0.025, unit: "KG" } : null,
          etiquetaId ? { rawMaterialId: etiquetaId, quantityPerUnit: 1, unit: "UN" } : null,
          caixaId ? { rawMaterialId: caixaId, quantityPerUnit: 0.04, unit: "UN" } : null,
        ].filter(Boolean) as BomIngredient[];

        if (sampleIngredients.length > 0) {
          for (const tp of SPREADSHEET_FINISHED_PRODUCTS) {
            const trufaId = insertedMap.get(tp.name.toUpperCase().trim());
            if (trufaId) {
              await saveProductBom(trufaId, sampleIngredients, orgId);
            }
          }
        }
      }

      // 5. REGISTROS FINANCEIROS HISTÓRICOS
      if (importFinancial) {
        const { data: existingFin } = await supabase
          .from("financial_records")
          .select("description,due_date")
          .eq("organization_id", orgId);

        const existingFinKeys = new Set(
          (existingFin ?? []).map((f) => `${f.description.trim()}_${f.due_date}`)
        );

        const toInsertFin = SPREADSHEET_FINANCIAL_RECORDS.filter(
          (f) => !existingFinKeys.has(`${f.description.trim()}_${f.due_date}`)
        ).map((f) => ({
          ...f,
          organization_id: orgId,
        }));

        if (toInsertFin.length > 0) {
          const { error } = await supabase.from("financial_records").insert(toInsertFin);
          if (error) console.warn("Aviso ao importar histórico financeiro:", error);
          else countFinancial = toInsertFin.length;
        }
      }

      return { countSuppliers, countProducts, countFinancial };
    },
    onSuccess: (res) => {
      toast.success(
        `Importação concluída com sucesso! ${res.countSuppliers} fornecedores, ${res.countProducts} produtos/insumos e ${res.countFinancial} lançamentos inseridos.`
      );
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["financial_records"] });
      qc.invalidateQueries({ queryKey: ["recipe_ingredients"] });
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro durante a importação dos dados.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Dados da Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Carga de Dados da Planilha ERP</DialogTitle>
              <DialogDescription>
                Empresa destino: <strong className="text-foreground">{currentOrg?.name ?? "Nenhuma"}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Selecione quais blocos de dados da planilha de Trufas Don Juan você deseja migrar automaticamente
            para o banco de dados da empresa selecionada. O importador ignora duplicidades se já existirem.
          </p>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="imp-suppliers"
                checked={importSuppliers}
                onCheckedChange={(c) => setImportSuppliers(Boolean(c))}
                className="mt-1"
              />
              <div className="grid gap-1">
                <Label htmlFor="imp-suppliers" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Truck className="h-4 w-4 text-primary" />
                  10 Fornecedores Cadastrados
                  <Badge variant="outline" className="text-[10px]">New Print, Du Porto, Nevado...</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inclui CNPJs, telefones de vendedores (Ney, Thiago, Nicole) e endereços completos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-border/40 pt-3">
              <Checkbox
                id="imp-raw"
                checked={importRawMaterials}
                onCheckedChange={(c) => setImportRawMaterials(Boolean(c))}
                className="mt-1"
              />
              <div className="grid gap-1">
                <Label htmlFor="imp-raw" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Package className="h-4 w-4 text-amber-500" />
                  10 Matérias-Primas e Embalagens
                  <Badge variant="outline" className="text-[10px]">Com saldos e custos</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Etiqueta Don Juan, Ácido Cítrico, Amido, Coberturas, Creme Culinário e Caixas.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-border/40 pt-3">
              <Checkbox
                id="imp-products"
                checked={importProducts}
                onCheckedChange={(c) => setImportProducts(Boolean(c))}
                className="mt-1"
              />
              <div className="grid gap-1">
                <Label htmlFor="imp-products" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Package className="h-4 w-4 text-emerald-500" />
                  11 Produtos Acabados (Trufas Don Juan)
                  <Badge variant="outline" className="text-[10px]">Preço R$ 0,80 / Custo R$ 0,55</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Maracujá, Morango, Limão, Coco, Leite Condensado, Beijinho, Ninho, Nutella, etc.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-border/40 pt-3">
              <Checkbox
                id="imp-recipes"
                checked={importRecipes}
                onCheckedChange={(c) => setImportRecipes(Boolean(c))}
                className="mt-1"
              />
              <div className="grid gap-1">
                <Label htmlFor="imp-recipes" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Fichas Técnicas (BOM Automático)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Gera receitas automáticas vinculando chocolate, recheio e etiqueta às trufas.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-border/40 pt-3">
              <Checkbox
                id="imp-financial"
                checked={importFinancial}
                onCheckedChange={(c) => setImportFinancial(Boolean(c))}
                className="mt-1"
              />
              <div className="grid gap-1">
                <Label htmlFor="imp-financial" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Wallet className="h-4 w-4 text-blue-500" />
                  Histórico Financeiro e DRE
                  <Badge variant="outline" className="text-[10px]">9 Lançamentos reais</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Alimenta DRE e fluxo de caixa com as notas de compra e despesas da fábrica.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={importMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="hero"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="gap-2"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando Dados...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Iniciar Importação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
