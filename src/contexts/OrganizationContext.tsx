import * as React from "react";
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
  selectOrganization: (orgId: string) => void;
  createOrganization: (payload: { name: string; document?: string; phone?: string }) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

const STORAGE_ACTIVE_ORG_KEY = "agilix_active_org_id";

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = React.useState<Organization | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchOrganizations = React.useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Busca as organizações que o usuário atual faz parte
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name,
            document,
            phone,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        // Se a tabela ainda não existir no Supabase, evita travar a aplicação
        console.warn("Aviso ao buscar organizações:", error.message);
        setOrganizations([]);
        setCurrentOrg(null);
        return;
      }

      const list: Organization[] = (data ?? [])
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

      setOrganizations(list);

      // Define a organização ativa
      const savedOrgId = localStorage.getItem(STORAGE_ACTIVE_ORG_KEY);
      const matched = list.find((o) => o.id === savedOrgId);

      if (matched) {
        setCurrentOrg(matched);
      } else if (list.length > 0) {
        setCurrentOrg(list[0]);
        localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, list[0].id);
      } else {
        setCurrentOrg(null);
      }
    } catch (err: any) {
      console.warn("Erro ao carregar organizações:", err);
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
      if (org) {
        setCurrentOrg(org);
        localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, org.id);
        toast.info(`Empresa ativa: ${org.name}`);
        // Recarrega a página para atualizar os caches do React Query sob o novo tenant
        window.location.reload();
      }
    },
    [organizations]
  );

  const createOrganization = React.useCallback(
    async (payload: { name: string; document?: string; phone?: string }): Promise<Organization> => {
      if (!user) throw new Error("Usuário não autenticado");

      // Tenta via RPC create_company_account primeiro
      try {
        const { data, error } = await supabase.rpc("create_company_account" as any, {
          p_name: payload.name,
          p_document: payload.document || undefined,
          p_phone: payload.phone || undefined,
        });

        if (!error && data) {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          const newOrg: Organization = {
            id: parsed.id,
            name: parsed.name,
            document: parsed.document ?? null,
            phone: payload.phone ?? null,
            role: "owner",
          };

          await fetchOrganizations();
          setCurrentOrg(newOrg);
          localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, newOrg.id);
          return newOrg;
        }
      } catch (rpcErr) {
        console.warn("RPC create_company_account falhou, tentando fallback manual:", rpcErr);
      }

      // Fallback manual direto nas tabelas caso a RPC não tenha sido executada ainda
      const { data: orgData, error: orgErr } = await (supabase.from("organizations") as any)
        .insert({
          name: payload.name.trim(),
          document: payload.document?.trim() || null,
          phone: payload.phone?.trim() || null,
        })
        .select()
        .single();

      if (orgErr) throw orgErr;

      const { error: memberErr } = await (supabase.from("organization_members") as any).insert({
        organization_id: orgData.id,
        user_id: user.id,
        role: "owner",
      });

      if (memberErr) throw memberErr;

      const newOrg: Organization = {
        id: orgData.id,
        name: orgData.name,
        document: orgData.document ?? null,
        phone: orgData.phone ?? null,
        role: "owner",
      };

      await fetchOrganizations();
      setCurrentOrg(newOrg);
      localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, newOrg.id);
      return newOrg;
    },
    [user, fetchOrganizations]
  );

  const value = React.useMemo(
    () => ({
      organizations,
      currentOrg,
      isLoading,
      selectOrganization,
      createOrganization,
      refreshOrganizations: fetchOrganizations,
    }),
    [organizations, currentOrg, isLoading, selectOrganization, createOrganization, fetchOrganizations]
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
