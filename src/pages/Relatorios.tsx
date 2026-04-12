import { useState, useMemo } from "react";
import ComissoesReport from "@/components/reports/ComissoesReport";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { BarChart3, DollarSign, Package, TrendingUp, ArrowLeft, Monitor, CalendarIcon, Download, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, Legend } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportSalesCSV, exportRevenueCSV } from "@/lib/export-utils";
import { exportReportPDF } from "@/lib/export-pdf";
import EstoqueReport from "@/components/reports/EstoqueReport";
import FinanceiroReport from "@/components/reports/FinanceiroReport";
import DespesasReport from "@/components/reports/DespesasReport";
import OrcamentosReport from "@/components/reports/OrcamentosReport";

type ReportView = "menu" | "faturamento" | "vendas-terminal" | "estoque" | "financeiro" | "curva-abc" | "despesas" | "orcamentos" | "comissoes";

const reports = [
  { id: "faturamento" as ReportView, icon: DollarSign, title: "Faturamento", desc: "Receitas por período, comparativo mensal" },
  { id: "vendas-terminal" as ReportView, icon: Monitor, title: "Vendas por Terminal", desc: "Detalhamento por caixa, ticket médio, métodos de pagamento" },
  { id: "estoque" as ReportView, icon: Package, title: "Estoque", desc: "Movimentação, inventário, giro de produtos" },
  { id: "financeiro" as ReportView, icon: BarChart3, title: "Financeiro", desc: "Fluxo de caixa, contas a pagar/receber" },
  { id: "despesas" as ReportView, icon: DollarSign, title: "Despesas por Categoria", desc: "Gráfico de pizza, evolução mensal, detalhamento" },
  { id: "curva-abc" as ReportView, icon: BarChart3, title: "Curva ABC", desc: "Classificação de produtos por faturamento" },
  { id: "orcamentos" as ReportView, icon: FileText, title: "Orçamentos", desc: "Propostas comerciais, status e valores" },
  { id: "comissoes" as ReportView, icon: Users, title: "Comissões", desc: "Comissões dos vendedores por orçamentos convertidos" },
];

const ABC_COLORS = { A: "hsl(var(--primary))", B: "hsl(var(--warning))", C: "hsl(var(--muted-foreground))" };

const METHOD_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--muted-foreground))",
];

// ─── Faturamento Report ───
function Faturamento() {
  const { sales } = useProducts();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (dateFrom) { const start = new Date(dateFrom); start.setHours(0,0,0,0); if (s.date < start) return false; }
      if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); if (s.date > end) return false; }
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; sales: number; key: string }>();
    filtered.forEach((s) => {
      const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, "0")}`;
      const label = s.date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const existing = map.get(key) || { revenue: 0, sales: 0, key };
      existing.revenue += s.total;
      existing.sales++;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({ month: key, label: new Date(key + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), ...d, ticket: d.sales > 0 ? d.revenue / d.sales : 0 }));
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map = new Map<string, { revenue: number; sales: number }>();
    filtered.forEach((s) => {
      const key = s.date.toLocaleDateString("pt-BR");
      const existing = map.get(key) || { revenue: 0, sales: 0 };
      existing.revenue += s.total;
      existing.sales++;
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([day, d]) => ({ day, ...d })).slice(-30);
  }, [filtered]);

  const totalRevenue = filtered.reduce((s, sale) => s + sale.total, 0);
  const totalSales = filtered.length;
  const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Month-over-month comparison
  const comparison = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const current = monthlyData[monthlyData.length - 1];
    const prev = monthlyData[monthlyData.length - 2];
    const pctChange = prev.revenue > 0 ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    return { current, prev, pctChange };
  }, [monthlyData]);

  const exportData = monthlyData.map(d => ({ month: d.label, revenue: d.revenue, sales: d.sales, ticket: d.ticket }));

  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma venda registrada. Faça vendas no PDV primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filters + Export */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportRevenueCSV(exportData)}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
              const headers = ["Mês", "Vendas", "Faturamento", "Ticket Médio"];
              const rows = monthlyData.map(d => [d.label, String(d.sales), formatBRL(d.revenue), formatBRL(d.ticket)]);
              exportReportPDF("Relatório de Faturamento", headers, rows, [
                { label: "Faturamento Total", value: formatBRL(totalRevenue) },
                { label: "Total de Vendas", value: String(totalSales) },
                { label: "Ticket Médio", value: formatBRL(ticketMedio) },
              ]);
            }}>
              <FileText className="h-3 w-3 mr-1" /> PDF
            </Button>
          </div>
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
          <p className="text-xs text-muted-foreground">Faturamento Total</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalRevenue)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de Vendas</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{totalSales}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(ticketMedio)}</p>
        </div>
        {comparison && (
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Variação Mensal</p>
            <p className={`text-lg font-semibold tabular-nums ${comparison.pctChange >= 0 ? "text-success" : "text-destructive"}`}>
              {comparison.pctChange >= 0 ? "+" : ""}{comparison.pctChange.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{comparison.prev.label} → {comparison.current.label}</p>
          </div>
        )}
      </div>

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Comparativo Mensal</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatBRL(v), name === "revenue" ? "Faturamento" : name === "ticket" ? "Ticket Médio" : name]}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Daily evolution line chart */}
      {dailyData.length > 1 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Evolução Diária (últimos 30 dias)</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="revenue" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly detail table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Detalhamento Mensal</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-muted-foreground">
              <th className="text-left py-2.5 px-4 font-medium">Mês</th>
              <th className="text-right py-2.5 px-4 font-medium">Vendas</th>
              <th className="text-right py-2.5 px-4 font-medium">Faturamento</th>
              <th className="text-right py-2.5 px-4 font-medium">Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((d) => (
              <tr key={d.month} className="border-b border-border last:border-0">
                <td className="py-2 px-4 text-foreground font-medium">{d.label}</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{d.sales}</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{formatBRL(d.revenue)}</td>
                <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{formatBRL(d.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendasTerminal() {
  const { sales, terminals } = useProducts();
  const [filterTerminal, setFilterTerminal] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (filterTerminal !== "all" && s.terminalId !== filterTerminal) return false;
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        if (s.date < start) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (s.date > end) return false;
      }
      return true;
    });
  }, [sales, filterTerminal, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalRevenue = filtered.reduce((s, sale) => s + sale.total, 0);
    const totalSales = filtered.length;
    const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalItems = filtered.reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity, 0), 0);

    // By terminal
    const byTerminal = new Map<string, { name: string; revenue: number; count: number }>();
    filtered.forEach((sale) => {
      const tid = sale.terminalId || "sem-terminal";
      const tname = sale.terminalName || "Sem terminal";
      const existing = byTerminal.get(tid) || { name: tname, revenue: 0, count: 0 };
      existing.revenue += sale.total;
      existing.count++;
      byTerminal.set(tid, existing);
    });

    // By payment method
    const byMethod = new Map<string, number>();
    filtered.forEach((sale) => {
      sale.methods.forEach((m) => {
        byMethod.set(m.method, (byMethod.get(m.method) || 0) + m.amount);
      });
    });

    return {
      totalRevenue, totalSales, ticketMedio, totalItems,
      terminalData: Array.from(byTerminal.entries()).map(([id, d]) => ({ id, ...d, ticket: d.count > 0 ? d.revenue / d.count : 0 })),
      methodData: Array.from(byMethod.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [filtered]);

  const hasFilters = filterTerminal !== "all" || dateFrom || dateTo;

  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma venda registrada. Faça vendas no PDV primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filters + Export */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportSalesCSV(filtered)}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
              const headers = ["Data/Hora", "Terminal", "Operador", "Itens", "Pagamento", "Total"];
              const rows = filtered.map(s => [
                `${s.date.toLocaleDateString("pt-BR")} ${s.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
                s.terminalName || "—", s.operatorName || "—",
                String(s.items.reduce((acc, i) => acc + i.quantity, 0)),
                s.methods.map(m => m.method).join("+"), formatBRL(s.total),
              ]);
              exportReportPDF("Vendas por Terminal", headers, rows, [
                { label: "Faturamento", value: formatBRL(stats.totalRevenue) },
                { label: "Vendas", value: String(stats.totalSales) },
                { label: "Ticket Médio", value: formatBRL(stats.ticketMedio) },
              ]);
            }}>
              <FileText className="h-3 w-3 mr-1" /> PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Terminal</label>
            <Select value={filterTerminal} onValueChange={setFilterTerminal}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os terminais</SelectItem>
                {terminals.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
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
          <p className="text-xs text-muted-foreground">Faturamento</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de Vendas</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{stats.totalSales}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(stats.ticketMedio)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Itens Vendidos</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{stats.totalItems}</p>
        </div>
      </div>

      {/* Terminal breakdown */}
      {stats.terminalData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Faturamento por Terminal</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.terminalData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatBRL(v), name === "revenue" ? "Faturamento" : name]}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payment methods */}
      {stats.methodData.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4">Métodos de Pagamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {stats.methodData.map((_, i) => (
                      <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {stats.methodData.map((m, i) => (
                <div key={m.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                    <span className="text-foreground">{m.name}</span>
                  </div>
                  <span className="tabular-nums text-foreground font-medium">{formatBRL(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Terminal detail table */}
      {stats.terminalData.length > 0 && (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Terminal</th>
                <th className="text-right py-2.5 px-4 font-medium">Vendas</th>
                <th className="text-right py-2.5 px-4 font-medium">Faturamento</th>
                <th className="text-right py-2.5 px-4 font-medium">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {stats.terminalData.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="py-2 px-4 text-foreground font-medium">{t.name}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-foreground">{t.count}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-foreground">{formatBRL(t.revenue)}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{formatBRL(t.ticket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual sales table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Vendas Detalhadas ({filtered.length})</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-muted-foreground">
              <th className="text-left py-2.5 px-4 font-medium">Data/Hora</th>
              <th className="text-left py-2.5 px-4 font-medium">Terminal</th>
              <th className="text-left py-2.5 px-4 font-medium">Operador</th>
              <th className="text-right py-2.5 px-4 font-medium">Itens</th>
              <th className="text-left py-2.5 px-4 font-medium">Pagamento</th>
              <th className="text-right py-2.5 px-4 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((sale) => (
              <tr key={sale.id} className="border-b border-border last:border-0">
                <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                  {sale.date.toLocaleDateString("pt-BR")} {sale.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2 px-4 text-xs text-foreground">{sale.terminalName || "—"}</td>
                <td className="py-2 px-4 text-xs text-foreground">{sale.operatorName || "—"}</td>
                <td className="py-2 px-4 text-right text-xs tabular-nums text-foreground">{sale.items.reduce((s, i) => s + i.quantity, 0)}</td>
                <td className="py-2 px-4 text-xs text-foreground">{sale.methods.map((m) => m.method).join(", ") || "—"}</td>
                <td className="py-2 px-4 text-right text-xs tabular-nums text-foreground font-medium">{formatBRL(sale.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CurvaABC() {
  const { sales } = useProducts();
  const [filterTerminal, setFilterTerminal] = useState<string>("all");

  const abcData = useMemo(() => {
    const productMap = new Map<string, { name: string; revenue: number; quantity: number }>();

    const filtered = filterTerminal === "all" ? sales : sales.filter(s => s.terminalId === filterTerminal);

    filtered.forEach(sale => {
      sale.items.forEach(item => {
        const existing = productMap.get(item.productId) || { name: item.productName, revenue: 0, quantity: 0 };
        existing.revenue += item.price * item.quantity;
        existing.quantity += item.quantity;
        productMap.set(item.productId, existing);
      });
    });

    const sorted = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0);

    if (totalRevenue === 0) return [];

    let cumulative = 0;
    return sorted.map((p) => {
      cumulative += p.revenue;
      const pct = (cumulative / totalRevenue) * 100;
      const classification = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...p, pct: (p.revenue / totalRevenue) * 100, cumulativePct: pct, classification };
    });
  }, [sales, filterTerminal]);

  const counts = { A: abcData.filter(p => p.classification === "A").length, B: abcData.filter(p => p.classification === "B").length, C: abcData.filter(p => p.classification === "C").length };
  const revenues = { A: abcData.filter(p => p.classification === "A").reduce((s, p) => s + p.revenue, 0), B: abcData.filter(p => p.classification === "B").reduce((s, p) => s + p.revenue, 0), C: abcData.filter(p => p.classification === "C").reduce((s, p) => s + p.revenue, 0) };

  if (abcData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma venda registrada para gerar a curva ABC. Faça vendas no PDV primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {(["A", "B", "C"] as const).map(cls => (
          <div key={cls} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${cls === "A" ? "bg-primary" : cls === "B" ? "bg-warning" : "bg-muted-foreground"}`}>{cls}</span>
              <span className="text-sm font-medium text-foreground">Classe {cls}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(revenues[cls])}</p>
            <p className="text-xs text-muted-foreground">{counts[cls]} produto{counts[cls] !== 1 ? "s" : ""} • {cls === "A" ? "80%" : cls === "B" ? "15%" : "5%"} do faturamento</p>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-foreground mb-4">Faturamento por Produto</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={abcData.slice(0, 20)} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} labelStyle={{ color: "hsl(var(--foreground))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="revenue" name="Faturamento" radius={[4, 4, 0, 0]}>
                {abcData.slice(0, 20).map((entry, i) => (
                  <Cell key={i} fill={ABC_COLORS[entry.classification as keyof typeof ABC_COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-muted-foreground">
              <th className="text-left py-2.5 px-4 font-medium">Classe</th>
              <th className="text-left py-2.5 px-4 font-medium">Produto</th>
              <th className="text-right py-2.5 px-4 font-medium">Qtd</th>
              <th className="text-right py-2.5 px-4 font-medium">Faturamento</th>
              <th className="text-right py-2.5 px-4 font-medium">% Total</th>
              <th className="text-right py-2.5 px-4 font-medium">% Acum.</th>
            </tr>
          </thead>
          <tbody>
            {abcData.map((p, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-2 px-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${p.classification === "A" ? "bg-primary" : p.classification === "B" ? "bg-warning" : "bg-muted-foreground"}`}>{p.classification}</span>
                </td>
                <td className="py-2 px-4 text-foreground">{p.name}</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{p.quantity}</td>
                <td className="py-2 px-4 text-right tabular-nums text-foreground">{formatBRL(p.revenue)}</td>
                <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{p.pct.toFixed(1)}%</td>
                <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">{p.cumulativePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [view, setView] = useState<ReportView>("menu");

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Relatórios" subtitle={view === "menu" ? "Análises e métricas" : reports.find(r => r.id === view)?.title || ""} />
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        {view !== "menu" && (
          <Button variant="ghost" size="sm" onClick={() => setView("menu")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        )}

        {view === "menu" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reports.map((r) => (
              <button key={r.id} onClick={() => setView(r.id)}
                className="rounded-md border border-border bg-card p-5 text-left hover:border-primary transition-colors flex items-start gap-4">
                <div className="p-2 rounded-md bg-secondary">
                  <r.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {view === "curva-abc" && <CurvaABC />}
        {view === "vendas-terminal" && <VendasTerminal />}

        {view === "faturamento" && <Faturamento />}
        {view === "estoque" && <EstoqueReport />}
        {view === "financeiro" && <FinanceiroReport />}
        {view === "despesas" && <DespesasReport />}
        {view === "orcamentos" && <OrcamentosReport />}
        {view === "comissoes" && <ComissoesReport />}
      </div>
    </div>
  );
}
