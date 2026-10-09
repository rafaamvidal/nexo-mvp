import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Boxes,
  Briefcase,
  Calculator,
  Factory,
  LayoutGrid,
  Menu,
  Package,
  Plus,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const primaryNav = [
  { title: "Início", url: "/", icon: LayoutGrid },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
];

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutGrid },
  { title: "Estoque & Saldos", url: "/estoque", icon: Boxes },
  { title: "Produtos & Catálogo", url: "/produtos", icon: Package },
  { title: "Cadastros (Clientes/Forn.)", url: "/cadastros", icon: Users },
  { title: "Vendas & Pedidos", url: "/vendas", icon: ShoppingCart },
  { title: "Compras & Insumos", url: "/compras", icon: Truck },
  { title: "Produção & Ordens", url: "/producao", icon: Factory },
  { title: "Financeiro & Caixa", url: "/financeiro", icon: Wallet },
  { title: "RH & Pessoal", url: "/rh", icon: Users },
  { title: "Custos & Precificação", url: "/custos", icon: Calculator },
  { title: "Relatórios & DRE", url: "/relatorios", icon: Briefcase },
];

export function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { data: isAdmin } = useIsAdmin();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const extraItems = allNavItems.filter((item) => {
    if (!isAdmin && (item.url === "/relatorios" || item.url === "/custos")) return false;
    return true;
  });

  return (
    <nav
      aria-label="Navegação inferior mobile"
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-border/80 bg-background/95 backdrop-blur-xl md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.url === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.url);

          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-medium transition-colors select-none",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-all",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="mt-0.5 truncate max-w-[60px]">{item.title}</span>
            </NavLink>
          );
        })}

        {/* Menu rápido com os demais módulos */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-medium transition-colors select-none",
                !primaryNav.some((p) =>
                  p.url === "/" ? currentPath === "/" : currentPath.startsWith(p.url)
                )
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-all",
                  sheetOpen ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
              >
                <Menu className="h-4 w-4" />
              </div>
              <span className="mt-0.5 truncate">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl p-4 max-h-[80dvh] overflow-y-auto no-scrollbar"
          >
            <SheetHeader className="pb-3 text-left">
              <SheetTitle className="text-base font-bold">Módulos do Sistema</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2.5 pt-1 pb-4">
              {extraItems.map((item) => {
                const Icon = item.icon;
                const isSelected =
                  item.url === "/"
                    ? currentPath === "/"
                    : currentPath.startsWith(item.url);

                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all border",
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-primary font-semibold"
                        : "bg-card/40 border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 mb-1.5" />
                    <span className="text-[11px] leading-tight line-clamp-2">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
