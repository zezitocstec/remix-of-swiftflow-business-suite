import { useProducts } from "@/contexts/ProductContext";
import { formatBRL } from "@/lib/mock-data";
import { Clock, User, Monitor, ShoppingCart, XCircle, ArrowUpRight, ArrowDownLeft, Lock, Unlock } from "lucide-react";

const typeLabels: Record<string, { label: string; color: string; Icon: any }> = {
  abertura_caixa: { label: "Abertura de Caixa", color: "bg-success/10 text-success", Icon: Unlock },
  fechamento_caixa: { label: "Fechamento de Caixa", color: "bg-destructive/10 text-destructive", Icon: Lock },
  venda: { label: "Venda", color: "bg-primary/10 text-primary", Icon: ShoppingCart },
  cancelamento_item: { label: "Cancel. Item", color: "bg-warning/10 text-warning", Icon: XCircle },
  cancelamento_cupom: { label: "Cancel. Cupom", color: "bg-destructive/10 text-destructive", Icon: XCircle },
  sangria: { label: "Sangria", color: "bg-destructive/10 text-destructive", Icon: ArrowUpRight },
  reforco: { label: "Reforço", color: "bg-success/10 text-success", Icon: ArrowDownLeft },
};

export default function LogsConfig() {
  const { actionLogs } = useProducts();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Histórico de Ações</h3>
        <p className="text-sm text-muted-foreground">Registro de todas as operações realizadas no PDV</p>
      </div>

      {actionLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Data/Hora</th>
                <th className="text-left py-2.5 px-4 font-medium">Tipo</th>
                <th className="text-left py-2.5 px-4 font-medium">Operador</th>
                <th className="text-left py-2.5 px-4 font-medium">Terminal</th>
                <th className="text-left py-2.5 px-4 font-medium">Descrição</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {actionLogs.map((log) => {
                const info = typeLabels[log.type] || { label: log.type, color: "bg-muted text-muted-foreground", Icon: Clock };
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {log.date.toLocaleDateString("pt-BR")} {log.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${info.color}`}>{info.label}</span>
                    </td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.operatorName}</td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.terminalName}</td>
                    <td className="py-2 px-4 text-foreground text-xs">{log.description}</td>
                    <td className="py-2 px-4 text-right tabular-nums text-foreground text-xs">{log.amount ? formatBRL(log.amount) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
