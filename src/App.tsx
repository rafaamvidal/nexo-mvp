import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardHome from "./pages/DashboardHome";
import Estoque from "./pages/Estoque";
import Produtos from "./pages/Produtos";
import Vendas from "./pages/Vendas";
import Financeiro from "./pages/Financeiro";
import Compras from "./pages/Compras";
import Producao from "./pages/Producao";
import Cadastros from "./pages/Cadastros";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/auth/RequireAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
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
              path="/compras"
              element={
                <RequireAuth>
                  <Compras />
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
