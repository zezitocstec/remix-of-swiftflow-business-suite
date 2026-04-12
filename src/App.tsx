import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { AppLayout } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import PDV from "./pages/PDV";
import Produtos from "./pages/Produtos";
import Estoque from "./pages/Estoque";
import Clientes from "./pages/Clientes";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import RelatorioEstoque from "./pages/RelatorioEstoque";
import Caixa from "./pages/Caixa";
import Configuracoes from "./pages/Configuracoes";
import ContasPagar from "./pages/ContasPagar";
import Orcamentos from "./pages/Orcamentos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LayoutPage({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <TenantProvider>
          <ProductProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
                <Route path="/" element={<ProtectedRoute><LayoutPage><Index /></LayoutPage></ProtectedRoute>} />
                <Route path="/produtos" element={<ProtectedRoute><LayoutPage><Produtos /></LayoutPage></ProtectedRoute>} />
                <Route path="/estoque" element={<ProtectedRoute><LayoutPage><Estoque /></LayoutPage></ProtectedRoute>} />
                <Route path="/clientes" element={<ProtectedRoute><LayoutPage><Clientes /></LayoutPage></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute><LayoutPage><Financeiro /></LayoutPage></ProtectedRoute>} />
                <Route path="/caixa" element={<ProtectedRoute><LayoutPage><Caixa /></LayoutPage></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute><LayoutPage><Relatorios /></LayoutPage></ProtectedRoute>} />
                <Route path="/relatorios/estoque" element={<ProtectedRoute><LayoutPage><RelatorioEstoque /></LayoutPage></ProtectedRoute>} />
                <Route path="/contas-pagar" element={<ProtectedRoute><LayoutPage><ContasPagar /></LayoutPage></ProtectedRoute>} />
                <Route path="/orcamentos" element={<ProtectedRoute><LayoutPage><Orcamentos /></LayoutPage></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><LayoutPage><Configuracoes /></LayoutPage></ProtectedRoute>} />
                <Route path="*" element={<LayoutPage><NotFound /></LayoutPage>} />
              </Routes>
            </BrowserRouter>
          </ProductProvider>
        </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

