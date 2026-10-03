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
const STORAGE_ACTIVE_ORG_NAME = "agilix_active_org_name";

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

      // 1. Busca primeiro direto na tabela organizations
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

        const savedOrgId = localStorage.getItem(STORAGE_ACTIVE_ORG_KEY);
        const matched = list.find((o) => o.id === savedOrgId);

        if (matched) {
          setCurrentOrg(matched);
        } else {
          setCurrentOrg(list[0]);
          localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, list[0].id);
          localStorage.setItem(STORAGE_ACTIVE_ORG_NAME, list[0].name);
        }
        return;
      }

      // 2. Se a busca direta não retornar, tenta via organization_members
      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, document, phone, created_at)")
        .eq("user_id", user.id);

      if (memberData && memberData.length > 0) {
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
          const savedOrgId = localStorage.getItem(STORAGE_ACTIVE_ORG_KEY);
          const matched = list.find((o) => o.id === savedOrgId);
          if (matched) {
            setCurrentOrg(matched);
          } else {
            setCurrentOrg(list[0]);
            localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, list[0].id);
            localStorage.setItem(STORAGE_ACTIVE_ORG_NAME, list[0].name);
          }
          return;
        }
      }

      // 3. Fallback em cache local se o banco ainda estiver aplicando a migração
      const savedOrgId = localStorage.getItem(STORAGE_ACTIVE_ORG_KEY);
      const savedOrgName = localStorage.getItem(STORAGE_ACTIVE_ORG_NAME);
      if (savedOrgId && savedOrgName) {
        const cached: Organization = {
          id: savedOrgId,
          name: savedOrgName,
          document: null,
          phone: null,
          role: "owner",
        };
        setOrganizations([cached]);
        setCurrentOrg(cached);
      } else {
        setOrganizations([]);
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
        localStorage.setItem(STORAGE_ACTIVE_ORG_NAME, org.name);
        toast.info(`Empresa ativa: ${org.name}`);
        window.location.reload();
      }
    },
    [organizations]
  );

  const createOrganization = React.useCallback(
    async (payload: { name: string; document?: string; phone?: string }): Promise<Organization> => {
      if (!user) throw new Error("Usuário não autenticado");

      let createdOrg: Organization | null = null;

      // 1. Tenta via RPC create_company_account
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
        }
      } catch (rpcErr) {
        console.warn("RPC create_company_account falhou, tentando fallback manual:", rpcErr);
      }

      // 2. Se a RPC não foi executada ainda, tenta insert direto
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
          }
        } catch (directErr) {
          console.warn("Insert manual falhou:", directErr);
        }
      }

      // 3. Se por acaso as tabelas ainda não existirem no Supabase, cria em cache local
      if (!createdOrg) {
        const tempId = `local_${Date.now()}`;
        createdOrg = {
          id: tempId,
          name: payload.name.trim(),
          document: payload.document?.trim() || null,
          phone: payload.phone?.trim() || null,
          role: "owner",
        };
      }

      // Atualiza o estado imediatamente para fechar qualquer modal aberto
      localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, createdOrg.id);
      localStorage.setItem(STORAGE_ACTIVE_ORG_NAME, createdOrg.name);
      setCurrentOrg(createdOrg);
      setOrganizations((prev) => [createdOrg!, ...prev.filter((o) => o.id !== createdOrg!.id)]);

      // Tenta revalidar no background
      fetchOrganizations().catch(() => {});

      return createdOrg;
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
