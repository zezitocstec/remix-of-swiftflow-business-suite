import { TopBar } from "@/components/TopBar";
import { mockProducts, formatBRL } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

export default function Estoque() {
  const lowStock = mockProducts.filter((p) => p.stock < 40);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Estoque" subtitle="Controle de inventário" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {lowStock.length > 0 && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-foreground">Estoque Baixo</h3>
            </div>
            <div className="space-y-1">
              {lowStock.map((p) => (
                <p key={p.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{p.name}</span> — {p.stock} unidades restantes
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-muted-foreground">
                <th className="text-left py-2.5 px-4 font-medium">Produto</th>
                <th className="text-left py-2.5 px-4 font-medium">SKU</th>
                <th className="text-right py-2.5 px-4 font-medium">Qtd Atual</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor Unit.</th>
                <th className="text-right py-2.5 px-4 font-medium">Valor Total</th>
                <th className="text-center py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockProducts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{p.sku}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{p.stock}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-foreground">{formatBRL(p.price * p.stock)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      p.stock < 20
                        ? "bg-destructive/10 text-destructive"
                        : p.stock < 40
                        ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success"
                    }`}>
                      {p.stock < 20 ? "Crítico" : p.stock < 40 ? "Baixo" : "Normal"}
                    </span>
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
