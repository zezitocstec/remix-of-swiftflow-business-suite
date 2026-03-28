import { useMemo, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { TopBar } from "@/components/TopBar";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  FileText,
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
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
      <div className={`p-2 rounded-md ${accent || "bg-secondary"}`}>
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { products, sales, movements, actionLogs, bills } = useProducts();

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todaySales = useMemo(
    () => sales.filter((s) => new Date(s.date) >= today),
    [sales, today]
  );

  const faturamentoHoje = useMemo(
    () => todaySales.reduce((s, sale) => s + sale.total, 0),
    [todaySales]
  );

  const ticketMedio = todaySales.length > 0 ? faturamentoHoje / todaySales.length : 0;

  const itensVendidos = useMemo(
    () => todaySales.reduce((s, sale) => s + sale.items.reduce((a, i) => a + i.quantity, 0), 0),
    [todaySales]
  );

  // Weekly revenue chart from real sales
  const weekChart = useMemo(() => {
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const now = new Date();
    const result: { dia: string; valor: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const total = sales
        .filter((s) => new Date(s.date) >= dayStart && new Date(s.date) < dayEnd)
        .reduce((s, sale) => s + sale.total, 0);
      result.push({ dia: dias[dayStart.getDay()], valor: total });
    }
    return result;
  }, [sales]);

  // Stock alerts
  const stockAlerts = useMemo(
    () =>
      products
        .filter((p) => p.minStock && p.stock <= p.minStock)
        .map((p) => ({
          msg: `${p.name}: ${p.stock} un (mín: ${p.minStock})`,
          critical: p.stock === 0,
        })),
    [products]
  );

  // Overdue bills alerts
  const billAlerts = useMemo(() => {
    const now = new Date();
    return (bills || [])
      .filter((b) => b.status === "pendente" && new Date(b.dueDate) < now)
      .map((b) => ({ msg: `Conta vencida: ${b.description} — ${formatBRL(b.amount)}`, type: "overdue" as const }));
  }, [bills]);

  // Due soon alerts (within 3 days)
  const dueSoonAlerts = useMemo(() => {
    const now = new Date();
    const threeDays = new Date(now);
    threeDays.setDate(threeDays.getDate() + 3);
    return (bills || [])
      .filter((b) => {
        if (b.status !== "pendente") return false;
        const due = new Date(b.dueDate);
        return due >= now && due <= threeDays;
      })
      .map((b) => {
        const diff = Math.ceil((new Date(b.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return { msg: `Vence em ${diff}d: ${b.description} — ${formatBRL(b.amount)}`, type: "due-soon" as const };
      });
  }, [bills]);

  // Auto toast notifications for due-soon and overdue bills
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current) return;
    const total = billAlerts.length + dueSoonAlerts.length;
    if (total > 0) {
      notifiedRef.current = true;
      if (billAlerts.length > 0) {
        toast({
          title: `⚠️ ${billAlerts.length} conta(s) vencida(s)`,
          description: `Total: ${formatBRL(billAlerts.reduce((s, _) => s, 0))} — Verifique Contas a Pagar`,
          variant: "destructive",
        });
      }
      if (dueSoonAlerts.length > 0) {
        setTimeout(() => {
          toast({
            title: `🔔 ${dueSoonAlerts.length} conta(s) vencem em até 3 dias`,
            description: "Verifique a seção Contas a Pagar",
          });
        }, billAlerts.length > 0 ? 1500 : 0);
      }
    }
  }, [billAlerts, dueSoonAlerts]);

  // Recent logs
  const recentLogs = useMemo(() => actionLogs.slice(0, 5), [actionLogs]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Dashboard" subtitle="Visão geral do negócio" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} label="Faturamento Hoje" value={formatBRL(faturamentoHoje)} />
          <KPICard icon={ShoppingCart} label="Vendas Hoje" value={String(todaySales.length)} />
          <KPICard icon={TrendingUp} label="Ticket Médio" value={formatBRL(ticketMedio)} />
          <KPICard icon={Package} label="Itens Vendidos" value={String(itensVendidos)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Faturamento — Últimos 7 dias</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekChart}>
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
            <div className="space-y-2 max-h-[220px] overflow-auto">
              {stockAlerts.length === 0 && billAlerts.length === 0 && dueSoonAlerts.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum alerta no momento.</p>
              )}
              {billAlerts.map((a, i) => (
                <div key={`bill-${i}`} className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-sm">
                  <FileText className="h-4 w-4 text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-foreground">{a.msg}</span>
                </div>
              ))}
              {dueSoonAlerts.map((a, i) => (
                <div key={`soon-${i}`} className="flex items-start gap-2 p-2 rounded-md bg-warning/10 text-sm">
                  <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-foreground">{a.msg}</span>
                </div>
              ))}
              {stockAlerts.map((a, i) => (
                <div
                  key={`stock-${i}`}
                  className={`flex items-start gap-2 p-2 rounded-md text-sm ${a.critical ? "bg-destructive/10" : "bg-warning/10"}`}
                >
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${a.critical ? "text-destructive" : "text-warning"}`} strokeWidth={1.5} />
                  <span className="text-foreground">{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Actions */}
        <div className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Últimas Ações</h2>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma ação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Ação</th>
                    <th className="pb-2 font-medium">Operador</th>
                    <th className="pb-2 font-medium">Terminal</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                    <th className="pb-2 font-medium text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {log.description}
                      </td>
                      <td className="py-2 text-muted-foreground">{log.operatorName}</td>
                      <td className="py-2 text-muted-foreground">{log.terminalName}</td>
                      <td className="py-2 text-right tabular-nums text-foreground">
                        {log.amount != null ? formatBRL(log.amount) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {new Date(log.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
