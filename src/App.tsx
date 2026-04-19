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
import AdminRoute from "@/components/AdminRoute";
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
import OrcamentoPDV from "./pages/OrcamentoPDV";
import PortalOrcamento from "./pages/PortalOrcamento";
import Restaurante from "./pages/Restaurante";
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
                <Route path="/portal/:token" element={<PortalOrcamento />} />
                <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
                <Route path="/orcamento" element={<ProtectedRoute><OrcamentoPDV /></ProtectedRoute>} />
                <Route path="/" element={<ProtectedRoute><AdminRoute><LayoutPage><Index /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/produtos" element={<ProtectedRoute><AdminRoute><LayoutPage><Produtos /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/estoque" element={<ProtectedRoute><AdminRoute><LayoutPage><Estoque /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/clientes" element={<ProtectedRoute><AdminRoute><LayoutPage><Clientes /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute><AdminRoute><LayoutPage><Financeiro /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/caixa" element={<ProtectedRoute><LayoutPage><Caixa /></LayoutPage></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute><AdminRoute><LayoutPage><Relatorios /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/relatorios/estoque" element={<ProtectedRoute><AdminRoute><LayoutPage><RelatorioEstoque /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/contas-pagar" element={<ProtectedRoute><AdminRoute><LayoutPage><ContasPagar /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/orcamentos" element={<ProtectedRoute><AdminRoute><LayoutPage><Orcamentos /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><AdminRoute><LayoutPage><Configuracoes /></LayoutPage></AdminRoute></ProtectedRoute>} />
                <Route path="/restaurante" element={<ProtectedRoute><Restaurante /></ProtectedRoute>} />
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

