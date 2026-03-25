import { useState, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { BarChart3, DollarSign, Package, TrendingUp, ArrowLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type ReportView = "menu" | "faturamento" | "vendas" | "estoque" | "financeiro" | "curva-abc";

const reports = [
  { id: "faturamento" as ReportView, icon: DollarSign, title: "Faturamento", desc: "Receitas por período, comparativo mensal" },
  { id: "vendas" as ReportView, icon: TrendingUp, title: "Vendas", desc: "Análise de vendas, ticket médio, conversão" },
  { id: "estoque" as ReportView, icon: Package, title: "Estoque", desc: "Movimentação, inventário, giro de produtos" },
  { id: "financeiro" as ReportView, icon: BarChart3, title: "Financeiro", desc: "Fluxo de caixa, contas a pagar/receber" },
  { id: "curva-abc" as ReportView, icon: BarChart3, title: "Curva ABC", desc: "Classificação de produtos por faturamento" },
];

const ABC_COLORS = { A: "hsl(var(--primary))", B: "hsl(var(--warning))", C: "hsl(var(--muted-foreground))" };

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
      {/* Summary cards */}
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

      {/* Chart */}
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

      {/* Table */}
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
      <div className="flex-1 overflow-auto p-6">
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

        {view === "faturamento" && <p className="text-sm text-muted-foreground text-center py-8">Relatório de faturamento — em breve.</p>}
        {view === "vendas" && <p className="text-sm text-muted-foreground text-center py-8">Relatório de vendas — em breve.</p>}
        {view === "estoque" && <p className="text-sm text-muted-foreground text-center py-8">Relatório de estoque — em breve.</p>}
        {view === "financeiro" && <p className="text-sm text-muted-foreground text-center py-8">Relatório financeiro — em breve.</p>}
      </div>
    </div>
  );
}
