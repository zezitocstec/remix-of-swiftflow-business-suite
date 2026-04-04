import { TopBar } from "@/components/TopBar";
import { formatBRL } from "@/lib/mock-data";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

const mockContas = [
  { id: "1", desc: "Aluguel Loja", tipo: "pagar", valor: 3500, vencimento: "25/03/2026", status: "pendente" },
  { id: "2", desc: "Venda #1247", tipo: "receber", valor: 890.50, vencimento: "20/03/2026", status: "recebido" },
  { id: "3", desc: "Fornecedor Bebidas", tipo: "pagar", valor: 2100, vencimento: "28/03/2026", status: "pendente" },
  { id: "4", desc: "Venda #1248", tipo: "receber", valor: 1240.80, vencimento: "19/03/2026", status: "recebido" },
  { id: "5", desc: "Energia Elétrica", tipo: "pagar", valor: 680, vencimento: "15/04/2026", status: "pendente" },
];

export default function Financeiro() {
  const totalPagar = mockContas.filter(c => c.tipo === "pagar").reduce((s, c) => s + c.valor, 0);
  const totalReceber = mockContas.filter(c => c.tipo === "receber").reduce((s, c) => s + c.valor, 0);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Financeiro" subtitle="Contas a pagar e receber" />
      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-destructive/10"><ArrowUpRight className="h-4 w-4 text-destructive" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A Pagar</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalPagar)}</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-success/10"><ArrowDownLeft className="h-4 w-4 text-success" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A Receber</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalReceber)}</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10"><Wallet className="h-4 w-4 text-primary" strokeWidth={1.5} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saldo</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatBRL(totalReceber - totalPagar)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Descrição</th>
                <th className="text-center py-2.5 px-4 font-medium">Tipo</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor</th>
                <th className="text-center py-2.5 px-4 font-medium">Vencimento</th>
                <th className="text-center py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockContas.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{c.desc}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.tipo === "pagar" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    }`}>{c.tipo === "pagar" ? "Pagar" : "Receber"}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(c.valor)}</td>
                  <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{c.vencimento}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.status === "pendente" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{c.status === "pendente" ? "Pendente" : "Recebido"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
