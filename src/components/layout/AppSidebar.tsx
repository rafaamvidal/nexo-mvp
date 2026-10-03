import * as React from "react";
import { BarChart3, Calculator, Factory, LayoutGrid, Package, Settings, ShoppingCart, Truck, UserCheck, Users, Wallet } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { ProfileDialog } from "@/components/profile/ProfileDialog";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutGrid },
  { title: "Estoque", url: "/estoque", icon: LayoutGrid },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Cadastros", url: "/cadastros", icon: Users },
  { title: "RH & Pessoal", url: "/rh", icon: UserCheck },
  { title: "Compras", url: "/compras", icon: Truck },
  { title: "Produção", url: "/producao", icon: Factory },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Custos/Precificação", url: "/custos", icon: Calculator },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

import agiliXLogo from "@/assets/agilix_logo.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = React.useState(false);

  const { data: isAdmin } = useIsAdmin();

  const visibleItems = (isAdmin ? items : items.filter((i) => i.url !== "/relatorios" && i.url !== "/custos"));

  return (
    <Sidebar variant="floating" collapsible="icon" className="glass-sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2">
            <span className="sr-only">AGILIX</span>
            <img
              src={agiliXLogo}
              alt="AGILIX"
              loading="lazy"
              className={cn(
                "h-auto w-[140px] max-w-full object-contain drop-shadow-sm dark:brightness-110 dark:contrast-110",
                collapsed && "hidden",
              )}
            />
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-3">
            <SidebarMenu>
              {visibleItems.map((item) => {
                const active = item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <NavLink to={item.url} end className="gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user?.email ?? ""}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setProfileOpen(true)}
            aria-label="Alterar senha"
            title="Perfil / Alterar senha"
          >
            <Settings />
          </Button>
        </div>

        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </SidebarFooter>
    </Sidebar>
  );
}
