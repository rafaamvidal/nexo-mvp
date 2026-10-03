import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Organization {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  role?: string;
  created_at?: string;
}

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  isSetupModalOpen: boolean;
  openSetupModal: () => void;
  closeSetupModal: () => void;
  selectOrganization: (orgId: string) => void;
  createOrganization: (payload: { name: string; document?: string; phone?: string }) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

const getStorageKey = (userId: string, key: string) => `agilix_${key}_${userId}`;

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = React.useState<Organization | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSetupModalOpen, setIsSetupModalOpen] = React.useState(false);

  const openSetupModal = React.useCallback(() => setIsSetupModalOpen(true), []);
  const closeSetupModal = React.useCallback(() => setIsSetupModalOpen(false), []);

  const fetchOrganizations = React.useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      setIsSetupModalOpen(false);
      return;
    }

    try {
      setIsLoading(true);

      // 1. Busca os vínculos de organização do usuário
      const { data: memberData, error: memberErr } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, document, phone, created_at)")
        .eq("user_id", user.id);

      if (!memberErr && memberData && memberData.length > 0) {
        const list: Organization[] = memberData
          .map((row: any) => {
            const org = row.organizations;
            if (!org) return null;
            return {
              id: org.id,
              name: org.name,
              document: org.document ?? null,
              phone: org.phone ?? null,
              role: row.role ?? "member",
              created_at: org.created_at,
            };
          })
          .filter((o): o is Organization => o !== null);

        if (list.length > 0) {
          setOrganizations(list);
          const activeKey = getStorageKey(user.id, "active_org_id");
          const savedOrgId = localStorage.getItem(activeKey);
          const matched = list.find((o) => o.id === savedOrgId);

          if (matched) {
            setCurrentOrg(matched);
          } else {
            setCurrentOrg(list[0]);
            localStorage.setItem(activeKey, list[0].id);
            localStorage.setItem(getStorageKey(user.id, "active_org_name"), list[0].name);
          }
          return;
        }
      }

      // 2. Se a busca por membros falhar ou vier vazia, tenta diretamente em organizations
      const { data: directOrgs, error: directErr } = await supabase
        .from("organizations")
        .select("id, name, document, phone, created_at");

      if (!directErr && directOrgs && directOrgs.length > 0) {
        const list: Organization[] = directOrgs.map((org: any) => ({
          id: org.id,
          name: org.name,
          document: org.document ?? null,
          phone: org.phone ?? null,
          role: "owner",
          created_at: org.created_at,
        }));

        setOrganizations(list);
        const activeKey = getStorageKey(user.id, "active_org_id");
        const savedOrgId = localStorage.getItem(activeKey);
        const matched = list.find((o) => o.id === savedOrgId);

        if (matched) {
          setCurrentOrg(matched);
        } else {
          setCurrentOrg(list[0]);
          localStorage.setItem(activeKey, list[0].id);
          localStorage.setItem(getStorageKey(user.id, "active_org_name"), list[0].name);
        }
        return;
      }

      // 3. Usuário novo: zero organizações encontradas
      setOrganizations([]);
      setCurrentOrg(null);

      // Abre automaticamente o modal se não for o superadmin
      const isPlatformAdmin = user.email === "admin@erp.com.br";
      const dismissedKey = getStorageKey(user.id, "dismiss_setup");
      const isDismissed = sessionStorage.getItem(dismissedKey) === "true";

      if (!isPlatformAdmin && !isDismissed) {
        setIsSetupModalOpen(true);
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar organizações:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const selectOrganization = React.useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (org && user) {
        setCurrentOrg(org);
        localStorage.setItem(getStorageKey(user.id, "active_org_id"), org.id);
        localStorage.setItem(getStorageKey(user.id, "active_org_name"), org.name);
        toast.info(`Empresa ativa: ${org.name}`);
        // Invalida as queries de negócio para recarregar com os dados da nova empresa sem piscar a página
        queryClient.invalidateQueries();
      }
    },
    [organizations, user, queryClient]
  );

  const createOrganization = React.useCallback(
    async (payload: { name: string; document?: string; phone?: string }): Promise<Organization> => {
      if (!user) throw new Error("Usuário não autenticado");

      let createdOrg: Organization | null = null;

      // 1. Tenta executar via RPC create_company_account (SECURITY DEFINER atômica)
      try {
        const { data, error } = await supabase.rpc("create_company_account" as any, {
          p_name: payload.name.trim(),
          p_document: payload.document?.trim() || undefined,
          p_phone: payload.phone?.trim() || undefined,
        });

        if (!error && data) {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          createdOrg = {
            id: parsed.id,
            name: parsed.name,
            document: parsed.document ?? null,
            phone: payload.phone ?? null,
            role: "owner",
          };
        } else if (error) {
          console.warn("RPC create_company_account retornou erro:", error);
        }
      } catch (rpcErr) {
        console.warn("RPC create_company_account falhou, tentando fallback direto:", rpcErr);
      }

      // 2. Fallback de inserção direta caso a RPC não esteja aplicada ainda
      if (!createdOrg) {
        try {
          const { data: orgData, error: orgErr } = await (supabase.from("organizations") as any)
            .insert({
              name: payload.name.trim(),
              document: payload.document?.trim() || null,
              phone: payload.phone?.trim() || null,
            })
            .select()
            .single();

          if (!orgErr && orgData) {
            await (supabase.from("organization_members") as any).insert({
              organization_id: orgData.id,
              user_id: user.id,
              role: "owner",
            });

            createdOrg = {
              id: orgData.id,
              name: orgData.name,
              document: orgData.document ?? null,
              phone: orgData.phone ?? null,
              role: "owner",
            };
          } else if (orgErr) {
            throw orgErr;
          }
        } catch (directErr: any) {
          console.error("Falha ao criar organização:", directErr);
          throw new Error(directErr?.message ?? "Erro ao salvar empresa no banco de dados.");
        }
      }

      if (!createdOrg) {
        throw new Error("Não foi possível criar a empresa. Verifique sua conexão e permissões.");
      }

      // Atualiza o estado da empresa ativa imediatamente
      localStorage.setItem(getStorageKey(user.id, "active_org_id"), createdOrg.id);
      localStorage.setItem(getStorageKey(user.id, "active_org_name"), createdOrg.name);

      setCurrentOrg(createdOrg);
      setOrganizations((prev) => [createdOrg!, ...prev.filter((o) => o.id !== createdOrg!.id)]);
      setIsSetupModalOpen(false);

      // Invalida as queries do React Query para alimentar o Dashboard e telas com os dados da nova empresa
      queryClient.invalidateQueries();

      return createdOrg;
    },
    [user, queryClient]
  );

  const value = React.useMemo(
    () => ({
      organizations,
      currentOrg,
      isLoading,
      isSetupModalOpen,
      openSetupModal,
      closeSetupModal,
      selectOrganization,
      createOrganization,
      refreshOrganizations: fetchOrganizations,
    }),
    [
      organizations,
      currentOrg,
      isLoading,
      isSetupModalOpen,
      openSetupModal,
      closeSetupModal,
      selectOrganization,
      createOrganization,
      fetchOrganizations,
    ]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = React.useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization deve ser usado dentro de um <OrganizationProvider />");
  }
  return context;
}
