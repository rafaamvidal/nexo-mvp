import * as React from "react";
import { LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ModuleHelpGuide } from "@/components/help/ModuleHelpGuide";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  // Mapeia pathname para chave de ajuda (ex: /estoque -> estoque, / -> dashboard)
  const pathKey = React.useMemo(() => {
    const raw = location.pathname.replace(/^\//, "").split("/")[0]?.toLowerCase();
    return raw || "dashboard";
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-svh flex w-full">
        <AppSidebar />

        <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
          <header className="sticky top-0 z-20">
            <div className="glass mx-2 sm:mx-3 mt-2 sm:mt-3 flex items-center justify-between rounded-xl px-2.5 sm:px-3 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <SidebarTrigger className="shrink-0" />
                <div className="min-w-0 flex items-center gap-1.5">
                  <div className="min-w-0">
                    <h1 className="truncate text-sm sm:text-base font-bold text-balance">{title}</h1>
                    <p className="truncate text-[11px] text-muted-foreground hidden sm:block">{user?.email ?? ""}</p>
                  </div>
                  <ModuleHelpGuide moduleKey={pathKey} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <PwaInstallPrompt variant="header" />
                <OrganizationSwitcher />
                <Button variant="glass" size="icon" onClick={signOut} aria-label="Sair" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 max-w-full px-2.5 sm:px-4 md:px-6 pb-20 md:pb-12 pt-3 sm:pt-4">{children}</main>
        </SidebarInset>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
