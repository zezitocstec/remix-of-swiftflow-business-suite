import { TopBar } from "@/components/TopBar";
import { BarChart3, DollarSign, Package, TrendingUp } from "lucide-react";

const reports = [
  { icon: DollarSign, title: "Faturamento", desc: "Receitas por período, comparativo mensal" },
  { icon: TrendingUp, title: "Vendas", desc: "Análise de vendas, ticket médio, conversão" },
  { icon: Package, title: "Estoque", desc: "Movimentação, inventário, giro de produtos" },
  { icon: BarChart3, title: "Financeiro", desc: "Fluxo de caixa, contas a pagar/receber" },
];

export default function Relatorios() {
  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Relatórios" subtitle="Análises e métricas" />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((r) => (
            <button
              key={r.title}
              className="rounded-md border border-border bg-card p-5 text-left hover:border-primary transition-colors flex items-start gap-4"
            >
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
      </div>
    </div>
  );
}
