import { Factory, LayoutGrid, Package, ShoppingCart, Truck, Users, Wallet } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutGrid },
  { title: "Estoque", url: "/estoque", icon: LayoutGrid },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Cadastros", url: "/cadastros", icon: Users },
  { title: "Compras", url: "/compras", icon: Truck },
  { title: "Produção", url: "/producao", icon: Factory },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
];

const LOGO_URL =
  "https://lesmncgjcvguyizzjvrw.supabase.co/storage/v1/object/public/branding/nexo_erp_logo.jpg";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar variant="floating" collapsible="icon" className="glass-sidebar">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2">
            <span className="sr-only">Nexo ERP</span>
            <img
              src={LOGO_URL}
              alt="Nexo ERP"
              loading="lazy"
              className={cn(
                "h-auto w-[140px] max-w-full object-contain drop-shadow-sm dark:brightness-110 dark:contrast-110",
                collapsed && "hidden",
              )}
            />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
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
    </Sidebar>
  );
}
