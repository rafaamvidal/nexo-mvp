import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="min-h-svh px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="glass rounded-xl border border-border/60 p-6 shadow-elevated">
            <p className="text-sm font-medium">Carregando sessão…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se isso demorar, verifique as configurações de Auth (Site URL/Redirect URLs) no Supabase.
            </p>
          </div>
        </div>
      </div>
    );

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
