import { useState, useMemo } from "react";
import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { exportReportPDF } from "@/lib/export-pdf";

const CATEGORY_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(142.1 70.6% 45.3%)",
  "hsl(var(--muted-foreground))",
  "hsl(280 60% 55%)",
  "hsl(200 80% 50%)",
  "hsl(30 80% 55%)",
];

export default function DespesasReport() {
  const { bills } = useProducts();
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const paidBills = useMemo(
    () => bills.filter((b) => b.status === "pago" || b.status === "pendente"),
    [bills]
  );

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    paidBills.forEach((b) => {
      const cat = b.category || "outros";
      map[cat] = (map[cat] || 0) + b.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidBills]);

  const total = byCategory.reduce((s, c) => s + c.value, 0);

  // Monthly evolution
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const yr = parseInt(year);
    return months.map((month, i) => {
      const monthBills = paidBills.filter((b) => {
        const d = new Date(b.dueDate);
        return d.getFullYear() === yr && d.getMonth() === i;
      });
      const entry: Record<string, string | number> = { month };
      const cats = new Set(paidBills.map((b) => b.category || "outros"));
      cats.forEach((cat) => {
        entry[cat] = monthBills
          .filter((b) => (b.category || "outros") === cat)
          .reduce((s, b) => s + b.amount, 0);
      });
      entry.total = monthBills.reduce((s, b) => s + b.amount, 0);
      return entry;
    });
  }, [paidBills, year]);

  const categories = useMemo(
    () => [...new Set(paidBills.map((b) => b.category || "outros"))],
    [paidBills]
  );

  const years = useMemo(() => {
    const yrs = new Set(paidBills.map((b) => new Date(b.dueDate).getFullYear()));
    yrs.add(new Date().getFullYear());
    return [...yrs].sort((a, b) => b - a);
  }, [paidBills]);

  const handleExportPDF = () => {
    const summaryData = byCategory.map((c) => ({
      label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
      value: formatBRL(c.value),
    }));
    summaryData.push({ label: "Total", value: formatBRL(total) });

    const tableHeaders = ["Categoria", "Valor", "% do Total"];
    const tableRows = byCategory.map((c) => [
      c.name.charAt(0).toUpperCase() + c.name.slice(1),
      formatBRL(c.value),
      `${((c.value / total) * 100).toFixed(1)}%`,
    ]);

    exportReportPDF({
      title: "Relatório de Despesas por Categoria",
      summaryData,
      tableHeaders,
      tableRows,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Despesas</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(total)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Categorias</p>
          <p className="text-lg font-semibold text-foreground">{byCategory.length}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Média Mensal</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(total / 12)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma despesa cadastrada.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category table */}
        <div className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Detalhamento</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Categoria</th>
                <th className="pb-2 font-medium text-right">Valor</th>
                <th className="pb-2 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c, i) => (
                <tr key={c.name} className="border-b border-border last:border-0">
                  <td className="py-2 text-foreground flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="capitalize">{c.name}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground">{formatBRL(c.value)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : "0%"}
                  </td>
                </tr>
              ))}
              {byCategory.length > 0 && (
                <tr className="font-semibold">
                  <td className="py-2 text-foreground">Total</td>
                  <td className="py-2 text-right tabular-nums text-foreground">{formatBRL(total)}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly evolution */}
      <div className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Evolução Mensal — {year}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => formatBRL(v)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend />
            {categories.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} radius={i === categories.length - 1 ? [4, 4, 0, 0] : undefined} name={cat.charAt(0).toUpperCase() + cat.slice(1)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
