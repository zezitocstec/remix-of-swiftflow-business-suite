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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ProductProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/pdv" element={<PDV />} />
            <Route
              path="*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/produtos" element={<Produtos />} />
                    <Route path="/estoque" element={<Estoque />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/financeiro" element={<Financeiro />} />
                    <Route path="/caixa" element={<Caixa />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/relatorios/estoque" element={<RelatorioEstoque />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </ProductProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
