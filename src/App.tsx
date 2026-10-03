import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { CompanySetupModal } from "@/components/organization/CompanySetupModal";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";

const DashboardHome = React.lazy(() => import("./pages/DashboardHome"));
const Estoque = React.lazy(() => import("./pages/Estoque"));
const Produtos = React.lazy(() => import("./pages/Produtos"));
const Vendas = React.lazy(() => import("./pages/Vendas"));
const Financeiro = React.lazy(() => import("./pages/Financeiro"));
const Compras = React.lazy(() => import("./pages/Compras"));
const Producao = React.lazy(() => import("./pages/Producao"));
const Cadastros = React.lazy(() => import("./pages/Cadastros"));
const RH = React.lazy(() => import("./pages/RH"));
const Relatorios = React.lazy(() => import("./pages/Relatorios"));
const Custos = React.lazy(() => import("./pages/Custos"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Auth = React.lazy(() => import("./pages/Auth"));

const PageFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      <span className="text-xs font-medium text-muted-foreground animate-pulse">Carregando módulo...</span>
    </div>
  </div>
);

const queryClient = new QueryClient();

const BRAND_TITLE = "AGILIX | Gestão Inteligente";

const App = () => {
  React.useEffect(() => {
    document.title = BRAND_TITLE;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <OrganizationProvider>
            <CompanySetupModal />
            <BrowserRouter>
              <React.Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <DashboardHome />
                  </RequireAuth>
                }
              />
              <Route
                path="/estoque"
                element={
                  <RequireAuth>
                    <Estoque />
                  </RequireAuth>
                }
              />
              <Route
                path="/produtos"
                element={
                  <RequireAuth>
                    <Produtos />
                  </RequireAuth>
                }
              />
              <Route
                path="/vendas"
                element={
                  <RequireAuth>
                    <Vendas />
                  </RequireAuth>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <RequireAuth>
                    <Financeiro />
                  </RequireAuth>
                }
              />
              <Route
                path="/cadastros"
                element={
                  <RequireAuth>
                    <Cadastros />
                  </RequireAuth>
                }
              />
              <Route
                path="/rh"
                element={
                  <RequireAuth>
                    <RH />
                  </RequireAuth>
                }
              />
              <Route
                path="/compras"
                element={
                  <RequireAuth>
                    <Compras />
                  </RequireAuth>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <Relatorios />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/custos"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <Custos />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/producao"
                element={
                  <RequireAuth>
                    <Producao />
                  </RequireAuth>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
        </OrganizationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
