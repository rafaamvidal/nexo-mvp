import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MapPin, MessageCircle, Package, Pencil, Phone, Plus, Search, Trash2, Truck, User, UserCog, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isForeignKeyViolation, toastDeleteBlocked } from "@/lib/supabaseErrors";
import { StaffTab } from "@/components/staff/StaffTab";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cleanDigits, getWhatsAppUrl, maskCep, maskCpfCnpj, maskPhone } from "@/lib/masks";
import { fetchAddressByCep } from "@/lib/viaCep";
import { SpreadsheetDataImporter } from "@/components/organization/SpreadsheetDataImporter";
import { ModuleHelpGuide } from "@/components/help/ModuleHelpGuide";

type ClientRow = {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  limit_credit: number | null;
  observations: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  observations: string | null;
};

type EntityPayload = {
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  limit_credit?: number | null;
  observations: string | null;
};

async function fetchClients(orgId?: string): Promise<ClientRow[]> {
  let query = supabase
    .from("clients")
    .select("id,name,tax_id,phone,email,address,city,state,limit_credit,observations")
    .order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchSuppliers(orgId?: string): Promise<SupplierRow[]> {
  let query = supabase
    .from("suppliers")
    .select("id,name,tax_id,phone,email,address,city,state,observations")
    .order("name", { ascending: true });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

function EntityDialog({
  title,
  trigger,
  initial,
  isClient = true,
  onSave,
}: {
  title: string;
  trigger: React.ReactNode;
  initial?: Partial<ClientRow>;
  isClient?: boolean;
  onSave: (payload: EntityPayload) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [taxId, setTaxId] = React.useState(maskCpfCnpj(initial?.tax_id ?? ""));
  const [phone, setPhone] = React.useState(maskPhone(initial?.phone ?? ""));
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [cep, setCep] = React.useState("");
  const [loadingCep, setLoadingCep] = React.useState(false);
  const [address, setAddress] = React.useState(initial?.address ?? "");
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [state, setState] = React.useState(initial?.state ?? "");
  const [limitCredit, setLimitCredit] = React.useState<number | "">(initial?.limit_credit ?? "");
  const [contactName, setContactName] = React.useState("");
  const [suppliedItems, setSuppliedItems] = React.useState("");
  const [observations, setObservations] = React.useState(initial?.observations ?? "");

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setTaxId(maskCpfCnpj(initial?.tax_id ?? ""));
    setPhone(maskPhone(initial?.phone ?? ""));
    setEmail(initial?.email ?? "");
    setCep("");
    setAddress(initial?.address ?? "");
    setCity(initial?.city ?? "");
    setState(initial?.state ?? "");
    setLimitCredit(initial?.limit_credit ?? "");

    let rawObs = initial?.observations ?? "";
    let extractedContact = "";
    let extractedSupplied = "";

    const fornecMatch = rawObs.match(/\[Fornece:\s*([^\]]+)\]/i);
    if (fornecMatch) {
      extractedSupplied = fornecMatch[1].trim();
      rawObs = rawObs.replace(fornecMatch[0], "").trim();
    }

    const vendMatch = rawObs.match(/\[Vendedor:\s*([^\]]+)\]/i);
    if (vendMatch) {
      extractedContact = vendMatch[1].trim();
      rawObs = rawObs.replace(vendMatch[0], "").trim();
    }

    setContactName(extractedContact);
    setSuppliedItems(extractedSupplied);
    setObservations(rawObs);
  }, [open, initial]);

  const handleCepLookup = async (cepInput: string) => {
    const raw = cleanDigits(cepInput);
    if (raw.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetchAddressByCep(raw);
      if (res) {
        const fullAddr = [res.logradouro, res.bairro].filter(Boolean).join(", ");
        if (fullAddr) setAddress(fullAddr);
        if (res.localidade) setCity(res.localidade);
        if (res.uf) setState(res.uf.toUpperCase());
        toast.success("Endereço preenchido via CEP!");
      } else {
        toast.error("CEP não localizado.");
      }
    } catch {
      toast.error("Falha ao consultar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-left leading-snug">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Dados Principais */}
          <div className="grid gap-2">
            <Label>Nome Completo / Razão Social *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva ou Empresa LTDA"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>CPF / CNPJ</Label>
              <Input
                value={taxId}
                onChange={(e) => setTaxId(maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Telefone / Celular</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </div>

          {/* Endereço com ViaCEP */}
          <div className="mt-2 border-t pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Endereço & Localização
            </span>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-1">
                <Label className="flex items-center justify-between">
                  <span>CEP</span>
                  {loadingCep && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </Label>
                <Input
                  value={cep}
                  onChange={(e) => {
                    const masked = maskCep(e.target.value);
                    setCep(masked);
                    if (cleanDigits(masked).length === 8) {
                      handleCepLookup(masked);
                    }
                  }}
                  onBlur={() => handleCepLookup(cep)}
                  placeholder="00000-000"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Logradouro / Bairro</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Av, Número, Bairro"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label>Cidade</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="grid gap-2">
                <Label>Estado (UF)</Label>
                <Input
                  value={state}
                  maxLength={2}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="UF"
                />
              </div>
            </div>
          </div>

          {/* Dados Extras */}
          {isClient && (
            <div className="grid gap-2 border-t pt-3">
              <Label>Limite de Crédito (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={limitCredit}
                onChange={(e) => setLimitCredit(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          )}

          {!isClient && (
            <>
              <div className="grid gap-2 border-t pt-3">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Package className="h-4 w-4 text-primary" />
                  <span>O que este fornecedor fornece? (Produtos / Insumos / Categorias)</span>
                </Label>
                <Input
                  value={suppliedItems}
                  onChange={(e) => setSuppliedItems(e.target.value)}
                  placeholder="Ex: Embalagens plásticas, Cacau em pó, Rótulos, Chocolates..."
                />
                <p className="text-xs text-muted-foreground">
                  Descreva as matérias-primas, insumos ou serviços fornecidos para facilitar a busca e cotação no dia a dia.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Vendedor / Representante Comercial (Contato)</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex: Thiago, Ney, Nicole Silva..."
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Observações Gerais</Label>
            <Input
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informações adicionais, horários, condições de frete..."
            />
          </div>

          <Button
            type="button"
            variant="hero"
            className="mt-2 w-full"
            onClick={async () => {
              try {
                if (!name.trim()) throw new Error("Informe o nome");
                let finalObs = observations.trim();
                const tags: string[] = [];
                if (!isClient && suppliedItems.trim()) {
                  tags.push(`[Fornece: ${suppliedItems.trim()}]`);
                }
                if (!isClient && contactName.trim()) {
                  tags.push(`[Vendedor: ${contactName.trim()}]`);
                }
                if (tags.length > 0) {
                  finalObs = `${tags.join(" ")} ${finalObs}`.trim();
                }

                const payloadToSave: EntityPayload = {
                  name: name.trim(),
                  tax_id: cleanDigits(taxId) ? maskCpfCnpj(taxId) : null,
                  phone: cleanDigits(phone) ? maskPhone(phone) : null,
                  email: email.trim() || null,
                  address: address.trim() || null,
                  city: city.trim() || null,
                  state: state.trim() || null,
                  observations: finalObs || null,
                };

                if (isClient) {
                  payloadToSave.limit_credit = limitCredit === "" ? null : Number(limitCredit);
                }

                await onSave(payloadToSave);
                setOpen(false);
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao salvar");
              }
            }}
          >
            Salvar Registro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Cadastros() {
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const { currentOrg } = useOrganization();
  const { data: clients, isLoading: loadingClients, error: errClients } = useQuery({
    queryKey: ["clients", currentOrg?.id],
    queryFn: () => fetchClients(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });
  const { data: suppliers, isLoading: loadingSuppliers, error: errSuppliers } = useQuery({
    queryKey: ["suppliers", currentOrg?.id],
    queryFn: () => fetchSuppliers(currentOrg?.id),
    enabled: Boolean(currentOrg?.id),
  });

  const [tab, setTab] = React.useState("clientes");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (!isAdmin && tab === "usuarios") setTab("clientes");
  }, [isAdmin, tab]);

  const filteredClients = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = clients ?? [];
    if (!term) return list;
    return list.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(term) ||
        (c.tax_id ?? "").includes(term) ||
        (c.city ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").includes(term)
    );
  }, [clients, q]);

  const filteredSuppliers = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = suppliers ?? [];
    if (!term) return list;
    return list.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(term) ||
        (s.tax_id ?? "").includes(term) ||
        (s.city ?? "").toLowerCase().includes(term) ||
        (s.phone ?? "").includes(term) ||
        (s.observations ?? "").toLowerCase().includes(term)
    );
  }, [suppliers, q]);

  const upsertClient = useMutation({
    mutationFn: async (payload: EntityPayload & { id?: string }) => {
      const clientData: any = {
        name: payload.name,
        tax_id: payload.tax_id,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        limit_credit: payload.limit_credit,
        observations: payload.observations,
        organization_id: currentOrg?.id,
      };

      if (payload.id) {
        const { error } = await supabase.from("clients").update(clientData).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(clientData);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Cliente salvo com sucesso!");
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar cliente"),
  });

  const upsertSupplier = useMutation({
    mutationFn: async (payload: EntityPayload & { id?: string }) => {
      const supplierData: any = {
        name: payload.name,
        tax_id: payload.tax_id,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        observations: payload.observations,
        organization_id: currentOrg?.id,
      };

      if (payload.id) {
        const { error } = await supabase.from("suppliers").update(supplierData).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(supplierData);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Fornecedor salvo com sucesso!");
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar fornecedor"),
  });

  const delClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cliente excluído");
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Vendas");
      toast.error(e?.message ?? "Erro ao excluir");
    },
  });

  const delSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Fornecedor excluído");
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Compras");
      toast.error(e?.message ?? "Erro ao excluir");
    },
  });

  return (
    <AppShell title="Cadastros">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-extrabold">Cadastros</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de clientes, fornecedores e equipe com busca automática e integração WhatsApp.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
            <SpreadsheetDataImporter />
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar nome, documento, cidade…"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList
              className={
                "grid h-auto w-full grid-cols-1 gap-1 p-1 " +
                (isAdmin ? "sm:w-[520px] sm:grid-cols-3" : "sm:w-[360px] sm:grid-cols-2")
              }
            >
              <TabsTrigger value="clientes" className="gap-2 py-2 text-xs">
                <Users className="h-4 w-4" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="fornecedores" className="gap-2 py-2 text-xs">
                <Truck className="h-4 w-4" />
                Fornecedores
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="usuarios" className="gap-2 py-2 text-xs">
                  <UserCog className="h-4 w-4" />
                  Usuários / Staff
                </TabsTrigger>
              )}
            </TabsList>

            {/* ABA CLIENTES */}
            <TabsContent value="clientes" className="mt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Clientes Cadastrados ({filteredClients.length})</span>
                  <ModuleHelpGuide
                    customContent={{
                      title: "Gestão de Clientes",
                      subtitle: "Cadastro completo da carteira de clientes",
                      summary: "Cadastre e acompanhe seus compradores com dados fiscais, limite de crédito e integração WhatsApp em 1 clique.",
                      whatToRegister: [
                        "Nome Completo ou Razão Social da empresa.",
                        "CPF ou CNPJ para emissão de notas e pedidos.",
                        "Telefone/Celular com WhatsApp para contato rápido.",
                        "CEP (completa rua, bairro, cidade e UF automaticamente).",
                        "Limite de crédito para controle de vendas a prazo.",
                      ],
                      tips: [
                        "Toque no botão verde de WhatsApp em qualquer card de cliente para abrir a conversa sem precisar salvar na agenda.",
                      ],
                    }}
                  />
                </div>
                <EntityDialog
                  title="Novo Cliente"
                  isClient={true}
                  trigger={
                    <Button type="button" variant="hero" className="w-full gap-2 sm:w-auto">
                      <Plus className="h-4 w-4" />
                      Novo Cliente
                    </Button>
                  }
                  onSave={async (payload) => upsertClient.mutateAsync(payload)}
                />
              </div>

              {errClients && (
                <Card className="glass mt-4 p-6">
                  <p className="text-sm text-muted-foreground">Erro: {(errClients as any)?.message ?? ""}</p>
                </Card>
              )}

              {loadingClients && (
                <div className="mt-4 grid gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              )}

              {!loadingClients && !errClients && (
                <>
                  {/* VISÃO MOBILE: CARDS COMPACTOS NATIVOS (Sem rolagem horizontal) */}
                  <div className="grid grid-cols-1 gap-2.5 sm:hidden mt-4">
                    {filteredClients.length === 0 ? (
                      <Card className="glass p-6 text-center text-sm text-muted-foreground">
                        Nenhum cliente encontrado.
                      </Card>
                    ) : (
                      filteredClients.map((c) => {
                        const waUrl = getWhatsAppUrl(c.phone, `Olá ${c.name}, contato do AGILIX.`);
                        return (
                          <Card key={c.id} className="glass p-3.5 border-border/60 transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-sm text-foreground truncate">{c.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {c.tax_id ? maskCpfCnpj(c.tax_id) : "Sem documento"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    aria-label="WhatsApp"
                                    title="WhatsApp"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                )}
                                <EntityDialog
                                  title="Editar Cliente"
                                  initial={c}
                                  isClient={true}
                                  trigger={
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Editar">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  }
                                  onSave={async (payload) =>
                                    upsertClient.mutateAsync({ ...payload, id: c.id })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  aria-label="Excluir"
                                  onClick={() => delClient.mutate(c.id)}
                                  disabled={delClient.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {(c.phone || c.email || c.city || c.limit_credit) && (
                              <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                {c.phone && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {maskPhone(c.phone)}
                                  </span>
                                )}
                                {(c.city || c.state) && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {[c.city, c.state].filter(Boolean).join(" - ")}
                                  </span>
                                )}
                                {c.limit_credit ? (
                                  <span className="font-semibold text-foreground">
                                    Limite: R$ {Number(c.limit_credit).toFixed(2)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </div>

                  {/* VISÃO DESKTOP / TABLET (Tabela tradicional completa) */}
                  <Card className="glass mt-4 overflow-hidden rounded-xl border border-border/60 hidden sm:block">
                    <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="min-w-[700px] w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF/CNPJ</TableHead>
                          <TableHead>Contato & WhatsApp</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                        <TableBody>
                          {filteredClients.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                Nenhum cliente encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredClients.map((c) => {
                              const waUrl = getWhatsAppUrl(c.phone, `Olá ${c.name}, contato do AGILIX.`);
                              return (
                                <TableRow key={c.id} className="odd:bg-muted/20">
                                  <TableCell className="font-semibold">
                                    <div>{c.name}</div>
                                    {c.limit_credit ? (
                                      <div className="text-xs text-muted-foreground">
                                        Limite: R$ {Number(c.limit_credit).toFixed(2)}
                                      </div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {c.tax_id ? maskCpfCnpj(c.tax_id) : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1 text-xs">
                                      {c.phone ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="inline-flex items-center gap-1 text-foreground">
                                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                                            {maskPhone(c.phone)}
                                          </span>
                                          {waUrl && (
                                            <a
                                              href={waUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title="Conversar no WhatsApp"
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                                            >
                                              <MessageCircle className="h-3.5 w-3.5" />
                                            </a>
                                          )}
                                        </div>
                                      ) : null}
                                      {c.email ? (
                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                          <Mail className="h-3.5 w-3.5" /> {c.email}
                                        </span>
                                      ) : null}
                                      {!c.phone && !c.email && <span className="text-muted-foreground">—</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {c.city || c.state ? (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        {[c.city, c.state].filter(Boolean).join(" - ")}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <EntityDialog
                                        title="Editar Cliente"
                                        initial={c}
                                        isClient={true}
                                        trigger={
                                          <Button type="button" variant="outline" size="icon" aria-label="Editar">
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        }
                                        onSave={async (payload) =>
                                          upsertClient.mutateAsync({ ...payload, id: c.id })
                                        }
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Excluir"
                                        onClick={() => delClient.mutate(c.id)}
                                        disabled={delClient.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                  </Card>
                </>
              )}
              </TabsContent>

              {/* ABA FORNECEDORES */}
              <TabsContent value="fornecedores" className="mt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>Fornecedores Cadastrados ({filteredSuppliers.length})</span>
                    <ModuleHelpGuide
                      customContent={{
                        title: "Gestão de Fornecedores",
                        subtitle: "Parceiros e distribuidores de insumos",
                        summary: "Cadastre as empresas que fornecem matérias-primas e embalagens para a sua produção.",
                        whatToRegister: [
                          "Razão Social ou Nome Fantasia do fornecedor.",
                          "CNPJ para controle fiscal.",
                          "Nome do Vendedor responsável pelo atendimento.",
                          "Insumos que fornecem usando a tag [Fornece: Farinha, Fermento, etc.].",
                          "Telefone e WhatsApp direto do vendedor.",
                        ],
                        tips: [
                          "Cadastrar os produtos que cada parceiro fornece permite localizar o fornecedor ideal em segundos na hora de cotar compras.",
                        ],
                      }}
                    />
                  </div>
                  <EntityDialog
                    title="Novo Fornecedor"
                    isClient={false}
                    trigger={
                      <Button type="button" variant="hero" className="w-full gap-2 sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Novo Fornecedor
                      </Button>
                    }
                    onSave={async (payload) => upsertSupplier.mutateAsync(payload)}
                  />
                </div>

                {errSuppliers && (
                  <Card className="glass mt-4 p-6">
                    <p className="text-sm text-muted-foreground">Erro: {(errSuppliers as any)?.message ?? ""}</p>
                  </Card>
                )}

                {loadingSuppliers && (
                  <div className="mt-4 grid gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                )}

                {!loadingSuppliers && !errSuppliers && (
                  <>
                    {/* VISÃO MOBILE: CARDS COMPACTOS NATIVOS (Sem rolagem horizontal) */}
                    <div className="grid grid-cols-1 gap-2.5 sm:hidden mt-4">
                      {filteredSuppliers.length === 0 ? (
                        <Card className="glass p-6 text-center text-sm text-muted-foreground">
                          Nenhum fornecedor encontrado.
                        </Card>
                      ) : (
                        filteredSuppliers.map((s) => {
                          const matchFornece = s.observations?.match(/\[Fornece:\s*([^\]]+)\]/i);
                          const fornece = matchFornece ? matchFornece[1].trim() : null;

                          const matchVendedor = s.observations?.match(/\[Vendedor:\s*([^\]]+)\]/i);
                          const vendedor = matchVendedor ? matchVendedor[1].trim() : null;

                          const waGreeting = vendedor
                            ? `Olá ${vendedor}, tudo bem? Contato da fábrica via AGILIX referente a ${s.name}.`
                            : `Olá ${s.name}, tudo bem? Contato da fábrica via AGILIX.`;
                          const waUrl = getWhatsAppUrl(s.phone, waGreeting);

                          return (
                            <div
                              key={s.id}
                              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm active:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm leading-tight text-foreground truncate">
                                    {s.name}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    {s.tax_id && <span>{maskCpfCnpj(s.tax_id)}</span>}
                                    {(s.city || s.state) && (
                                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                                        • <MapPin className="h-3 w-3 shrink-0" />
                                        {[s.city, s.state].filter(Boolean).join(" - ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <EntityDialog
                                    title="Editar Fornecedor"
                                    initial={s}
                                    isClient={false}
                                    trigger={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    }
                                    onSave={async (payload) =>
                                      upsertSupplier.mutateAsync({ ...payload, id: s.id })
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive/80 hover:text-destructive"
                                    onClick={() => delSupplier.mutate(s.id)}
                                    disabled={delSupplier.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {(fornece || vendedor) && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {fornece && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                      title={`Fornece: ${fornece}`}
                                    >
                                      <Package className="h-3 w-3 shrink-0" />
                                      <span>{fornece}</span>
                                    </span>
                                  )}
                                  {vendedor && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>Vendedor: {vendedor}</span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {s.phone && (
                                <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{maskPhone(s.phone)}</span>
                                  </div>
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors active:bg-emerald-500/20"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* VISÃO DESKTOP: TABELA COMPLETA */}
                    <Card className="glass mt-4 hidden sm:block overflow-hidden rounded-xl border border-border/60">
                      <Table containerClassName="lg:max-h-[calc(100dvh-320px)]" className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome / Fornecedor</TableHead>
                            <TableHead>CNPJ/CPF</TableHead>
                            <TableHead>Contato & WhatsApp</TableHead>
                            <TableHead>Localização</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSuppliers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                Nenhum fornecedor encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSuppliers.map((s) => {
                              const matchFornece = s.observations?.match(/\[Fornece:\s*([^\]]+)\]/i);
                              const fornece = matchFornece ? matchFornece[1].trim() : null;

                              const matchVendedor = s.observations?.match(/\[Vendedor:\s*([^\]]+)\]/i);
                              const vendedor = matchVendedor ? matchVendedor[1].trim() : null;

                              const waGreeting = vendedor
                                ? `Olá ${vendedor}, tudo bem? Contato da fábrica via AGILIX referente a ${s.name}.`
                                : `Olá ${s.name}, tudo bem? Contato da fábrica via AGILIX.`;
                              const waUrl = getWhatsAppUrl(s.phone, waGreeting);
                              return (
                                <TableRow key={s.id} className="odd:bg-muted/20">
                                  <TableCell>
                                    <div className="font-semibold text-foreground">{s.name}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      {fornece && (
                                        <span
                                          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                          title={`Fornece: ${fornece}`}
                                        >
                                          <Package className="h-3 w-3 shrink-0" />
                                          <span>{fornece}</span>
                                        </span>
                                      )}
                                      {vendedor && (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                          <User className="h-3 w-3 shrink-0" />
                                          <span>Vendedor: {vendedor}</span>
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {s.tax_id ? maskCpfCnpj(s.tax_id) : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1 text-xs">
                                      {s.phone ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="inline-flex items-center gap-1 text-foreground">
                                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                                            {maskPhone(s.phone)}
                                          </span>
                                          {waUrl && (
                                            <a
                                              href={waUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title="Conversar no WhatsApp"
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                                            >
                                              <MessageCircle className="h-3.5 w-3.5" />
                                            </a>
                                          )}
                                        </div>
                                      ) : null}
                                      {s.email ? (
                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                          <Mail className="h-3.5 w-3.5" /> {s.email}
                                        </span>
                                      ) : null}
                                      {!s.phone && !s.email && <span className="text-muted-foreground">—</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {s.city || s.state ? (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        {[s.city, s.state].filter(Boolean).join(" - ")}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <EntityDialog
                                        title="Editar Fornecedor"
                                        initial={s}
                                        isClient={false}
                                        trigger={
                                          <Button type="button" variant="outline" size="icon" aria-label="Editar">
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        }
                                        onSave={async (payload) =>
                                          upsertSupplier.mutateAsync({ ...payload, id: s.id })
                                        }
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Excluir"
                                        onClick={() => delSupplier.mutate(s.id)}
                                        disabled={delSupplier.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </>
                )}
              </TabsContent>

              {isAdmin && (
                <TabsContent value="usuarios" className="mt-5">
                  <StaffTab />
                </TabsContent>
              )}
            </Tabs>
        </div>
      </section>
    </AppShell>
  );
}
