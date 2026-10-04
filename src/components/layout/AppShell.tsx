import * as React from "react";
import { LogOut } from "lucide-react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-svh flex w-full">
        <AppSidebar />

        <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
          <header className="sticky top-0 z-10">
            <div className="glass mx-3 mt-3 flex items-center justify-between rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-bold text-balance">{title}</h1>
                  <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <OrganizationSwitcher />
                <Button variant="glass" size="icon" onClick={signOut} aria-label="Sair">
                  <LogOut />
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 max-w-full px-3 pb-8 pt-4 md:px-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
