import { TopBar } from "@/components/TopBar";
import { dashboardData, formatBRL } from "@/lib/mock-data";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
      <div className="p-2 rounded-md bg-secondary">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight-display text-foreground">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const d = dashboardData;

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Dashboard" subtitle="Visão geral do negócio" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} label="Faturamento Hoje" value={formatBRL(d.faturamentoHoje)} />
          <KPICard icon={ShoppingCart} label="Vendas Hoje" value={String(d.vendasHoje)} />
          <KPICard icon={TrendingUp} label="Ticket Médio" value={formatBRL(d.ticketMedio)} />
          <KPICard icon={Package} label="Itens Vendidos" value={String(d.produtosVendidos)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Faturamento da Semana</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.faturamentoSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Alerts */}
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Alertas</h2>
            <div className="space-y-3">
              {d.alertas.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-md bg-secondary text-sm"
                >
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-foreground">{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Produtos Mais Vendidos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 font-medium text-right">Vendas</th>
                  <th className="pb-2 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {d.topProdutos.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 text-foreground">{p.name}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{p.vendas}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatBRL(p.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
