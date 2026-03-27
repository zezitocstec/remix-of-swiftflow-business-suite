import { useState, useMemo } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { CalendarIcon, Download, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportReportPDF } from "@/lib/export-pdf";

export default function FinanceiroReport() {
  const { sales, actionLogs, debts } = useProducts();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const inRange = (d: Date) => {
    if (dateFrom) { const s = new Date(dateFrom); s.setHours(0,0,0,0); if (d < s) return false; }
    if (dateTo) { const e = new Date(dateTo); e.setHours(23,59,59,999); if (d > e) return false; }
    return true;
  };

  const filteredSales = useMemo(() => sales.filter(s => inRange(s.date)), [sales, dateFrom, dateTo]);
  const filteredLogs = useMemo(() => actionLogs.filter(l => inRange(l.date)), [actionLogs, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const revenue = filteredSales.reduce((s, sale) => s + sale.total, 0);
    const withdrawals = filteredLogs.filter(l => l.type === "sangria").reduce((s, l) => s + (l.amount || 0), 0);
    const deposits = filteredLogs.filter(l => l.type === "reforco").reduce((s, l) => s + (l.amount || 0), 0);
    const openingBalances = filteredLogs.filter(l => l.type === "abertura_caixa").reduce((s, l) => s + (l.amount || 0), 0);
    const pendingDebts = debts.filter(d => d.paid < d.amount).reduce((s, d) => s + (d.amount - d.paid), 0);
    const receivedDebts = debts.reduce((s, d) => s + d.paid, 0);

    // By payment method
    const byMethod = new Map<string, number>();
    filteredSales.forEach(sale => {
      sale.methods.forEach(m => {
        byMethod.set(m.method, (byMethod.get(m.method) || 0) + m.amount);
      });
    });

    // Daily cash flow
    const dailyMap = new Map<string, { date: string; inflow: number; outflow: number }>();
    filteredSales.forEach(s => {
      const key = s.date.toLocaleDateString("pt-BR");
      const existing = dailyMap.get(key) || { date: key, inflow: 0, outflow: 0 };
      existing.inflow += s.total;
      dailyMap.set(key, existing);
    });
    filteredLogs.forEach(l => {
      if (l.type === "sangria" && l.amount) {
        const key = l.date.toLocaleDateString("pt-BR");
        const existing = dailyMap.get(key) || { date: key, inflow: 0, outflow: 0 };
        existing.outflow += l.amount;
        dailyMap.set(key, existing);
      }
    });
    const dailyFlow = Array.from(dailyMap.values());

    return {
      revenue, withdrawals, deposits, openingBalances, pendingDebts, receivedDebts,
      netCashFlow: revenue + deposits - withdrawals,
      methodData: Array.from(byMethod.entries()).map(([name, value]) => ({ name, value })),
      dailyFlow,
    };
  }, [filteredSales, filteredLogs, debts]);

  const handleExportPDF = () => {
    const headers = ["Indicador", "Valor"];
    const rows = [
      ["Receita de Vendas", formatBRL(stats.revenue)],
      ["Reforços de Caixa", formatBRL(stats.deposits)],
      ["Sangrias", formatBRL(stats.withdrawals)],
      ["Fluxo Líquido", formatBRL(stats.netCashFlow)],
      ["Contas a Receber (Fiado)", formatBRL(stats.pendingDebts)],
      ["Recebido de Fiado", formatBRL(stats.receivedDebts)],
    ];
    exportReportPDF("Relatório Financeiro", headers, rows, [
      { label: "Receita", value: formatBRL(stats.revenue) },
      { label: "Fluxo Líquido", value: formatBRL(stats.netCashFlow) },
      { label: "Contas a Receber", value: formatBRL(stats.pendingDebts) },
    ]);
  };

  const METHOD_COLORS = ["hsl(142, 71%, 45%)", "hsl(217, 91%, 60%)", "hsl(48, 96%, 53%)", "hsl(0, 84%, 60%)", "hsl(262, 83%, 58%)"];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportPDF}>
            <FileText className="h-3 w-3 mr-1" /> PDF
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            <p className="text-xs text-muted-foreground">Receita</p>
          </div>
          <p className="text-lg font-semibold tabular-nums text-success">{formatBRL(stats.revenue)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <p className="text-xs text-muted-foreground">Sangrias</p>
          </div>
          <p className="text-lg font-semibold tabular-nums text-destructive">{formatBRL(stats.withdrawals)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-1 mb-1">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs text-muted-foreground">Fluxo Líquido</p>
          </div>
          <p className={`text-lg font-semibold tabular-nums ${stats.netCashFlow >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(stats.netCashFlow)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Contas a Receber</p>
          <p className="text-lg font-semibold tabular-nums text-warning">{formatBRL(stats.pendingDebts)}</p>
        </div>
      </div>

      {/* Daily cash flow chart */}
      {stats.dailyFlow.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Fluxo de Caixa Diário</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyFlow} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatBRL(v), name === "inflow" ? "Entradas" : "Saídas"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="inflow" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payment methods breakdown */}
      {stats.methodData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Receita por Método de Pagamento</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.methodData} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Debts summary */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Resumo Financeiro</h4>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[
              { label: "Receita de Vendas", value: stats.revenue, color: "text-success" },
              { label: "Reforços de Caixa", value: stats.deposits, color: "text-success" },
              { label: "Sangrias", value: stats.withdrawals, color: "text-destructive", prefix: "-" },
              { label: "Fluxo Líquido de Caixa", value: stats.netCashFlow, color: stats.netCashFlow >= 0 ? "text-success" : "text-destructive", bold: true },
              { label: "Contas a Receber (Fiado)", value: stats.pendingDebts, color: "text-warning" },
              { label: "Recebido de Fiado", value: stats.receivedDebts, color: "text-success" },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className={`py-3 px-4 text-foreground ${row.bold ? "font-semibold" : ""}`}>{row.label}</td>
                <td className={`py-3 px-4 text-right tabular-nums ${row.color} ${row.bold ? "font-bold text-base" : "font-medium"}`}>
                  {row.prefix || ""}{formatBRL(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sales.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda registrada. Faça vendas no PDV primeiro.</p>}
    </div>
  );
}
