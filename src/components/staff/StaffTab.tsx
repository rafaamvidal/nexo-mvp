import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  email: string;
  status: string;
  created_at: string;
};

type UserRoleRow = {
  user_id: string;
  role: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

const inviteSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  role: z.enum(["admin", "staff", "estoque", "vendas", "financeiro"]),
});

async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from("profiles").select("id,email,status,created_at").order("email", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchRoles(): Promise<UserRoleRow[]> {
  const { data, error } = await supabase.from("user_roles").select("user_id,role");
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchInvites(): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from("staff_invitations")
    .select("id,email,role,status,created_at,accepted_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

function InviteDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<z.infer<typeof inviteSchema>["role"]>("staff");

  const createInvite = useMutation({
    mutationFn: async () => {
      const parsed = inviteSchema.safeParse({ email, role });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

      const normalizedEmail = parsed.data.email.toLowerCase();
      const { error } = await supabase.from("staff_invitations").insert({
        email: normalizedEmail,
        role: parsed.data.role as any,
        status: "Pendente",
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Convite criado");
      setOpen(false);
      setEmail("");
      setRole("staff");
      await onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar convite"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="hero" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo convite</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ex: usuario@empresa.com" />
          </div>
          <div className="grid gap-2">
            <Label>Cargo</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="estoque">Estoque</SelectItem>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="hero" onClick={() => createInvite.mutate()} disabled={createInvite.isPending}>
            {createInvite.isPending ? "Salvando…" : "Salvar convite"}
          </Button>
          <p className="text-xs text-muted-foreground">
            O usuário aceita automaticamente ao fazer login/cadastro com este e-mail.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StaffTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const { data: profiles, isLoading: profilesLoading, error: profilesError } = useQuery({
    queryKey: ["staff", "profiles"],
    queryFn: fetchProfiles,
    enabled: !!user && !!isAdmin,
  });

  const { data: roles, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ["staff", "roles"],
    queryFn: fetchRoles,
    enabled: !!user && !!isAdmin,
  });

  const { data: invites, isLoading: invitesLoading, error: invitesError } = useQuery({
    queryKey: ["staff", "invites"],
    queryFn: fetchInvites,
    enabled: !!user && !!isAdmin,
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Convite removido");
      await qc.invalidateQueries({ queryKey: ["staff", "invites"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover convite"),
  });

  const roleMap = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = m.get(r.user_id) ?? [];
      list.push(r.role);
      m.set(r.user_id, list);
    }
    // stable order
    for (const [k, v] of m) m.set(k, [...new Set(v)].sort());
    return m;
  }, [roles]);

  if (!user) {
    return (
      <Card className="glass p-6">
        <p className="text-base font-semibold">Usuários / Staff</p>
        <p className="mt-1 text-sm text-muted-foreground">Entre para ver suas informações.</p>
      </Card>
    );
  }

  if (adminLoading) {
    return (
      <Card className="glass p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
      </Card>
    );
  }

  // Non-admin view: only current user info (RLS-safe).
  if (!isAdmin) {
    return (
      <Card className="glass p-6">
        <p className="text-base font-semibold">Usuários / Staff</p>
        <p className="mt-1 text-sm text-muted-foreground">Apenas administradores podem listar toda a equipe.</p>
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-4">
          <p className="text-sm font-semibold">Usuário atual</p>
          <p className="mt-1 text-sm text-muted-foreground">{user.email ?? user.id}</p>
        </div>
      </Card>
    );
  }

  const loading = profilesLoading || rolesLoading || invitesLoading;
  const error = profilesError || rolesError || invitesError;

  return (
    <div className="grid gap-4">
      <Card className="glass p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-base font-semibold">Usuários / Staff</p>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie convites e visualize a equipe (admin).</p>
          </div>
          <InviteDialog
            onCreated={async () => {
              await qc.invalidateQueries({ queryKey: ["staff", "invites"] });
            }}
          />
        </div>
      </Card>

      {error && (
        <Card className="glass p-6">
          <p className="text-sm text-muted-foreground">Erro ao carregar: {(error as any)?.message ?? ""}</p>
        </Card>
      )}

      {loading && (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4">
          <Card className="glass overflow-hidden rounded-xl border border-border/60">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">Convites</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Pendentes e aceitos recentemente.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invites ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      Nenhum convite.
                    </TableCell>
                  </TableRow>
                )}
                {(invites ?? []).map((inv) => (
                  <TableRow key={inv.id} className="odd:bg-muted/20">
                    <TableCell className="font-semibold">{inv.email}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.role}</TableCell>
                    <TableCell>{inv.status}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Remover convite"
                        onClick={() => deleteInvite.mutate(inv.id)}
                        disabled={deleteInvite.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="glass overflow-hidden rounded-xl border border-border/60">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">Equipe</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Usuários com perfil ativo no sistema.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cargos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      Nenhum usuário.
                    </TableCell>
                  </TableRow>
                )}
                {(profiles ?? []).map((p) => (
                  <TableRow key={p.id} className="odd:bg-muted/20">
                    <TableCell className="font-semibold">{p.email}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell className="text-muted-foreground">{(roleMap.get(p.id) ?? []).join(", ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
