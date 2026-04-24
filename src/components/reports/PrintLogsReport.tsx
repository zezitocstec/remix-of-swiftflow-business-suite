import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { fetchPrintLogs, type PrintLogEntry } from "@/lib/print-log";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, RefreshCw, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { formatBRL } from "@/lib/mock-data";

type FilterStatus = "all" | "ok" | "fail";

export default function PrintLogsReport() {
  const { tenantId } = useTenant();
  const [logs, setLogs] = useState<PrintLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  const reload = async () => {
    if (!tenantId) return;
    setLoading(true);
    const data = await fetchPrintLogs(tenantId, 300);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (statusFilter === "ok" && !l.ok) return false;
      if (statusFilter === "fail" && l.ok) return false;
      if (q) {
        const hay = [
          String(l.table_numero),
          l.table_nome ?? "",
          l.operator_name ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, search]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const okCount = filtered.filter((l) => l.ok).length;
    const failCount = total - okCount;
    const totalRequested = filtered.reduce((s, l) => s + (l.copies_requested || 0), 0);
    const totalPrinted = filtered.reduce((s, l) => s + (l.copies_printed || 0), 0);
    const reprintCount = filtered.filter((l) => l.is_reprint).length;
    const successRate = total > 0 ? (okCount / total) * 100 : 0;
    return { total, okCount, failCount, totalRequested, totalPrinted, reprintCount, successRate };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" /> Logs de Impressão (Restaurante)
          </h2>
          <p className="text-sm text-muted-foreground">
            Vias solicitadas vs. impressas em cada fechamento de mesa, com sucesso/falha do <code>printFinalReceipt</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Fechamentos" value={String(summary.total)} />
        <KpiCard label="Vias solicitadas" value={String(summary.totalRequested)} />
        <KpiCard label="Vias impressas" value={String(summary.totalPrinted)} />
        <KpiCard label="Reimpressões" value={String(summary.reprintCount)} />
        <KpiCard label="Sucesso" value={`${summary.okCount}`} tone="ok" />
        <KpiCard label="Falhas" value={`${summary.failCount}`} tone={summary.failCount > 0 ? "fail" : "muted"} />
      </div>

      <div className="rounded-md border border-border bg-card p-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Taxa de sucesso:</span>
        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, summary.successRate)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground tabular-nums w-12 text-right">
          {summary.successRate.toFixed(1)}%
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por mesa, nome ou operador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">Apenas sucesso</SelectItem>
            <SelectItem value="fail">Apenas falhas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-foreground">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Data/Hora</th>
                <th className="text-left py-2 px-3 font-medium">Mesa</th>
                <th className="text-left py-2 px-3 font-medium">Operador</th>
                <th className="text-right py-2 px-3 font-medium">Solicitadas</th>
                <th className="text-right py-2 px-3 font-medium">Impressas</th>
                <th className="text-right py-2 px-3 font-medium">Total</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
                <th className="text-left py-2 px-3 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    Nenhum log de impressão encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((l, i) => {
                  const dt = l.printed_at ? new Date(l.printed_at) : null;
                  const mismatch = l.copies_requested !== l.copies_printed;
                  return (
                    <tr key={i} className="border-t border-border hover:bg-secondary/40">
                      <td className="py-2 px-3 text-muted-foreground tabular-nums whitespace-nowrap">
                        {dt ? dt.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        Mesa {l.table_numero}
                        {l.table_nome && <span className="text-muted-foreground"> — {l.table_nome}</span>}
                        {l.is_reprint && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                            Reimpressão
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-foreground">{l.operator_name ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-foreground">{l.copies_requested}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${mismatch ? "text-destructive font-semibold" : "text-foreground"}`}>
                        {l.copies_printed}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-foreground">{formatBRL(l.total_amount)}</td>
                      <td className="py-2 px-3 text-center">
                        {l.ok ? (
                          <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Falha
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[260px] truncate" title={l.error_message ?? ""}>
                        {l.error_message ?? (mismatch ? "Vias impressas divergem das solicitadas" : "—")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Logs também são armazenados localmente como fallback, caso a tabela <code>restaurant_print_logs</code> não esteja disponível.
      </p>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "fail" | "muted" }) {
  const valueClass =
    tone === "ok" ? "text-primary" :
    tone === "fail" ? "text-destructive" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}
