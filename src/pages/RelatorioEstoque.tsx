import { useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { AlertTriangle, Package, TrendingDown, DollarSign, Search } from "lucide-react";

export default function RelatorioEstoque() {
  const { products, movements, sales } = useProducts();
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter((p) => p.category === categoryFilter);
  }, [categoryFilter, products]);

  const lowStockProducts = useMemo(() =>
    filtered.filter((p) => p.minStock && p.stock <= p.minStock),
  [filtered]);

  const outOfStockProducts = useMemo(() =>
    filtered.filter((p) => p.stock <= 0),
  [filtered]);

  // Products without recent sales (no sale movements in context)
  const productSaleCount = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.forEach((s) => s.items.forEach((i) => { counts[i.productId] = (counts[i.productId] || 0) + i.quantity; }));
    return counts;
  }, [sales]);

  const noSalesProducts = useMemo(() =>
    filtered.filter((p) => !productSaleCount[p.id]),
  [filtered, productSaleCount]);

  const totalStockCost = useMemo(() => filtered.reduce((s, p) => s + p.price * p.stock, 0), [filtered]);
  const totalStockItems = useMemo(() => filtered.reduce((s, p) => s + p.stock, 0), [filtered]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Relatório de Estoque" subtitle="Análise detalhada do inventário" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10"><Package className="h-4 w-4 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Total em Estoque</p><p className="text-lg font-semibold tabular-nums text-foreground">{totalStockItems} un</p></div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-success/10"><DollarSign className="h-4 w-4 text-success" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Valor Total (Venda)</p><p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalStockCost)}</p></div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-warning/10"><AlertTriangle className="h-4 w-4 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Estoque Baixo</p><p className="text-lg font-semibold tabular-nums text-warning">{lowStockProducts.length}</p></div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-destructive/10"><TrendingDown className="h-4 w-4 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Sem Vendas</p><p className="text-lg font-semibold tabular-nums text-destructive">{noSalesProducts.length}</p></div>
          </div>
        </div>

        {/* Low stock table */}
        {lowStockProducts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Produtos com Estoque Baixo
            </h3>
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-warning/5 text-muted-foreground">
                  <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                  <th className="text-left py-2.5 px-4 font-medium">Categoria</th>
                  <th className="text-right py-2.5 px-4 font-medium">Estoque</th>
                  <th className="text-right py-2.5 px-4 font-medium">Mínimo</th>
                  <th className="text-right py-2.5 px-4 font-medium">Déficit</th>
                </tr></thead>
                <tbody>
                  {lowStockProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 bg-warning/5">
                      <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{p.category}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-warning font-medium">{p.stock}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{p.minStock}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-destructive font-medium">{(p.minStock || 0) - p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No sales products */}
        {noSalesProducts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" /> Produtos sem Vendas Recentes
            </h3>
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary text-muted-foreground">
                  <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                  <th className="text-left py-2.5 px-4 font-medium">Categoria</th>
                  <th className="text-right py-2.5 px-4 font-medium">Estoque</th>
                  <th className="text-right py-2.5 px-4 font-medium">Valor Parado</th>
                </tr></thead>
                <tbody>
                  {noSalesProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                      <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{p.category}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{p.stock}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price * p.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
