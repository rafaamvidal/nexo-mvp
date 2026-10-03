import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";

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
import { cleanDigits, getWhatsAppUrl, maskCep, maskCpfCnpj, maskPhone } from "@/lib/masks";
import { fetchAddressByCep } from "@/lib/viaCep";

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

async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id,name,tax_id,phone,email,address,city,state,limit_credit,observations")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,tax_id,phone,email,address,city,state,observations")
    .order("name", { ascending: true });
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
    setObservations(initial?.observations ?? "");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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

          <div className="grid gap-2">
            <Label>Observações Gerais</Label>
            <Input
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informações adicionais, horários, condições..."
            />
          </div>

          <Button
            type="button"
            variant="hero"
            className="mt-2 w-full"
            onClick={async () => {
              try {
                if (!name.trim()) throw new Error("Informe o nome");
                await onSave({
                  name: name.trim(),
                  tax_id: cleanDigits(taxId) ? maskCpfCnpj(taxId) : null,
                  phone: cleanDigits(phone) ? maskPhone(phone) : null,
                  email: email.trim() || null,
                  address: address.trim() || null,
                  city: city.trim() || null,
                  state: state.trim() || null,
                  limit_credit: limitCredit === "" ? null : Number(limitCredit),
                  observations: observations.trim() || null,
                });
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
  const { data: clients, isLoading: loadingClients, error: errClients } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });
  const { data: suppliers, isLoading: loadingSuppliers, error: errSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
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
        (s.phone ?? "").includes(term)
    );
  }, [suppliers, q]);

  const upsertClient = useMutation({
    mutationFn: async (payload: EntityPayload & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("clients").update(payload as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload as any);
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
      if (payload.id) {
        const { error } = await supabase.from("suppliers").update(payload as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload as any);
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
          <div className="relative w-full md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, documento, cidade…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-5">
          <Card className="glass rounded-xl border border-border/60 p-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className={"grid w-full " + (isAdmin ? "grid-cols-3" : "grid-cols-2")}>
                <TabsTrigger value="clientes">Clientes</TabsTrigger>
                <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
                {isAdmin && <TabsTrigger value="usuarios">Usuários / Staff</TabsTrigger>}
              </TabsList>

              {/* ABA CLIENTES */}
              <TabsContent value="clientes" className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Clientes Cadastrados ({filteredClients.length})
                  </div>
                  <EntityDialog
                    title="Novo Cliente"
                    isClient={true}
                    trigger={
                      <Button type="button" variant="hero" className="gap-2">
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
                  <Card className="glass mt-4 overflow-hidden rounded-xl border border-border/60">
                    <ScrollArea className="max-h-[70vh]">
                      <Table>
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
                    </ScrollArea>
                  </Card>
                )}
              </TabsContent>

              {/* ABA FORNECEDORES */}
              <TabsContent value="fornecedores" className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Fornecedores Cadastrados ({filteredSuppliers.length})
                  </div>
                  <EntityDialog
                    title="Novo Fornecedor"
                    isClient={false}
                    trigger={
                      <Button type="button" variant="hero" className="gap-2">
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
                  <Card className="glass mt-4 overflow-hidden rounded-xl border border-border/60">
                    <ScrollArea className="max-h-[70vh]">
                      <Table>
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
                              const waUrl = getWhatsAppUrl(s.phone, `Olá ${s.name}, contato do AGILIX.`);
                              return (
                                <TableRow key={s.id} className="odd:bg-muted/20">
                                  <TableCell className="font-semibold">{s.name}</TableCell>
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
                    </ScrollArea>
                  </Card>
                )}
              </TabsContent>

              {isAdmin && (
                <TabsContent value="usuarios" className="mt-4">
                  <StaffTab />
                </TabsContent>
              )}
            </Tabs>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
