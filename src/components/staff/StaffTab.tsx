import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { isForeignKeyViolation, toastDeleteBlocked } from "@/lib/supabaseErrors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type AllowlistUserRow = {
  id: string;
  status: string;
  created_at: string;
  email: string;
  full_name: string | null;
  role: string | null;
};

const userProfileSchema = z.object({
  full_name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255),
  role: z.enum(["admin", "estoque", "vendas", "financeiro", "rh"]),
  status: z.enum(["active", "inactive"]),
});

async function fetchAllowlistUsers(): Promise<AllowlistUserRow[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    // role NÃO deve ficar em user_profiles; vem de user_profile_roles
    .select("id,email,full_name,status,created_at,user_profile_roles(role)")
    .order("email", { ascending: true });
  if (error) throw error;

  // PostgREST pode retornar relação 0..n como array; como temos UNIQUE(user_profile_id), normalizamos para 0..1.
  return (data ?? []).map((row: any) => {
    const rel = row?.user_profile_roles;
    const role = Array.isArray(rel) ? rel?.[0]?.role ?? null : rel?.role ?? null;
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      status: row.status,
      created_at: row.created_at,
      role,
    } satisfies AllowlistUserRow;
  });
}

function UserProfileDialog({
  trigger,
  title,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: { full_name: string | null; email: string; role: string | null; status: string | null };
  onSave: (payload: z.infer<typeof userProfileSchema>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState(initial?.full_name ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [role, setRole] = React.useState<z.infer<typeof userProfileSchema>["role"]>(
    (initial?.role as any) ?? "estoque",
  );
  const [status, setStatus] = React.useState<z.infer<typeof userProfileSchema>["status"]>(
    (initial?.status as any) ?? "active",
  );

  React.useEffect(() => {
    if (!open) return;
    setFullName(initial?.full_name ?? "");
    setEmail(initial?.email ?? "");
    setRole((initial?.role as any) ?? "estoque");
    setStatus((initial?.status as any) ?? "active");
  }, [open, initial?.email, initial?.full_name, initial?.role, initial?.status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Nome Completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Maria Silva" />
          </div>
          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ex: usuario@empresa.com" />
          </div>
          <div className="grid gap-2">
            <Label>Cargo/Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estoque">Estoque</SelectItem>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="hero"
            onClick={async () => {
              try {
                const parsed = userProfileSchema.safeParse({
                  full_name: fullName,
                  email,
                  role,
                  status,
                });
                if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

                await onSave({
                  ...parsed.data,
                  email: parsed.data.email.toLowerCase(),
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

export function StaffTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const { data: allowlistUsers, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["staff", "user_profiles"],
    queryFn: fetchAllowlistUsers,
    enabled: !!user && !!isAdmin,
  });

  const upsertUser = useMutation({
    mutationFn: async (payload: z.infer<typeof userProfileSchema> & { id?: string }) => {
      const profileBase = {
        full_name: payload.full_name?.trim() || null,
        email: payload.email.trim().toLowerCase(),
        status: payload.status,
      };

      if (payload.id) {
        // Atualiza allowlist (sem role)
        const { error: profileError } = await supabase.from("user_profiles").update(profileBase as any).eq("id", payload.id);
        if (profileError) throw profileError;

        // Atualiza role na tabela dedicada
        const { error: roleError } = await supabase
          .from("user_profile_roles")
          .upsert(
            {
              user_profile_id: payload.id,
              role: payload.role,
            } as any,
            { onConflict: "user_profile_id" },
          );
        if (roleError) throw roleError;
        return;
      }

      // Cria o profile e pega o id
      const { data: created, error: createError } = await supabase
        .from("user_profiles")
        .insert(profileBase as any)
        .select("id")
        .single();
      if (createError) throw createError;

      // Cria o role associado
      const { error: roleError } = await supabase
        .from("user_profile_roles")
        .insert({ user_profile_id: created.id, role: payload.role } as any);
      if (roleError) throw roleError;
    },
    onSuccess: async () => {
      toast.success("Salvo");
      await qc.invalidateQueries({ queryKey: ["staff", "user_profiles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Excluído");
      await qc.invalidateQueries({ queryKey: ["staff", "user_profiles"] });
    },
    onError: (e: any) => {
      if (isForeignKeyViolation(e)) return toastDeleteBlocked("Registros relacionados");
      toast.error(e?.message ?? "Erro ao excluir");
    },
  });

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

  // Non-admin view: keep restricted.
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

  const loading = usersLoading;
  const error = usersError;

  return (
    <div className="grid gap-4">
      <Card className="glass p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Usuários / Staff
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Cadastro (allowlist) — não cria usuário no Auth.</p>
          </div>
          <UserProfileDialog
            title="Novo Usuário / Staff"
            trigger={
              <Button type="button" variant="hero" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            }
            onSave={async (payload) => upsertUser.mutateAsync(payload)}
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
        <Card className="glass overflow-hidden rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allowlistUsers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {(allowlistUsers ?? []).map((u) => (
                <TableRow key={u.id} className="odd:bg-muted/20">
                  <TableCell className="font-semibold">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.role ?? "—"}</TableCell>
                  <TableCell>{u.status ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <UserProfileDialog
                        title="Editar Usuário / Staff"
                        initial={{
                          email: u.email,
                          full_name: u.full_name,
                          role: u.role,
                          status: u.status,
                        }}
                        trigger={
                          <Button type="button" variant="outline" size="icon" aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                        onSave={async (payload) => upsertUser.mutateAsync({ ...payload, id: u.id })}
                      />

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon" aria-label="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cadastro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso remove o registro da allowlist. Não afeta usuários já existentes no Auth.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser.mutate(u.id)}
                              disabled={deleteUser.isPending}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
