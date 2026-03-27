import { useState, useMemo } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { CalendarIcon, Download, AlertTriangle, ArrowDown, ArrowUp, RotateCcw, ShoppingCart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportReportPDF } from "@/lib/export-pdf";

const typeLabels: Record<string, { label: string; color: string }> = {
  entrada: { label: "Entrada", color: "text-success" },
  saida: { label: "Saída", color: "text-warning" },
  venda: { label: "Venda", color: "text-primary" },
  cancelamento: { label: "Cancelamento", color: "text-destructive" },
};

export default function EstoqueReport() {
  const { products, movements, sales } = useProducts();
  const [filterType, setFilterType] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (filterProduct !== "all" && m.productId !== filterProduct) return false;
      if (dateFrom) { const s = new Date(dateFrom); s.setHours(0,0,0,0); if (m.date < s) return false; }
      if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); if (m.date > e) return false; }
      return true;
    });
  }, [movements, filterType, filterProduct, dateFrom, dateTo]);

  // Product turnover (giro)
  const turnoverData = useMemo(() => {
    return products.map((p) => {
      const soldQty = movements.filter(m => m.productId === p.id && m.type === "venda").reduce((s, m) => s + m.quantity, 0);
      const entryQty = movements.filter(m => m.productId === p.id && m.type === "entrada").reduce((s, m) => s + m.quantity, 0);
      const avgStock = p.stock > 0 ? p.stock : 1;
      const turnover = soldQty / avgStock;
      return { name: p.name, stock: p.stock, sold: soldQty, entries: entryQty, turnover: parseFloat(turnover.toFixed(2)), value: p.stock * p.price, minStock: p.minStock || 0, belowMin: p.minStock ? p.stock <= p.minStock : false };
    }).sort((a, b) => b.turnover - a.turnover);
  }, [products, movements]);

  const totalValue = turnoverData.reduce((s, p) => s + p.value, 0);
  const lowStockCount = turnoverData.filter(p => p.belowMin).length;
  const totalEntries = filtered.filter(m => m.type === "entrada").reduce((s, m) => s + m.quantity, 0);
  const totalSales = filtered.filter(m => m.type === "venda").reduce((s, m) => s + m.quantity, 0);

  const topTurnover = turnoverData.slice(0, 10);

  const handleExportPDF = () => {
    const headers = ["Produto", "Estoque", "Vendido", "Giro", "Valor em Estoque"];
    const rows = turnoverData.map(p => [p.name, String(p.stock), String(p.sold), p.turnover.toFixed(2), formatBRL(p.value)]);
    exportReportPDF("Relatório de Estoque", headers, rows, [
      { label: "Valor Total em Estoque", value: formatBRL(totalValue) },
      { label: "Produtos Abaixo do Mínimo", value: String(lowStockCount) },
      { label: "Total Entradas (período)", value: String(totalEntries) },
      { label: "Total Vendas (período)", value: String(totalSales) },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportPDF}>
              <FileText className="h-3 w-3 mr-1" /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="cancelamento">Cancelamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Produto</label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-full text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-full text-xs justify-start", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor em Estoque</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalValue)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Produtos</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{products.length}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entradas (período)</p>
          <p className="text-lg font-semibold tabular-nums text-success">{totalEntries} un</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">Abaixo do Mínimo</p>
            {lowStockCount > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
          </div>
          <p className={`text-lg font-semibold tabular-nums ${lowStockCount > 0 ? "text-warning" : "text-foreground"}`}>{lowStockCount}</p>
        </div>
      </div>

      {/* Turnover chart */}
      {topTurnover.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Giro de Produtos (Top 10)</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTurnover} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(v: number, name: string) => [v.toFixed(2), name === "turnover" ? "Giro" : name]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="turnover" name="Giro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Inventário Atual</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-muted-foreground">
              <th className="text-left py-2.5 px-4 font-medium">Produto</th>
              <th className="text-right py-2.5 px-4 font-medium">Estoque</th>
              <th className="text-right py-2.5 px-4 font-medium">Mín.</th>
              <th className="text-right py-2.5 px-4 font-medium">Vendido</th>
              <th className="text-right py-2.5 px-4 font-medium">Giro</th>
              <th className="text-right py-2.5 px-4 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {turnoverData.map((p) => (
              <tr key={p.name} className={`border-b border-border last:border-0 ${p.belowMin ? "bg-warning/5" : ""}`}>
                <td className="py-2 px-4 text-foreground font-medium flex items-center gap-1">
                  {p.belowMin && <AlertTriangle className="h-3 w-3 text-warning shrink-0" />}
                  {p.name}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{p.stock}</td>
                <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{p.minStock || "—"}</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{p.sold}</td>
                <td className="py-2 px-4 text-right tabular-nums text-primary font-medium">{p.turnover.toFixed(2)}x</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{formatBRL(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movement history */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Movimentações ({filtered.length})</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-muted-foreground">
              <th className="text-left py-2.5 px-4 font-medium">Data/Hora</th>
              <th className="text-left py-2.5 px-4 font-medium">Tipo</th>
              <th className="text-left py-2.5 px-4 font-medium">Produto</th>
              <th className="text-right py-2.5 px-4 font-medium">Qtd</th>
              <th className="text-left py-2.5 px-4 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((m) => {
              const info = typeLabels[m.type] || { label: m.type, color: "text-muted-foreground" };
              const Icon = m.type === "entrada" ? ArrowDown : m.type === "venda" ? ShoppingCart : m.type === "cancelamento" ? RotateCcw : ArrowUp;
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {m.date.toLocaleDateString("pt-BR")} {m.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 px-4">
                    <span className={`text-xs font-medium flex items-center gap-1 ${info.color}`}>
                      <Icon className="h-3 w-3" /> {info.label}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-xs text-foreground">{m.productName}</td>
                  <td className="py-2 px-4 text-right text-xs tabular-nums text-foreground font-medium">{m.quantity}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">{m.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação encontrada.</p>}
      </div>
    </div>
  );
}
