import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductProvider } from "@/contexts/ProductContext";
import { AppLayout } from "@/components/AppLayout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LayoutPage({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ProductProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/pdv" element={<PDV />} />
            <Route path="/" element={<LayoutPage><Index /></LayoutPage>} />
            <Route path="/produtos" element={<LayoutPage><Produtos /></LayoutPage>} />
            <Route path="/estoque" element={<LayoutPage><Estoque /></LayoutPage>} />
            <Route path="/clientes" element={<LayoutPage><Clientes /></LayoutPage>} />
            <Route path="/financeiro" element={<LayoutPage><Financeiro /></LayoutPage>} />
            <Route path="/caixa" element={<LayoutPage><Caixa /></LayoutPage>} />
            <Route path="/relatorios" element={<LayoutPage><Relatorios /></LayoutPage>} />
            <Route path="/relatorios/estoque" element={<LayoutPage><RelatorioEstoque /></LayoutPage>} />
            <Route path="/contas-pagar" element={<LayoutPage><ContasPagar /></LayoutPage>} />
            <Route path="/configuracoes" element={<LayoutPage><Configuracoes /></LayoutPage>} />
            <Route path="*" element={<LayoutPage><NotFound /></LayoutPage>} />
          </Routes>
        </BrowserRouter>
      </ProductProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
