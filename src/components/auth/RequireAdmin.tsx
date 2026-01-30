import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useIsAdmin } from "@/hooks/useIsAdmin";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="min-h-svh px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="glass rounded-xl border border-border/60 p-6 shadow-elevated">
            <p className="text-sm font-medium">Verificando permissões…</p>
            <p className="mt-1 text-xs text-muted-foreground">Aguarde um instante.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
