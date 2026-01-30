import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";

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

type ClientRow = { id: string; name: string; tax_id: string | null; phone: string | null; email: string | null };
type SupplierRow = { id: string; name: string; tax_id: string | null; phone: string | null; email: string | null };

async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase.from("clients").select("id,name,tax_id,phone,email").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers").select("id,name,tax_id,phone,email").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

function EntityDialog({
  title,
  trigger,
  initial,
  onSave,
}: {
  title: string;
  trigger: React.ReactNode;
  initial?: { name: string; tax_id?: string | null; phone?: string | null; email?: string | null };
  onSave: (payload: { name: string; tax_id: string | null; phone: string | null; email: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [taxId, setTaxId] = React.useState(initial?.tax_id ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setTaxId(initial?.tax_id ?? "");
    setPhone(initial?.phone ?? "");
    setEmail(initial?.email ?? "");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>CPF/CNPJ</Label>
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button
            type="button"
            variant="hero"
            onClick={async () => {
              try {
                if (!name.trim()) throw new Error("Informe o nome");
                await onSave({
                  name: name.trim(),
                  tax_id: taxId.trim() || null,
                  phone: phone.trim() || null,
                  email: email.trim() || null,
                });
                setOpen(false);
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao salvar");
              }
            }}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Cadastros() {
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const { data: clients, isLoading: loadingClients, error: errClients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const { data: suppliers, isLoading: loadingSuppliers, error: errSuppliers } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

  const [tab, setTab] = React.useState("clientes");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    // UI-only permission: staff should not access the Users/Staff tab.
    if (!isAdmin && tab === "usuarios") setTab("clientes");
  }, [isAdmin, tab]);

  const filteredClients = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = clients ?? [];
    if (!term) return list;
    return list.filter((c) => (c.name ?? "").toLowerCase().includes(term) || (c.tax_id ?? "").toLowerCase().includes(term));
  }, [clients, q]);

  const filteredSuppliers = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = suppliers ?? [];
    if (!term) return list;
    return list.filter((s) => (s.name ?? "").toLowerCase().includes(term) || (s.tax_id ?? "").toLowerCase().includes(term));
  }, [suppliers, q]);

  const upsertClient = useMutation({
    mutationFn: async (payload: Partial<ClientRow> & { name: string; id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("clients").update(payload as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Salvo");
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const upsertSupplier = useMutation({
    mutationFn: async (payload: Partial<SupplierRow> & { name: string; id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("suppliers").update(payload as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Salvo");
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const delClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Excluído");
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
      toast.success("Excluído");
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
            <p className="mt-1 text-sm text-muted-foreground">Gestão de clientes, fornecedores e usuários (visão).</p>
          </div>
          <div className="relative w-full md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome/CPF/CNPJ…" className="pl-9" />
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

              <TabsContent value="clientes" className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Clientes
                  </div>
                  <EntityDialog
                    title="Novo Cliente"
                    trigger={
                      <Button type="button" variant="hero" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo
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
                            <TableHead>Contato</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(filteredClients ?? []).map((c) => (
                            <TableRow key={c.id} className="odd:bg-muted/20">
                              <TableCell className="font-semibold">{c.name}</TableCell>
                              <TableCell className="text-muted-foreground">{c.tax_id ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-sm">
                                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4" /> {c.phone ?? "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" /> {c.email ?? "—"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <EntityDialog
                                    title="Editar Cliente"
                                    initial={c}
                                    trigger={
                                      <Button type="button" variant="outline" size="icon" aria-label="Editar">
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    }
                                    onSave={async (payload) => upsertClient.mutateAsync({ ...payload, id: c.id })}
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
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="fornecedores" className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Fornecedores
                  </div>
                  <EntityDialog
                    title="Novo Fornecedor"
                    trigger={
                      <Button type="button" variant="hero" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo
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
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF/CNPJ</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(filteredSuppliers ?? []).map((s) => (
                            <TableRow key={s.id} className="odd:bg-muted/20">
                              <TableCell className="font-semibold">{s.name}</TableCell>
                              <TableCell className="text-muted-foreground">{s.tax_id ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-sm">
                                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4" /> {s.phone ?? "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" /> {s.email ?? "—"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <EntityDialog
                                    title="Editar Fornecedor"
                                    initial={s}
                                    trigger={
                                      <Button type="button" variant="outline" size="icon" aria-label="Editar">
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    }
                                    onSave={async (payload) => upsertSupplier.mutateAsync({ ...payload, id: s.id })}
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
                          ))}
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
