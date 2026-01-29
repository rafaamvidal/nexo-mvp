import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).some((r) => (r as any).role === "admin");
}

export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["auth", "isAdmin", user?.id ?? null],
    queryFn: () => fetchIsAdmin(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
